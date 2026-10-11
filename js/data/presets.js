// Wing section presets: classic NACA 4-digit sections, then real aircraft that use them.
// Aircraft sources: Wikipedia specification tables and the UIUC
// "Incomplete Guide to Airfoil Usage" (Lednicer).
// Thickness is rounded to a whole percent where the real section is fractional.
export const PRESETS = [
  { label: 'NACA 0012', naca: '0012', title: 'NACA 0012', role: 'Symmetric section',
    about: 'Makes no lift at 0°. Common on tails, helicopter blades and aerobatic aircraft that fly upside down.' },
  { label: 'NACA 2412', naca: '2412', title: 'NACA 2412', role: 'General-purpose section',
    about: 'Moderate camber and thickness. A forgiving all-rounder used on many light aircraft.' },
  { label: 'NACA 4415', naca: '4415', title: 'NACA 4415', role: 'High-lift section',
    about: 'Thick and strongly cambered, giving plenty of lift at low speed at the cost of extra drag.' },
  { label: 'NACA 6409', naca: '6409', title: 'NACA 6409', role: 'Thin, highly cambered section',
    about: 'Lots of lift for its thickness. Popular on slow model aircraft.' },

  { label: 'Cessna 172 Skyhawk (NACA 2412)', naca: '2412', title: 'Cessna 172 Skyhawk', role: 'Light aircraft',
    note: 'modified NACA 2412',
    about: 'The most-produced aircraft in history. A moderately cambered, forgiving section that stalls gently.' },
  { label: 'Supermarine Spitfire root (NACA 2213)', naca: '2213', title: 'Supermarine Spitfire', role: 'WWII fighter', part: 'root',
    about: 'A thin wing with light camber, chosen for low drag at high speed. It thins from 13% at the root to 9.4% at the tip.' },
  { label: 'Supermarine Spitfire tip (NACA 2209)', naca: '2209', title: 'Supermarine Spitfire', role: 'WWII fighter', part: 'tip',
    note: 'real tip is 9.4% thick',
    about: 'A thin wing with light camber, chosen for low drag at high speed. It thins from 13% at the root to 9.4% at the tip.' },
  { label: 'Douglas DC-3 root (NACA 2215)', naca: '2215', title: 'Douglas DC-3', role: 'Airliner', part: 'root',
    about: 'A thick root holds a strong spar for a heavy airliner, thinning sharply toward the tip.' },
  { label: 'Douglas DC-3 tip (NACA 2206)', naca: '2206', title: 'Douglas DC-3', role: 'Airliner', part: 'tip',
    about: 'A thick root holds a strong spar for a heavy airliner, thinning sharply toward the tip.' },
  { label: 'Boeing B-17 root (NACA 0018)', naca: '0018', title: 'Boeing B-17 Flying Fortress', role: 'WWII bomber', part: 'root',
    about: 'Symmetric sections, very thick at the root (18%) to carry the loads of a four-engine bomber.' },
  { label: 'Boeing B-17 tip (NACA 0010)', naca: '0010', title: 'Boeing B-17 Flying Fortress', role: 'WWII bomber', part: 'tip',
    about: 'Symmetric sections, very thick at the root (18%) to carry the loads of a four-engine bomber.' },
  { label: 'Mitsubishi A6M Zero root (NACA 2315)', naca: '2315', title: 'Mitsubishi A6M Zero', role: 'WWII fighter', part: 'root',
    about: 'The tip has more camber than the root, which helps keep the wingtips flying near the stall.' },
  { label: 'Mitsubishi A6M Zero tip (NACA 3309)', naca: '3309', title: 'Mitsubishi A6M Zero', role: 'WWII fighter', part: 'tip',
    about: 'The tip has more camber than the root, which helps keep the wingtips flying near the stall.' },
  { label: 'Bell P-39 Airacobra root (NACA 0015)', naca: '0015', title: 'Bell P-39 Airacobra', role: 'WWII fighter', part: 'root',
    about: 'A symmetric root section. The tip uses a NACA 5-digit section (23009), which this tool cannot build.' },
  { label: 'Aeronca Champion (NACA 4412)', naca: '4412', title: 'Aeronca Champion', role: 'Light trainer',
    about: 'A classic high-lift section used on many light trainers and utility aircraft.' },
  { label: 'Air Tractor AT-301 (NACA 4415)', naca: '4415', title: 'Air Tractor AT-301', role: 'Crop sprayer',
    about: 'Thick and strongly cambered, for lifting heavy loads at low speed.' }
];
