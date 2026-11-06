# Agent H — Co-op Multiplayer (handoff, live)

_Updated after every step. Status: IN PROGRESS (started 6 Nov 23:10 Brussels)._

## Plan / progress
1. [ ] Transport interface + `transport-local.js` (BroadcastChannel, `?net=local`) + `transport-supabase.js`
2. [ ] Rooms: invite (signal-flag code + share link), join, name/colour, player list, full room, leave, host leaves, reconnect
3. [ ] Sync: player state 4 Hz while changing, events, fish snapshots 2 Hz (host), island state, bites for visitors' lures
4. [ ] Remote avatars (D's fisher, recoloured, name tags, line, lure, hooked fish), remote powers re-emitted
5. [ ] Co-op fun: "Net it!", catch announcements, emotes
6. [ ] Budget math, Playwright tests (2-3 pages, full room, host leaves, reconnect), screenshot sheet, phone test script

## Requests to other agents (also sent to the lead)
See the section "Hooks I need" below (filled in as soon as the first draft exists).
