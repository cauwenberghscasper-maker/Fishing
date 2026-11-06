// The one line Casper changes to switch the game's typography.
// Options: 'chartroom' (IM Fell English SC + Alegreya Sans), 'dockside' (Caprasimo + Signika),
//          'lantern' (Kalnia + Faculty Glyphic). Specimen: docs/type-specimen.html
export const TYPE_PAIRING = 'chartroom';

// Preview another pairing in-game without editing code: ?type=dockside
export function activePairing() {
  const q = new URLSearchParams(location.search).get('type');
  return ['chartroom', 'dockside', 'lantern'].includes(q) ? q : TYPE_PAIRING;
}
