// WebGPU version of the D2Q9 lattice Boltzmann solver in lbm.js.
// Same physics: BGK + Smagorinsky collision, push streaming with half-way bounce-back,
// fixed-velocity inlet, zero-gradient outlet, periodic top/bottom, momentum-exchange forces.
//
// Each frame runs several steps on the GPU, then copies back the macroscopic fields
// (density, velocity) for drawing, plus one force sample per step for C_L / C_D.

const MAX_STEPS = 64;        // most steps that can run in one frame
const WG = 16;               // workgroup is WG x WG cells
const PARAM_STRIDE = 256;    // uniform buffer offset alignment

const SHADER = /* wgsl */`
struct Params { nx: u32, ny: u32, step: u32, nwg: u32, uIn: f32, nu: f32, p0: f32, p1: f32 };

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> fin: array<f32>;
@group(0) @binding(2) var<storage, read_write> fout: array<f32>;
@group(0) @binding(3) var<storage, read_write> flags: array<u32>;     // 0 fluid, 1 solid, 2 just reopened
@group(0) @binding(4) var<storage, read_write> macros: array<f32>;    // rho[N], ux[N], uy[N]
@group(0) @binding(5) var<storage, read_write> partials: array<f32>;  // per-workgroup force sums
@group(0) @binding(6) var<storage, read_write> forces: array<f32>;    // per-step Fx, Fy

const W0 = 4.0 / 9.0;
const W1 = 1.0 / 9.0;
const W2 = 1.0 / 36.0;

fn ex(i: u32) -> i32 { return array<i32, 9>(0, 1, 0, -1, 0, 1, -1, -1, 1)[i]; }
fn ey(i: u32) -> i32 { return array<i32, 9>(0, 0, 1, 0, -1, 1, 1, -1, -1)[i]; }
fn wt(i: u32) -> f32 { return array<f32, 9>(W0, W1, W1, W1, W1, W2, W2, W2, W2)[i]; }
fn opp(i: u32) -> u32 { return array<u32, 9>(0u, 3u, 4u, 1u, 2u, 7u, 8u, 5u, 6u)[i]; }

fn feq(i: u32, r: f32, u: f32, v: f32) -> f32 {
  let eu = f32(ex(i)) * u + f32(ey(i)) * v;
  return wt(i) * r * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * (u * u + v * v));
}

var<workgroup> sfx: array<f32, 256>;
var<workgroup> sfy: array<f32, 256>;

@compute @workgroup_size(${WG}, ${WG})
fn stepMain(@builtin(global_invocation_id) gid: vec3u,
            @builtin(local_invocation_index) li: u32,
            @builtin(workgroup_id) wid: vec3u,
            @builtin(num_workgroups) nw: vec3u) {
  let nx = P.nx; let ny = P.ny; let N = nx * ny;
  var Fx = 0.0; var Fy = 0.0;
  if (gid.x < nx && gid.y < ny) {
    let x = gid.x; let y = gid.y; let k = y * nx + x;
    if (flags[k] == 1u) {
      macros[k] = 1.0; macros[N + k] = 0.0; macros[2u * N + k] = 0.0;
    } else {
      var f: array<f32, 9>;
      var r = 0.0; var mu = 0.0; var mv = 0.0;
      for (var i = 0u; i < 9u; i++) {
        f[i] = fin[i * N + k];
        r += f[i]; mu += f[i] * f32(ex(i)); mv += f[i] * f32(ey(i));
      }
      let u = mu / r; let v = mv / r;
      macros[k] = r; macros[N + k] = u; macros[2u * N + k] = v;

      // equilibrium and non-equilibrium stress (Smagorinsky eddy viscosity)
      var e: array<f32, 9>;
      var pxx = 0.0; var pyy = 0.0; var pxy = 0.0;
      for (var i = 0u; i < 9u; i++) {
        e[i] = feq(i, r, u, v);
        let d = f[i] - e[i]; let cx = f32(ex(i)); let cy = f32(ey(i));
        pxx += cx * cx * d; pyy += cy * cy * d; pxy += cx * cy * d;
      }
      let Q = sqrt(pxx * pxx + pyy * pyy + 2.0 * pxy * pxy);
      let tau0 = 3.0 * P.nu + 0.5;
      let C = 18.0 * 1.41421356 * 0.01;
      let om = 1.0 / (0.5 * (tau0 + sqrt(tau0 * tau0 + C * Q / r)));

      // collide, then stream with bounce-back and momentum exchange
      for (var i = 0u; i < 9u; i++) {
        let p = f[i] + om * (e[i] - f[i]);
        let xn = i32(x) + ex(i);
        if (xn < 0 || xn >= i32(nx)) { continue; }
        var yn = i32(y) + ey(i);
        if (yn < 0) { yn = i32(ny) - 1; } else if (yn >= i32(ny)) { yn = 0; }
        let kn = u32(yn) * nx + u32(xn);
        if (flags[kn] == 1u) {
          fout[opp(i) * N + k] = p;
          Fx += 2.0 * p * f32(ex(i)); Fy += 2.0 * p * f32(ey(i));
        } else {
          fout[i * N + kn] = p;
        }
      }
    }
  }
  // workgroup sum of the force contributions
  sfx[li] = Fx; sfy[li] = Fy;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (li < s) { sfx[li] += sfx[li + s]; sfy[li] += sfy[li + s]; }
    workgroupBarrier();
  }
  if (li == 0u) {
    let w = wid.y * nw.x + wid.x;
    partials[2u * w] = sfx[0]; partials[2u * w + 1u] = sfy[0];
  }
}

// Inlet (fixed velocity) and outlet (zero gradient), after streaming.
@compute @workgroup_size(64)
fn boundaryMain(@builtin(global_invocation_id) gid: vec3u) {
  let nx = P.nx; let ny = P.ny; let N = nx * ny;
  let y = gid.x;
  if (y >= ny) { return; }
  let k = y * nx; let ko = k + nx - 1u;
  for (var i = 0u; i < 9u; i++) {
    fout[i * N + k] = feq(i, 1.0, P.uIn, 0.0);
    fout[i * N + ko] = fout[i * N + ko - 1u];
  }
}

// Sum the per-workgroup partials into this step's force slot.
@compute @workgroup_size(256)
fn reduceMain(@builtin(local_invocation_index) li: u32) {
  var ax = 0.0; var ay = 0.0;
  for (var w = li; w < P.nwg; w += 256u) { ax += partials[2u * w]; ay += partials[2u * w + 1u]; }
  sfx[li] = ax; sfy[li] = ay;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (li < s) { sfx[li] += sfx[li + s]; sfy[li] += sfy[li + s]; }
    workgroupBarrier();
  }
  if (li == 0u) { forces[2u * P.step] = sfx[0]; forces[2u * P.step + 1u] = sfy[0]; }
}

// Uniform flow at the inlet speed, with a tiny vertical nudge to break symmetry.
@compute @workgroup_size(${WG}, ${WG})
fn initMain(@builtin(global_invocation_id) gid: vec3u) {
  let nx = P.nx; let ny = P.ny; let N = nx * ny;
  if (gid.x >= nx || gid.y >= ny) { return; }
  let k = gid.y * nx + gid.x;
  let solid = flags[k] == 1u;
  if (flags[k] == 2u) { flags[k] = 0u; }
  let u = select(P.uIn, 0.0, solid);
  let v = select(P.uIn * 0.03 * sin(6.28318530718 * f32(gid.x) / f32(nx)), 0.0, solid);
  for (var i = 0u; i < 9u; i++) { let q = feq(i, 1.0, u, v); fin[i * N + k] = q; fout[i * N + k] = q; }
  macros[k] = 1.0; macros[N + k] = u; macros[2u * N + k] = v;
}

// Cells that were solid and are now open start as still air.
@compute @workgroup_size(${WG}, ${WG})
fn reopenMain(@builtin(global_invocation_id) gid: vec3u) {
  let nx = P.nx; let ny = P.ny; let N = nx * ny;
  if (gid.x >= nx || gid.y >= ny) { return; }
  let k = gid.y * nx + gid.x;
  if (flags[k] != 2u) { return; }
  for (var i = 0u; i < 9u; i++) { fin[i * N + k] = wt(i); }
  macros[k] = 1.0; macros[N + k] = 0.0; macros[2u * N + k] = 0.0;
  flags[k] = 0u;
}
`;

