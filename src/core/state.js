// Shared runtime state. Shape and ownership: docs/INTERFACES.md
export const state = {
  profile: null,        // Agent B: the saved player profile (coins, gear, catches, island, buildings...)
  gear: null,           // Agent B: derived gear stats { rodPower, castDistance, steadiness, reelSpeed, lineStrength, baitId }
  data: {},             // Agent B loads public/data/*.json here: { fish, islands, items, economy }; Agent A adds fishBehaviour
  world: {              // Agent A
    islandId: 'driftwood_cove',
    mode: 'explore',    // explore | aim | wait | hooked | fight | catch | menu
    zone: null,         // id of the interaction zone the player stands in (e.g. 'shop', 'pier_1')
  },
  net: {                // Agent H: co-op. 'solo' until the player hosts or joins (docs/INTERFACES.md)
    mode: 'solo',       // solo | host | visitor
    room: null,
    selfId: null,
    players: {},
  },
  test: new URLSearchParams(location.search).get('test') === '100',
};
