// Hand-drawn ink icons for the UI (Agent B, original work — no icon set).
// Stroke icons use currentColor; coin and pearl carry their own metal/nacre colours.
const S = (body, extra = '') =>
  `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const icons = {
  // gold doubloon stamped with a fish
  coin: () => `<svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13.5" fill="#e2b04a" stroke="#5e3f12" stroke-width="1.6"/>
    <circle cx="16" cy="16" r="10.4" fill="none" stroke="#9a6d22" stroke-width="1.2" stroke-dasharray="1.4 1.6"/>
    <path d="M8.6 16.2c2.6-3.8 7.4-4.4 11.1-1.2l3.4-2.6v7.6l-3.4-2.6c-3.7 3.2-8.5 2.6-11.1-1.2z" fill="#8a5f1c"/>
    <circle cx="11.6" cy="15.5" r="0.95" fill="#f3d78f"/>
    <path d="M6.7 11.6a10.6 10.6 0 0 1 5.8-5.3" fill="none" stroke="#fff1c4" stroke-width="1.5" stroke-linecap="round" opacity=".85"/>
  </svg>`,
  // lustrous pearl
  pearl: () => `<svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16.5" r="10.5" fill="#dfe8e6" stroke="#40545b" stroke-width="1.4"/>
    <path d="M7.4 20.5a10 10 0 0 0 17.2 0" fill="none" stroke="#9fb7b6" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="12.5" cy="12.5" r="3.2" fill="#fff"/>
    <circle cx="19.5" cy="20" r="1.4" fill="#f6d8e4" opacity=".9"/>
  </svg>`,
  // fish crate with a tail sticking out under the lid
  cooler: () => S(`<path d="M5.5 13h21v13.5h-21z"/><path d="M4 9.5h24V13H4z"/><path d="M5.5 19.7h21"/><path d="M12 26.5v-6.8M20 26.5v-6.8" stroke-width="1.3"/><path d="M13 9.5c0-2.8 6-2.8 6 0"/><path d="M22.5 9.5c.6-2 2-3.6 4.4-4.4-.7 1.6-.6 3 .2 4.4"/>`),
  // open logbook with ribbon
  logbook: () => S(`<path d="M16 9.2c-3.2-2.2-7.3-2.7-11.3-2v17.3c4-.6 8.1-.1 11.3 2 3.2-2.1 7.3-2.6 11.3-2V7.2c-4-.7-8.1-.2-11.3 2z"/><path d="M16 9.2v17.2"/><path d="M8 12.5h5M8 16h5M8 19.5h3.5M19 16h5M19 19.5h5" stroke-width="1.4"/><path d="M20.5 7.6v6.6l1.7-1.6 1.7 1.6V7.1" stroke-width="1.5"/>`),
  // chart dividers (settings)
  dividers: () => S(`<circle cx="16" cy="7.5" r="2.6"/><path d="M16 4.9V2.5"/><path d="M14.6 9.7 8.2 28M17.4 9.7 23.8 28"/><path d="M10.6 21.4c3.6 1.6 7.2 1.6 10.8 0" stroke-width="1.4"/>`),
  close: () => S(`<path d="M8.5 8.5l15 15M23.5 8.5l-15 15" stroke-width="2.6"/>`),
  bell: () => S(`<path d="M9.6 22.5c1.1-2.2 1.2-4.4 1.2-8.2a5.2 5.2 0 0 1 10.4 0c0 3.8.1 6 1.2 8.2z"/><path d="M7.5 22.5h17"/><path d="M16 9.1V6.2"/><path d="M14.2 6.2h3.6" stroke-width="1.5"/><circle cx="16" cy="25.6" r="1.7"/>`),
  bellOff: () => S(`<path d="M9.6 22.5c1.1-2.2 1.2-4.4 1.2-8.2a5.2 5.2 0 0 1 10.4 0c0 3.8.1 6 1.2 8.2z"/><path d="M7.5 22.5h17"/><path d="M16 9.1V6.2"/><circle cx="16" cy="25.6" r="1.7"/><path d="M5.5 5.5l21 21" stroke-width="2.4"/>`),
  // spring scale on a hook (shop / weight)
  scale: () => S(`<circle cx="16" cy="4.8" r="2"/><path d="M13 7.6h6v11.6h-6z"/><path d="M15 10.6h2M15 13.4h2M15 16.2h2" stroke-width="1.3"/><path d="M16 19.2v4.4a3.6 3.6 0 1 1-6.6-2"/>`),
  // compass rose (travel)
  compass: () => S(`<circle cx="16" cy="16" r="11.5" stroke-width="1.5"/><path d="M16 2.5l2.4 11.1L29.5 16l-11.1 2.4L16 29.5l-2.4-11.1L2.5 16l11.1-2.4z" stroke-width="1.5"/><path d="M16 2.5l2.4 11.1L16 16z" fill="currentColor" stroke="none"/><path d="M29.5 16l-11.1 2.4L16 16z" fill="currentColor" stroke="none"/>`),
  // claw hammer (build)
  hammer: () => S(`<path d="M7 6.5h11.5l4.5 3.6-3.3 1.6-2.4-1.6H7z"/><path d="M13.8 10.1v17.4"/><path d="M12.4 22h2.8M12.4 25h2.8" stroke-width="1.2"/>`),
  // sou'wester hat (hire a fisher)
  hat: () => S(`<path d="M3 21.4c5 2.6 21 2.6 26 0-1.8-1.5-4.8-2.1-6.8-2.1l-1.2-7c-.6-3.2-3-4.7-5-4.7s-4.4 1.5-5 4.7l-1.2 7c-2 0-5 .6-6.8 2.1z"/><path d="M10.8 16.2h10.4" stroke-width="1.4"/><path d="M11.5 22.6l-2.2 6M20.5 22.6l2.2 6" stroke-width="1.4"/>`),
  lock: () => S(`<path d="M8.5 14h15v12.5h-15z"/><path d="M11.5 14v-3.6a4.5 4.5 0 0 1 9 0V14"/><circle cx="16" cy="19" r="1.5"/><path d="M16 20.5v2.7"/>`),
  // island rising from the waves (land plot)
  plot: () => S(`<path d="M3 25c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0 4 1.6 6 0"/><path d="M6.5 21.5c2-5.2 5.4-8 9.5-8s7.5 2.8 9.5 8"/><path d="M18.6 13.6c-.2-3 .3-5.6 1.3-7.3M19.9 6.3c-2.1-.6-4.1 0-5.3 1.5M19.9 6.3c2-1.1 4.1-.7 5.3.9M19.9 6.3c1.2 1.4 1.4 3.1.9 4.7" stroke-width="1.5"/>`),
  // ink check
  check: () => S(`<path d="M6 17.2l6 5.8L26.5 8" stroke-width="2.6"/>`),
  // rosette (record)
  rosette: () => S(`<circle cx="16" cy="12" r="7"/><circle cx="16" cy="12" r="3.4" stroke-width="1.3"/><path d="M12 18.2 9.3 28l3.8-1.8 2 2.8 1-9M20 18.2l2.7 9.8-3.8-1.8-2 2.8-1-9" stroke-width="1.5"/>`),
  hourglass: () => S(`<path d="M8.5 4h15M8.5 28h15"/><path d="M10 4c0 6 5 8.8 6 12-1 3.2-6 6-6 12M22 4c0 6-5 8.8-6 12 1 3.2 6 6 6 12"/><path d="M12.8 25.5c1-1.6 2.2-2.4 3.2-2.4s2.2.8 3.2 2.4z" fill="currentColor" stroke="none"/>`),
  fish: () => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2.5 16c4-6 13-8.2 20-3.2l6.5-5v16.4l-6.5-5c-7 5-16 2.8-20-3.2z" fill="currentColor"/></svg>`,
  // flame of the hot fish of the day
  flame: () => S(`<path d="M16 28c-5 0-8-3.4-8-7.6 0-5 4.4-7.4 4.6-12.4 3.2 2 4.6 5 4.4 7.6 1.2-1 2-2.6 2.2-4.2 2.6 2.4 4.8 5.4 4.8 9 0 4.2-3 7.6-8 7.6z"/><path d="M16 28c-2 0-3.4-1.4-3.4-3.3 0-2.2 2-3.4 2.3-5.6 2.5 1.6 4.5 3.4 4.5 5.6 0 1.9-1.4 3.3-3.4 3.3z" stroke-width="1.4"/>`),
  // ---- slot / section icons (round 3 kit)
  rod: () => S(`<path d="M5 28 27 4"/><path d="M27 4c1.5 6 1 11-1 16" stroke-width="1.2"/><circle cx="9.5" cy="23.5" r="2.6" stroke-width="1.6"/><path d="M5 28l2.5-2.5" stroke-width="3.2"/>`),
  reel: () => S(`<circle cx="15" cy="17" r="9"/><circle cx="15" cy="17" r="3.2" stroke-width="1.5"/><path d="M15 8v-3h6" stroke-width="1.6"/><path d="M22.5 22.5l4 4" stroke-width="2.4"/><circle cx="27.5" cy="27.5" r="1.8" fill="currentColor" stroke="none"/>`),
  line: () => S(`<ellipse cx="16" cy="16" rx="11" ry="6"/><ellipse cx="16" cy="16" rx="7" ry="3.6" stroke-width="1.4"/><path d="M27 16c3 3 2 9-2 12" stroke-width="1.3"/>`),
  hook: () => S(`<circle cx="18" cy="4.8" r="2"/><path d="M18 7v13a6 6 0 1 1-11-3"/><path d="M7 17l-1.5 3.5L9 19" stroke-width="1.6"/>`),
  sinker: () => S(`<path d="M16 3v6"/><circle cx="16" cy="3.5" r="1.5" stroke-width="1.4"/><path d="M11 12c0-2 10-2 10 0l3 12c0 4-16 4-16 0z"/><path d="M12 18h8" stroke-width="1.2"/>`),
  float: () => S(`<path d="M16 2v6"/><path d="M16 8c4 0 6 4 6 8s-2 8-6 8-6-4-6-8 2-8 6-8z"/><path d="M10.3 15h11.4" stroke-width="1.6"/><path d="M16 24v6"/><path d="M4 18c3-1.5 5 1.5 8 0M20 18c3-1.5 5 1.5 8 0" stroke-width="1.2"/>`),
  leader: () => S(`<path d="M16 2v8M16 22v8"/><path d="M13 10h6l-3 3zM13 22h6l-3-3z" stroke-width="1.5"/><path d="M16 13v6" stroke-width="3" stroke-dasharray="1.5 1.5"/>`),
  lure: () => S(`<path d="M6 16c4-7 14-8 20-3-5 6-15 8-20 3z"/><circle cx="21" cy="14" r="1.4" fill="currentColor" stroke="none"/><path d="M6 16l-3 4M3 12l3 4" stroke-width="1.5"/><path d="M14 19v5a3 3 0 0 1-5 2" stroke-width="1.5"/>`),
  net: () => S(`<path d="M4 28l9-9"/><ellipse cx="20" cy="11" rx="9" ry="7.5" transform="rotate(-35 20 11)"/><path d="M14 9l10 8M17 5l9 8M13 13l7 6M18 4l-5 10M22 6l-6 11M26 9l-6 9" stroke-width="1"/>`),
  worm: () => S(`<path d="M5 22c3-6 7 2 10-4s7 2 10-4"/><circle cx="25.5" cy="13.5" r="1" fill="currentColor" stroke="none"/><path d="M3 26h26" stroke-width="1.2" stroke-dasharray="2 3"/>`),
  house: () => S(`<path d="M4 15 16 5l12 10"/><path d="M7 13v14h18V13"/><path d="M13 27v-7h6v7"/><path d="M20 9V5h3v6.5" stroke-width="1.5"/>`),
  pier: () => S(`<path d="M3 13h26"/><path d="M3 17h26" stroke-width="1.4"/><path d="M7 17v11M14 17v11M21 17v11M27 17v11"/><path d="M3 25c3-1.5 5 1.5 8 0s5 1.5 8 0 5 1.5 8 0" stroke-width="1.2"/>`),
  crew: () => S(`<circle cx="11" cy="10" r="3.5"/><circle cx="22" cy="10" r="3.5"/><path d="M4 26c0-6 4-9 7-9s7 3 7 9M15 26c0-6 4-9 7-9s7 3 7 9"/>`),
  wrench: () => S(`<path d="M20 4a6 6 0 0 0-5.5 8.2L4 22.7 9.3 28l10.5-10.5A6 6 0 0 0 28 12l-4 4-4-1-1-4 4-4a6 6 0 0 0-3-1.5z"/>`),
  crack: () => S(`<path d="M16 2l-4 9 6 3-5 8 3 8" stroke-width="2.6"/>`),
  boat: () => S(`<path d="M4 20.5h24l-3.5 6h-17z"/><path d="M15.5 20.5V4.5"/><path d="M15.5 6c5 3 8.4 8 9 12.5h-9z" stroke-width="1.6"/><path d="M14.5 8c-3.6 2.8-6 6.4-6.6 10.5h6.6" stroke-width="1.6"/>`),
};

export const icon = (name) => (icons[name] ? icons[name]() : '');
