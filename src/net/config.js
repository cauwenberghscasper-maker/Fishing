// Agent H. Co-op settings. The publishable key is meant for the browser (Supabase "publishable"
// keys only allow what the project exposes publicly: here Realtime broadcast + presence, no tables).
export const SUPABASE_URL = 'https://lhnayyewhxgsamwwmcxe.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_BhtUOXQcdLGsfggXPhxseg_vLCJ29RL';

export const PROTOCOL = 1;          // bump when messages change shape; mismatched clients are told to reload
export const MAX_PLAYERS = 4;       // host + 3 visitors (master prompt 4.10)

// Rates (see docs/handoff/agent-h.md, "Budget"). Worst case for a full room stays under 30 deliveries/s.
export const STATE_HZ = 4;          // own player state, only while something changes
export const BUNDLE_HZ = 4;         // host → everyone: relayed states + events (+ fish every other tick)
export const FISH_EVERY = 2;        // fish snapshot every Nth bundle tick → 2 Hz
export const FIGHT_HZ = 2;          // fight progress while fighting
export const FISH_RADIUS = 26;      // only fish this close to a player are sent
export const INTERP_MS = 150;       // playout buffer for remote players
export const FISH_INTERP_MS = 600;  // playout buffer for host fish (2 Hz)

// Liveness
export const HOST_GRACE_MS = 12000;     // visitors wait this long for a host that dropped
export const VISITOR_GRACE_MS = 20000;  // the host keeps a dropped visitor's slot this long
export const JOIN_TIMEOUT_MS = 9000;

// Co-op actions
export const HELP_RADIUS = 4.5;     // metres: "Net it!" shows when this close to a friend who is fighting
export const HELP_COOLDOWN_MS = 800;
export const EMOTE_COOLDOWN_MS = 1500;

// Room codes: no 0/O, 1/I/L. Every symbol has a maritime signal flag (see flags.js).
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

// Player colours: painted from the cove (signal red, chart blue, gilt, sea glass, coral, lantern
// amber, bioluminescent teal, mussel violet). Each reads on the sea and on chart paper.
export const COLORS = ['#d2402e', '#2f74b5', '#e2b04a', '#57b98f', '#ef8a6c', '#f0a83c', '#3fd6c2', '#9a72d0'];
