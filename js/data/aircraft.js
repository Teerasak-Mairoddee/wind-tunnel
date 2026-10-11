// Wing sections of well-known aircraft that use NACA 4-digit airfoils
// (the only family the generator builds). Sources: Wikipedia specification
// tables and the UIUC "Incomplete Guide to Airfoil Usage" (Lednicer).
// Thickness is rounded to a whole percent where the real section is fractional.
export const AIRCRAFT = [
  {
    name: 'Cessna 172 Skyhawk', role: 'Light aircraft',
    about: 'The most-produced aircraft in history. A moderately cambered, forgiving section that stalls gently.',
    sections: [{ part: 'Wing', naca: '2412', note: 'modified NACA 2412' }]
  },
  {
    name: 'Supermarine Spitfire', role: 'WWII fighter',
    about: 'A thin wing with light camber, chosen for low drag at high speed. It thins from 13% at the root to 9.4% at the tip.',
    sections: [{ part: 'Root', naca: '2213' }, { part: 'Tip', naca: '2209', note: 'real tip is 9.4% thick' }]
  },
  {
    name: 'Douglas DC-3', role: 'Airliner',
    about: 'A thick root holds a strong spar for a heavy airliner, thinning sharply toward the tip.',
    sections: [{ part: 'Root', naca: '2215' }, { part: 'Tip', naca: '2206' }]
  },
  {
    name: 'Boeing B-17 Flying Fortress', role: 'WWII bomber',
    about: 'Symmetric sections, very thick at the root (18%) to carry the loads of a four-engine bomber.',
    sections: [{ part: 'Root', naca: '0018' }, { part: 'Tip', naca: '0010' }]
  },
  {
    name: 'Mitsubishi A6M Zero', role: 'WWII fighter',
    about: 'The tip has more camber than the root, which helps keep the wingtips flying near the stall.',
    sections: [{ part: 'Root', naca: '2315' }, { part: 'Tip', naca: '3309' }]
  },
  {
    name: 'Bell P-39 Airacobra', role: 'WWII fighter',
    about: 'A symmetric root section. The tip uses a NACA 5-digit section (23009), which this tool cannot build.',
    sections: [{ part: 'Root', naca: '0015' }]
  },
  {
    name: 'Aeronca Champion', role: 'Light trainer',
    about: 'A classic high-lift section used on many light trainers and utility aircraft.',
    sections: [{ part: 'Wing', naca: '4412' }]
  },
  {
    name: 'Air Tractor AT-301', role: 'Crop sprayer',
    about: 'Thick and strongly cambered, for lifting heavy loads at low speed.',
    sections: [{ part: 'Wing', naca: '4415' }]
  }
];
