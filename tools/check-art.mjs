#!/usr/bin/env node
// "Everything generated gets used": lists shipped art that nothing references,
// and registry/manifest entries whose file is missing.
// usage: node tools/check-art.mjs        (exit 1 when something is unused or missing)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname, posix } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = join(ROOT, 'public');
const ART_EXT = new Set(['.glb', '.gltf', '.webp', '.png', '.jpg', '.jpeg', '.ktx2', '.woff2', '.woff', '.ogg', '.mp3', '.wav', '.svg']);
const ARCHIVE = /(^|\/)(_rejected|_takes)(\/|$)/;

const walk = (dir) => (existsSync(dir) ? readdirSync(dir) : []).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (p, base) => relative(base, p).split('\\').join('/');
const norm = (p) => posix.normalize(p).replace(/^\.\//, '');

const used = new Set();          // public-relative paths (or art/... for concepts)
const patterns = [];             // regexes from template strings in code
const missing = [];
const planned = [];              // registered with planned: true — not generated yet, the game skips them

// 1. code + html + css: literal paths and `${}` templates
const texts = [...walk(join(ROOT, 'src')), join(ROOT, 'index.html'), ...walk(PUB).filter((p) => /\.(css|json|html|js)$/.test(p))]
  .filter((p) => /\.(js|mjs|css|html|json)$/.test(p) && existsSync(p));
for (const file of texts) {
  const txt = readFileSync(file, 'utf8');
  for (const m of txt.matchAll(/[`'"(]([^`'"()\s]*\.(?:glb|gltf|webp|png|jpe?g|ktx2|woff2?|ogg|mp3|wav|svg))[`'")]/g)) {
    const raw = m[1];
    if (raw.includes('${')) {
      const rx = raw.replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/\\?\$\{[^}]*\}/g, '[^/]+').replace(/\{|\}/g, '');
      patterns.push(new RegExp('(^|/)' + rx + '$'));
    } else {
      // relative refs (css url(), json paths) resolve against the file's folder if inside public
      const inPub = file.startsWith(PUB);
      const base = inPub ? rel(dirname(file), PUB) : '';
      used.add(norm(raw.replace(/^\//, '')));
      if (inPub && !raw.startsWith('assets/') && !raw.startsWith('art/')) used.add(norm(posix.join(base, raw)));
    }
  }
}

// 2. manifests + art registry: path / preview / concept fields
const registries = walk(PUB).filter((p) => p.endsWith('manifest.json') || p.endsWith(join('data', 'art.json')));
for (const file of registries) {
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { console.log(`BROKEN JSON  ${rel(file, ROOT)}`); process.exitCode = 1; continue; }
  const visit = (node, key, isPlanned = false) => {
    if (!node || typeof node !== 'object') return;
    isPlanned = isPlanned || node.planned === true;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && ['path', 'preview', 'concept', 'texture', 'image', 'icon', 'topView', 'sideView'].includes(k)) {
        const p = norm(v.replace(/^\//, ''));
        used.add(p);
        // concept images live in the repo's art/concepts/; everything else is public-relative (incl. public/art/)
        const onDisk = p.startsWith('art/concepts/') ? join(ROOT, p) : join(PUB, p);
        if (!existsSync(onDisk)) (isPlanned ? planned : missing).push(`${rel(file, ROOT)} → ${key ?? ''}.${k}: ${p}`);
      } else if (typeof v === 'object') visit(v, key ?? k, isPlanned);
    }
  };
  visit(json);
}

// 3. textures referenced from inside .glb files
for (const glb of walk(PUB).filter((p) => p.endsWith('.glb'))) {
  const buf = readFileSync(glb);
  if (buf.readUInt32LE(0) !== 0x46546c67) continue;
  const len = buf.readUInt32LE(12);
  try {
    const gltf = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
    for (const img of gltf.images ?? []) if (img.uri && !img.uri.startsWith('data:')) used.add(norm(posix.join(rel(dirname(glb), PUB), img.uri)));
  } catch { /* not our problem here */ }
}

// 4. design references in the master prompt count for concept art only
const prompt = existsSync(join(ROOT, 'docs/MASTER_PROMPT.md')) ? readFileSync(join(ROOT, 'docs/MASTER_PROMPT.md'), 'utf8') : '';
for (const m of prompt.matchAll(/`(art\/concepts\/[^`]+)`/g)) used.add(norm(m[1]));

const isUsed = (p) => used.has(p) || patterns.some((rx) => rx.test(p));

const shipped = walk(PUB).filter((p) => ART_EXT.has(extname(p).toLowerCase())).map((p) => rel(p, PUB));
const uiTextures = walk(join(ROOT, 'src')).filter((p) => ART_EXT.has(extname(p).toLowerCase()));
const concepts = walk(join(ROOT, 'art/concepts')).filter((p) => ART_EXT.has(extname(p).toLowerCase())).map((p) => rel(p, ROOT));

const unused = [
  ...shipped.filter((p) => !isUsed(p)),
  ...uiTextures.filter((p) => !texts.some((t) => t !== p && readFileSync(t, 'utf8').includes(p.split('/').pop()))).map((p) => rel(p, ROOT)),
  ...concepts.filter((p) => !ARCHIVE.test(p) && !isUsed(p)),
];
const archived = concepts.filter((p) => ARCHIVE.test(p)).length;

console.log(`shipped art files: ${shipped.length}, concept images: ${concepts.length - archived} (+${archived} archived takes/rejects)`);
if (unused.length) { console.log(`\nUNUSED (${unused.length}) — nothing references these:`); unused.forEach((p) => console.log('  ' + p)); }
if (missing.length) { console.log(`\nMISSING (${missing.length}) — registered but no file:`); missing.forEach((p) => console.log('  ' + p)); }
if (planned.length) console.log(`\nPLANNED (${planned.length}) — registered with planned: true, not generated yet (the game skips these):`), planned.forEach((p) => console.log('  ' + p));
if (!unused.length && !missing.length) console.log(planned.length ? 'OK so far: everything shipped is used; planned art still to make.' : 'OK: every art file is used and every entry has its file.');
if (unused.length || missing.length) process.exitCode = 1;

// Wired check (Casper: "the game is missing already generated art"): a registered 2D art entry only counts
// when game code asks for it: by its key, by a `prefix.${…}` template, or by its file path.
{
  const artFile = join(PUB, 'data', 'art.json');
  if (existsSync(artFile)) {
    const art = JSON.parse(readFileSync(artFile, 'utf8'));
    const code = walk(join(ROOT, 'src')).filter((p) => /\.(js|css)$/.test(p)).map((p) => readFileSync(p, 'utf8')).join('\n');
    const notWired = Object.entries(art).filter(([key, v]) => {
      if (!v || v.planned) return false;
      const prefix = key.split('.').slice(0, -1).join('.');
      const prefix1 = key.split('.')[0];
      return !(code.includes(`'${key}'`) || code.includes(`"${key}"`) || code.includes(`\`${key}\``)
        || code.includes(`${prefix}.\${`) || code.includes("`" + prefix + ".") || code.includes(`'${prefix1}.' +`) || code.includes(`\`${prefix1}.\${`)
        || (v.path && code.includes(v.path)));
    }).map(([k]) => k);
    if (notWired.length) {
      console.log(`\nNOT SHOWN IN THE GAME (${notWired.length}) — made and registered, but no code asks for it:`);
      notWired.forEach((k) => console.log('  ' + k));
      process.exitCode = 1;
    }
  }
}