export class GpuSolver {
  /** Returns a ready solver, or null if WebGPU is unavailable. */
  static async create() {
    try {
      if (!navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      const device = await adapter.requestDevice({
        requiredLimits: { maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 256 * 1024 * 1024) }
      });
      const s = new GpuSolver(device, adapter);
      await s.build();
      return s;
    } catch (e) {
      console.warn('WebGPU unavailable, using CPU solver:', e);
      return null;
    }
  }

  constructor(device, adapter) {
    this.device = device;
    this.adapterName = (adapter.info && (adapter.info.description || adapter.info.vendor)) || 'GPU';
    this.lost = false;
    device.lost.then(() => { this.lost = true; });
    this.nx = 0; this.ny = 0;
    this.parity = 0;
    this.busy = false;
  }

  async build() {
    const d = this.device;
    d.pushErrorScope('validation');
    const module = d.createShaderModule({ code: SHADER });
    const storage = { type: 'storage' };
    this.layout = d.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...[1, 2, 3, 4, 5, 6].map(b => ({ binding: b, visibility: GPUShaderStage.COMPUTE, buffer: storage }))
      ]
    });
    const pl = d.createPipelineLayout({ bindGroupLayouts: [this.layout] });
    const mk = entryPoint => d.createComputePipeline({ layout: pl, compute: { module, entryPoint } });
    this.pStep = mk('stepMain');
    this.pBoundary = mk('boundaryMain');
    this.pReduce = mk('reduceMain');
    this.pInit = mk('initMain');
    this.pReopen = mk('reopenMain');
    this.params = d.createBuffer({ size: PARAM_STRIDE * MAX_STEPS, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.forces = d.createBuffer({ size: MAX_STEPS * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const err = await d.popErrorScope();
    if (err) throw new Error(err.message);
  }

  /** Allocate GPU buffers for an nx × ny grid (no-op if unchanged). */
  resize(nx, ny) {
    if (nx === this.nx && ny === this.ny) return;
    const d = this.device, N = nx * ny;
    [this.fA, this.fB, this.flags, this.macros, this.partials, this.staging].forEach(b => b && b.destroy());
    const S = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
    this.nx = nx; this.ny = ny;
    this.wgx = Math.ceil(nx / WG); this.wgy = Math.ceil(ny / WG); this.nwg = this.wgx * this.wgy;
    this.fA = d.createBuffer({ size: 9 * N * 4, usage: S });
    this.fB = d.createBuffer({ size: 9 * N * 4, usage: S });
    this.flags = d.createBuffer({ size: N * 4, usage: S | CD });
    this.macros = d.createBuffer({ size: 3 * N * 4, usage: S | CS });
    this.partials = d.createBuffer({ size: this.nwg * 8, usage: S });
    this.stagingBytes = 3 * N * 4 + MAX_STEPS * 8;
    this.staging = d.createBuffer({ size: this.stagingBytes, usage: GPUBufferUsage.MAP_READ | CD });
    const bg = (a, b) => d.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.params, size: 32 } },
        { binding: 1, resource: { buffer: a } }, { binding: 2, resource: { buffer: b } },
        { binding: 3, resource: { buffer: this.flags } }, { binding: 4, resource: { buffer: this.macros } },
        { binding: 5, resource: { buffer: this.partials } }, { binding: 6, resource: { buffer: this.forces } }
      ]
    });
    this.groups = [bg(this.fA, this.fB), bg(this.fB, this.fA)];
    this.parity = 0;
  }

  writeParams(count, uIn, nu) {
    const buf = new ArrayBuffer(PARAM_STRIDE * count), u32 = new Uint32Array(buf), f32 = new Float32Array(buf);
    for (let s = 0; s < count; s++) {
      const o = s * PARAM_STRIDE / 4;
      u32[o] = this.nx; u32[o + 1] = this.ny; u32[o + 2] = s; u32[o + 3] = this.nwg;
      f32[o + 4] = uIn; f32[o + 5] = nu;
    }
    this.device.queue.writeBuffer(this.params, 0, buf);
  }

  /** Upload solid cells. flags: Uint32Array, 0 fluid / 1 solid / 2 reopened since last step. */
  setFlags(flags) { this.device.queue.writeBuffer(this.flags, 0, flags); this.pendingReopen = true; }

  /** Reset the whole field to uniform flow. */
  init(uIn, nu) {
    this.writeParams(1, uIn, nu);
    const enc = this.device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(this.pInit);
    pass.setBindGroup(0, this.groups[this.parity], [0]);
    pass.dispatchWorkgroups(this.wgx, this.wgy);
    pass.end();
    this.device.queue.submit([enc.finish()]);
    this.pendingReopen = false;
  }

  /**
   * Run n steps, then read back fields and forces.
   * Resolves to { rho, ux, uy, forces } as Float32Arrays (valid until the next call).
   */
  async run(n, uIn, nu) {
    n = Math.max(1, Math.min(MAX_STEPS, n));
    const d = this.device, N = this.nx * this.ny;
    this.busy = true;
    this.writeParams(n, uIn, nu);
    const enc = d.createCommandEncoder(), pass = enc.beginComputePass();
    if (this.pendingReopen) {
      pass.setPipeline(this.pReopen);
      pass.setBindGroup(0, this.groups[this.parity], [0]);
      pass.dispatchWorkgroups(this.wgx, this.wgy);
      this.pendingReopen = false;
    }
    for (let s = 0; s < n; s++) {
      const g = this.groups[this.parity], off = [s * PARAM_STRIDE];
      pass.setBindGroup(0, g, off);
      pass.setPipeline(this.pStep); pass.dispatchWorkgroups(this.wgx, this.wgy);
      pass.setPipeline(this.pBoundary); pass.dispatchWorkgroups(Math.ceil(this.ny / 64));
      pass.setPipeline(this.pReduce); pass.dispatchWorkgroups(1);
      this.parity ^= 1;
    }
    pass.end();
    enc.copyBufferToBuffer(this.macros, 0, this.staging, 0, 3 * N * 4);
    enc.copyBufferToBuffer(this.forces, 0, this.staging, 3 * N * 4, n * 8);
    d.queue.submit([enc.finish()]);
    await this.staging.mapAsync(GPUMapMode.READ);
    const all = new Float32Array(this.staging.getMappedRange().slice(0));
    this.staging.unmap();
    this.busy = false;
    return {
      rho: all.subarray(0, N), ux: all.subarray(N, 2 * N), uy: all.subarray(2 * N, 3 * N),
      forces: all.subarray(3 * N, 3 * N + 2 * n)
    };
  }
}
