/**
 * Curated landing-site catalog.
 *
 * Coordinates for historic/CLPS landings are the published landing points.
 * Artemis III entries are REGION CENTERS (each region is ~15x15 km) and are
 * flagged approx: true — NASA selects specific sites within regions based on
 * launch timing. Sources: NASA Artemis III candidate-regions release (2022),
 * mission press kits, LROC coordinates for historic sites.
 */

export const SITES = [
  // --- Artemis III candidate regions (south pole) ---
  { id: 'shackleton-peak', name: 'Peak near Shackleton', lat: -89.66, lon: 129.2, group: 'Artemis III regions', approx: true,
    note: 'Elevated terrain between Shackleton and Slater craters. Validation site for this tool.' },
  { id: 'connecting-ridge', name: 'Connecting Ridge', lat: -89.45, lon: 222.8, group: 'Artemis III regions', approx: true,
    note: 'High ridge linking Shackleton and de Gerlache — among the most illuminated terrain on the Moon.' },
  { id: 'malapert-massif', name: 'Malapert Massif', lat: -85.99, lon: 2.92, group: 'Artemis III regions', approx: true,
    note: 'Mountain ~5 km above surroundings; strong Earth visibility for DTE comms.' },
  { id: 'de-gerlache-rim', name: 'de Gerlache Rim 1', lat: -88.66, lon: 273.0, group: 'Artemis III regions', approx: true,
    note: 'Rim of de Gerlache crater, adjacent to permanently shadowed interior.' },
  { id: 'nobile-rim-1', name: 'Nobile Rim 1', lat: -85.2, lon: 36.5, group: 'Artemis III regions', approx: true,
    note: 'Northeast rim of Nobile crater.' },
  { id: 'amundsen-rim', name: 'Amundsen Rim', lat: -84.25, lon: 82.8, group: 'Artemis III regions', approx: true,
    note: 'Rim of Amundsen crater; large PSR on the crater floor.' },

  // --- CLPS & recent robotic missions ---
  { id: 'im2-athena', name: 'IM-2 Athena (Mons Mouton)', lat: -84.79, lon: 29.19, group: 'CLPS & robotic', approx: false,
    note: 'Intuitive Machines 2, March 2025. Mons Mouton plateau (formerly Leibnitz Beta).' },
  { id: 'im1-odysseus', name: 'IM-1 Odysseus (Malapert A)', lat: -80.13, lon: 1.44, group: 'CLPS & robotic', approx: false,
    note: 'Intuitive Machines 1, Feb 2024 — first commercial lunar landing.' },
  { id: 'blue-ghost-1', name: 'Blue Ghost M1 (Mare Crisium)', lat: 18.56, lon: 61.81, group: 'CLPS & robotic', approx: false,
    note: 'Firefly Blue Ghost Mission 1, March 2025, near Mons Latreille.' },
  { id: 'chandrayaan-3', name: 'Chandrayaan-3 (Statio Shiv Shakti)', lat: -69.373, lon: 32.319, group: 'CLPS & robotic', approx: false,
    note: 'ISRO, Aug 2023 — southernmost landing at the time.' },
  { id: 'change-4', name: "Chang'e 4 (Von Kármán)", lat: -45.444, lon: 177.588, group: 'CLPS & robotic', approx: false,
    note: 'CNSA, Jan 2019 — first far-side landing. No direct Earth view: relay required (watch Earth stay below horizon!).' },

  // --- Historic ---
  { id: 'apollo-11', name: 'Apollo 11 (Tranquility Base)', lat: 0.67416, lon: 23.47314, group: 'Historic', approx: false,
    note: 'July 1969. Compare its benign equatorial lighting with the polar sites.' },
  { id: 'apollo-17', name: 'Apollo 17 (Taurus-Littrow)', lat: 20.1908, lon: 30.7717, group: 'Historic', approx: false,
    note: 'Dec 1972 — last crewed landing.' },
];

export function getSite(id) {
  return SITES.find((s) => s.id === id);
}
