// Treasure chests (Casper 9 Nov: "a chest you can find with a slot function to get certain fish or
// rare upgrades, variable winning chance, must feel rewarding and be rare, with its own animation").
// A sunken chest (sea.js hot spot) is hauled up on the line (fishing/index.js); this screen is the
// opening: the chest rattles, the lid bursts open in a fan of light, and three brass reels spin.
// Wood gives 1 pull, silver 2, gold 3, and the better the chest the better the odds.
//   three of a kind: coins (big), pearls, a rare fish, an elemental fish, or a lucky charm
//   two of a kind:   a smaller prize of that kind
//   nothing:         a handful of coins (a chest is never empty)
// Every result is drawn first and the reels are animated to land on it; when the first two match
// the third reel slows and glows (the tease). Symbols are drawn here (no icon set).
import { h, fmt } from '../dom.js';
import { sfx } from '../sfx.js';
import { fishInfo, rosterFor, TIER_RANK } from '../../fishing/fishData.js';
import { variantTable } from '../../fishing/variants.js';

const SYM = {
  coin: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#e9b53d" stroke="#6b4512" stroke-width="3"/><circle cx="32" cy="32" r="17" fill="none" stroke="#fbe08a" stroke-width="2.5"/><path d="M22 33c6-7 14-7 20 0-6 7-14 7-20 0z M42 33l6-5v10z" fill="#6b4512"/></svg>`,
  pearl: `<svg viewBox="0 0 64 64"><path d="M8 40c4-14 44-14 48 0-6 10-42 10-48 0z" fill="#b28d64" stroke="#4d3418" stroke-width="3"/><circle cx="32" cy="30" r="13" fill="#f2f0ff" stroke="#6d6a8e" stroke-width="2.5"/><circle cx="27" cy="25" r="4" fill="#fff"/></svg>`,
  fish: `<svg viewBox="0 0 64 64"><path d="M6 32c10-14 30-16 42-4l10-8v24l-10-8C36 48 16 46 6 32z" fill="#4fb3c8" stroke="#123a48" stroke-width="3" stroke-linejoin="round"/><circle cx="18" cy="30" r="3" fill="#123a48"/><path d="M26 22c2 6 2 14 0 20" fill="none" stroke="#123a48" stroke-width="2"/></svg>`,
  gem: `<svg viewBox="0 0 64 64"><path d="M14 24l10-12h16l10 12-18 30z" fill="#7a5cff" stroke="#24135e" stroke-width="3" stroke-linejoin="round"/><path d="M14 24h36M24 12l8 12 8-12M32 24v30" fill="none" stroke="#c9b8ff" stroke-width="2"/></svg>`,
  charm: `<svg viewBox="0 0 64 64"><g stroke="#1f4a1c" stroke-width="2.5"><circle cx="24" cy="24" r="10" fill="#5fbf4a"/><circle cx="40" cy="24" r="10" fill="#5fbf4a"/><circle cx="24" cy="40" r="10" fill="#5fbf4a"/><circle cx="40" cy="40" r="10" fill="#5fbf4a"/></g><path d="M32 40c2 8 6 14 12 18" fill="none" stroke="#1f4a1c" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#d6f2a8"/></svg>`,
  anchor: `<svg viewBox="0 0 64 64"><g fill="none" stroke="#5b6670" stroke-width="5" stroke-linecap="round"><circle cx="32" cy="13" r="5"/><path d="M32 18v36M20 28h24M12 40c2 10 12 14 20 14s18-4 20-14"/></g></svg>`,
};
// Painted symbols (public/art/ui/slot_*.webp, art agent 13 Nov) replace the drawn ones.
for (const k of Object.keys(SYM)) SYM[k] = `<img src="art/ui/slot_${k}.webp" alt="" draggable="false">`;
const NAMES = { coin: 'Coins', pearl: 'Pearls', fish: 'A rare fish', gem: 'An elemental fish', charm: 'Lucky charm', anchor: 'Anchor' };
const STRIP = ['coin', 'anchor', 'pearl', 'fish', 'coin', 'gem', 'anchor', 'charm', 'pearl', 'coin', 'fish', 'anchor'];

