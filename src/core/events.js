// Tiny event bus shared by every system. Event names and payloads: docs/INTERFACES.md
const handlers = new Map();

export const events = {
  on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => handlers.get(name)?.delete(fn);
  },
  once(name, fn) {
    const off = events.on(name, (p) => { off(); fn(p); });
    return off;
  },
  emit(name, payload) {
    const set = handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[events] ${name}`, err); }
    }
  },
};
