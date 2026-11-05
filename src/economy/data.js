// Agent B owns this file. Loads public/data/*.json into state.data.
export async function loadData(state) {
  const names = ['fish', 'islands', 'items', 'economy', 'fish-behaviour'];
  for (const name of names) {
    try {
      const res = await fetch(`data/${name}.json`);
      if (res.ok) state.data[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = await res.json();
    } catch { /* file not created yet */ }
  }
}
