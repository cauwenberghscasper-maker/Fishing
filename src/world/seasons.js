// Seasons (Casper 12 Nov: "more world building with seasons"). The cove turns through four
// seasons, one per real day, so each day's fishing is different: the sea changes colour and each
// season favours something (data: public/data/sea.json "seasons"). Effects are read by the fish
// (fishAgents), the grounds (water colour) and the shop (sale prices).
const DAY = 86400000;

export function seasonFor(data, now = Date.now(), force = null) {
  const list = data?.sea?.seasons?.list ?? [];
  if (!list.length) return null;
  if (force) return list.find((s) => s.id === force) ?? list[0];
  // Local days, so the season turns at the player's midnight.
  const d = new Date(now);
  const day = Math.floor((now - d.getTimezoneOffset() * 60000) / DAY);
  return list[((day % list.length) + list.length) % list.length];
}

/** Sets state.world.season and the season's sale bonus; returns the season. */
export function applySeason(state, force = null) {
  const s = seasonFor(state.data, Date.now(), force);
  state.world.season = s;
  const sell = state.data?.economy?.sell;
  if (sell) sell.seasonMult = s?.effects?.sell ?? 1;
  return s;
}

export function hoursLeft(now = Date.now()) {
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Math.max(1, Math.ceil((end - now) / 3600000));
}
