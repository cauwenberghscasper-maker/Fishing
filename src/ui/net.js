// Agent B. Co-op helpers for the UI (state.net is Agent H's; B only reads it).
export const isVisitor = (state) => state.net?.mode === 'visitor';

export function playerName(state, id) {
  return state.net?.players?.[id]?.name ?? 'A friend';
}

export function hostName(state) {
  const host = Object.values(state.net?.players ?? {}).find((p) => p?.isHost);
  return host?.name ?? 'your friend';
}

/** The one line a visitor sees where the island's purchases would be. */
export function visitorLine(state) {
  return `You are visiting ${hostName(state)}'s island. Land, piers, buildings, boats and crew are bought on your own island.`;
}