const TIERS = {
  wood: { name: 'Sunken chest', pulls: 1, mult: 1, odds: { triple: 0.2, pair: 0.45 }, symbols: { coin: 42, pearl: 24, fish: 18, gem: 10, charm: 6 } },
  silver: { name: 'Silver chest', pulls: 2, mult: 2, odds: { triple: 0.32, pair: 0.48 }, symbols: { coin: 32, pearl: 24, fish: 22, gem: 13, charm: 9 } },
  gold: { name: 'Golden chest', pulls: 3, mult: 4, odds: { triple: 0.5, pair: 0.45 }, symbols: { coin: 24, pearl: 22, fish: 24, gem: 17, charm: 13 } },
};

const pickW = (table) => {
  let r = Math.random() * Object.values(table).reduce((a, b) => a + b, 0);
  for (const [k, w] of Object.entries(table)) if ((r -= w) <= 0) return k;
  return Object.keys(table)[0];
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function treasureChest(ctx, { tier = 'wood', onDone } = {}) {
  const { state, economy, ui, events } = ctx;
  const T = TIERS[tier] || TIERS.wood;
  const base = Math.max(120, Math.round(150 + (economy.incomePerMinute?.() || 0) * 5));
  let pulls = T.pulls;
  let spinning = false;
  const won = [];         // prize lines for the summary
  const pendingFish = []; // fish caught from the chest: landed after the screen closes

  // ---- prize logic
  function draw() {
    const r = Math.random();
    if (r < T.odds.triple) { const s = pickW(T.symbols); return { reels: [s, s, s], match: 3, sym: s }; }
    if (r < T.odds.triple + T.odds.pair) {
      const s = pickW(T.symbols);
      let o; do o = pick(Object.keys(SYM)); while (o === s);
      const reels = Math.random() < 0.6 ? [s, s, o] : Math.random() < 0.5 ? [s, o, s] : [o, s, s];
      return { reels, match: 2, sym: s };
    }
    // Nothing lines up; often the first two do and the third just misses (the tease is real).
    const a = pickW(T.symbols);
    let b, c;
    if (Math.random() < 0.45) { do c = pick(Object.keys(SYM)); while (c === a); return { reels: [a, a, c], match: 0 }; }
    do b = pick(Object.keys(SYM)); while (b === a);
    do c = pick(Object.keys(SYM)); while (c === a || c === b);
    return { reels: [a, b, c], match: 0 };
  }

  function rareFish(minRank, maxRank) {
    const ids = rosterFor(state, state.world?.islandId || 'driftwood_cove').filter((id) => {
      const info = fishInfo(state, id);
      const rk = TIER_RANK[info.tier] ?? 0;
      return rk >= minRank && rk <= maxRank && info.tier !== 'monster' && info.tier !== 'boss';
    });
    return ids.length ? pick(ids) : null;
  }
  function elementVariant() {
    const t = variantTable(state);
    const ids = Object.keys(t).filter((id) => t[id]?.kind === 'element');
    return ids.length ? pick(ids) : null;
  }
  function landFish(fishId, variant = 'basic') {
    const info = fishInfo(state, fishId);
    const [a, b] = info.weight || [0.5, 2];
    pendingFish.push({ fishId, variant, weight: a + (b - a) * (0.55 + Math.random() * 0.45), sizeClass: Math.random() < 0.25 ? 'trophy' : null, source: 'chest' });
    return info.name;
  }
  function charm(kind, casts) {
    const p = state.profile;
    const cur = p.charm?.kind === kind ? p.charm.casts : 0;
    p.charm = { kind, casts: cur + casts };
    events.emit('profile:changed', { keys: ['charm'] });
    return kind === 'rare' ? `Lucky charm: rare fish bite for ${p.charm.casts} casts` : `Glimmer charm: elementals ×4 for ${p.charm.casts} casts`;
  }

  function award(res) {
    const m = T.mult;
    if (res.match === 3) {
      switch (res.sym) {
        case 'coin': { const c = base * 3 * m; economy.grantTreasure({ coins: c }); return { big: true, text: `Jackpot! ${fmt(c)} coins`, coins: c }; }
        case 'pearl': { const p = 6 * m; economy.grantTreasure({ pearls: p }); return { big: true, text: `${p} pearls` }; }
        case 'fish': { const id = rareFish(tier === 'gold' ? 3 : 2, tier === 'wood' ? 3 : 5) || rareFish(1, 5); if (!id) break; return { big: true, text: `${landFish(id)}!` }; }
        case 'gem': { const id = rareFish(1, tier === 'gold' ? 4 : 3) || rareFish(0, 5); const v = elementVariant(); if (!id) break; const nm = landFish(id, v || 'basic'); const vn = variantTable(state)[v]?.name; return { big: true, text: `${vn ? vn + ' ' : ''}${nm}!` }; }
        case 'charm': return { big: true, text: charm('rare', 6 * (tier === 'gold' ? 2 : 1)) };
        default: break;
      }
    }
    if (res.match === 2) {
      switch (res.sym) {
        case 'pearl': { const p = 2 * m; economy.grantTreasure({ pearls: p }); return { text: `${p} pearls` }; }
        case 'gem': return { text: charm('element', 2 + m) };
        case 'charm': return { text: charm('rare', 2 + m) };
        default: { const c = Math.round(base * 0.7 * m); economy.grantTreasure({ coins: c }); return { text: `${fmt(c)} coins`, coins: c }; }
      }
    }
    const c = Math.round(base * 0.2 * m);
    economy.grantTreasure({ coins: c });
    return { text: `${fmt(c)} coins`, small: true, coins: c };
  }

  // ---- the machine
  const reels = [0, 1, 2].map(() => {
    const strip = h('div.chest__strip');
    const win = h('div.chest__window', strip);
    return { win, strip, at: Math.floor(Math.random() * STRIP.length) };
  });
  function fillStrip(r, landOn, laps) {
    // A long strip: laps × the symbol loop, ending on the wanted symbol.
    const cells = [];
    const L = STRIP.length;
    for (let i = 0; i <= laps * L; i++) cells.push(STRIP[(r.at - 1 + i + L) % L]);   // cell 1 = what shows now
    cells.push(landOn);
    cells.push(pick(Object.keys(SYM)));
    r.strip.replaceChildren(...cells.map((s) => h('div.chest__sym', { html: SYM[s], dataset: { s } })));
    r.at = STRIP.indexOf(landOn);
    return cells.length - 2;   // index of the landing cell
  }
  reels.forEach((r) => {
    r.strip.replaceChildren(...[STRIP[(r.at + STRIP.length - 1) % STRIP.length], STRIP[r.at], STRIP[(r.at + 1) % STRIP.length]].map((s) => h('div.chest__sym', { html: SYM[s] })));
    r.strip.style.transform = 'translateY(calc(var(--cell) * -0.5))';
  });

  const prize = h('div.chest__prize');
  const pullsEl = h('span.chest__pulls');
  const lever = h('button.chest__lever', { type: 'button', on: { click: () => spin() } }, h('span.chest__knob'), h('span.chest__leverlabel', 'Pull'));
  const collect = h('button.chest__collect', { type: 'button', hidden: true, on: { click: () => finish() } }, 'Collect');
  const lid = h('div.chest__lid');
  const box = h(`div.chest__box.is-${tier}`, h('div.chest__rays'), h('div.chest__glow'), h('div.chest__body', h('div.chest__lock')), lid);
  const coinsLayer = h('div.chest__coins');
  const machine = h('div.chest__machine', h('div.chest__reels', ...reels.map((r) => r.win), h('div.chest__payline')), h('div.chest__controls', pullsEl, lever));
  const root = h(`div.chest.is-${tier}`,
    h('div.chest__title', T.name),
    box, coinsLayer, machine, prize, collect);

  function setPulls() { pullsEl.textContent = pulls > 0 ? `${pulls} pull${pulls > 1 ? 's' : ''} left` : 'No pulls left'; }

  function burst(n, big) {
    for (let i = 0; i < n; i++) {
      const c = h('i.chest__coin', { style: { '--dx': `${(Math.random() - 0.5) * (big ? 340 : 200)}px`, '--dy': `${-120 - Math.random() * (big ? 260 : 140)}px`, '--r': `${Math.random() * 720 - 360}deg`, animationDelay: `${Math.random() * 0.25}s` } });
      coinsLayer.append(c);
      setTimeout(() => c.remove(), 1600);
    }
  }

  function spin() {
    if (spinning || pulls <= 0) return;
    spinning = true;
    pulls--;
    setPulls();
    lever.classList.remove('is-pulled'); void lever.offsetWidth; lever.classList.add('is-pulled');
    prize.classList.remove('is-shown', 'is-big');
    root.classList.remove('is-win', 'is-tease');
    reels.forEach((r) => r.win.classList.remove('is-hit'));
    sfx.creak();
    const res = draw();
    const tease = res.reels[0] === res.reels[1];
    const stops = [1100, 1650, tease ? 3300 : 2200];
    reels.forEach((r, i) => {
      const land = fillStrip(r, res.reels[i], 3 + i * 2 + (tease && i === 2 ? 3 : 0));
      r.strip.style.transition = 'none';
      r.strip.style.transform = 'translateY(calc(var(--cell) * -0.5))';
      void r.strip.offsetWidth;
      r.strip.style.transition = `transform ${stops[i]}ms cubic-bezier(.12,.62,.18,1.04)`;
      r.strip.style.transform = `translateY(calc(var(--cell) * ${0.5 - land}))`;   // landing cell on the payline
      // Clicks as symbols pass, slowing with the reel.
      let t = 0;
      const tickAt = () => { t += 40 + (t / stops[i]) * 140; if (t < stops[i] - 60) { setTimeout(() => { sfx.tick(); tickAt(); }, 40 + (t / stops[i]) * 140); } };
      if (i === 0) tickAt();
      setTimeout(() => { sfx.thud(); navigator.vibrate?.(15); if (i === 1 && tease) { root.classList.add('is-tease'); sfx.swell(); } }, stops[i]);
    });
    setTimeout(() => {
      spinning = false;
      root.classList.remove('is-tease');
      const out = award(res);
      won.push(out.text);
      const hit = res.match === 3 ? [0, 1, 2] : res.match === 2 ? [0, 1, 2].filter((i) => res.reels[i] === res.sym) : [];
      if (hit.length >= 2 && !out.small) hit.forEach((i) => reels[i].win.classList.add('is-hit'));
      prize.replaceChildren(h('b', out.big ? (res.sym === 'coin' ? 'JACKPOT' : 'THREE OF A KIND') : out.small ? 'Not this time…' : 'A pair!'), h('span', out.text));
      prize.classList.add('is-shown');
      if (out.big) { prize.classList.add('is-big'); root.classList.add('is-win'); sfx.fanfare(true); navigator.vibrate?.([40, 50, 90, 50, 140]); burst(28, true); for (let k = 0; k < 8; k++) sfx.coin(k * 0.07); }
      else if (!out.small) { sfx.fanfare(false); burst(12, false); sfx.coin(); sfx.coin(0.1); }
      else sfx.coin();
      if (pulls <= 0) { lever.disabled = true; collect.hidden = false; }
    }, stops[2] + 120);
  }

  let finished = false;
  function finish() {
    if (finished) return;
    if (spinning) return;
    // Unused pulls are spent for you (never lose a pull by closing).
    if (pulls > 0) { spin(); return; }
    finished = true;
    ui.close(view);
    ui.toast(`${T.name}: ${won.join(' · ')}`, '', { ms: 4200 });
    setTimeout(() => { for (const f of pendingFish) economy.grantFish(f); }, 250);
    onDone?.();
  }

  function play() {
    setPulls();
    lever.disabled = true;
    sfx.creak();
    navigator.vibrate?.([20, 40, 20, 40, 20]);
    root.classList.add('is-shaking');
    setTimeout(() => { root.classList.remove('is-shaking'); root.classList.add('is-open'); sfx.swell(); sfx.fanfare(tier === 'gold'); burst(tier === 'gold' ? 22 : 10, tier === 'gold'); }, 900);
    setTimeout(() => { root.classList.add('is-ready'); lever.disabled = false; }, 1600);
  }

  const view = {
    id: 'treasure',
    el: root,
    layerClass: 'is-chest',
    onOpen: play,
    dismiss: () => finish(),
  };
  return view;
}
