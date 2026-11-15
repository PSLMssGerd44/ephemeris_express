/**
 * Curated landing-site catalog.
 *
 * Coordinates for historic/CLPS landings are the published landing points.
 * Artemis IV entries are REGION CENTERS (each region is ~15x15 km) and are
 * flagged approx: true — NASA selects specific sites within regions based on
 * launch timing. Sources: NASA Artemis III candidate-regions release (2022),
 * mission press kits, LROC coordinates for historic sites.
 */

export const SITES = [
  // --- Artemis IV candidate regions (south pole) ---
  { id: 'shackleton-peak', name: 'Shackleton Rim crest', lat: -89.7787, lon: 203.7574, group: 'Artemis IV regions', approx: false,
    note: 'Highest point of Shackleton’s rim, snapped from LOLA 80 m data (+1.74 km). Adjacent to the Artemis IV “Peak near Shackleton” region.' },
  { id: 'connecting-ridge', name: 'Connecting Ridge', lat: -89.45, lon: 222.8, group: 'Artemis IV regions', approx: true,
    note: 'High ridge linking Shackleton and de Gerlache (+1.96 km here) — among the most illuminated terrain on the Moon.' },
  { id: 'malapert-massif', name: 'Malapert Massif summit', lat: -85.9873, lon: 2.0888, group: 'Artemis IV regions', approx: false,
    note: 'Summit snapped from LOLA data (+5.17 km). Everything is downhill from here: near-continuous Sun and strong Earth view for DTE comms.' },
  { id: 'de-gerlache-rim', name: 'de Gerlache Rim crest', lat: -88.6651, lon: 291.5959, group: 'Artemis IV regions', approx: false,
    note: 'Highest point of de Gerlache’s rim (LOLA-snapped, +1.81 km), adjacent to permanently shadowed interior.' },
  { id: 'nobile-rim-1', name: 'Nobile Rim 1', lat: -85.2, lon: 36.5, group: 'Artemis IV regions', approx: true,
    note: 'High ground near Nobile crater (+6.8 km here per LOLA).' },
  { id: 'amundsen-rim', name: 'Amundsen Rim crest', lat: -82.886, lon: 77.9581, group: 'Artemis IV regions', approx: false,
    note: 'Highest point of Amundsen’s rim (LOLA-snapped, +4.26 km); large PSR on the crater floor below.' },

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
