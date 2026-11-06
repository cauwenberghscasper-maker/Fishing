#!/usr/bin/env python3
"""Start-up check: build is served under /Fishing/ like GitHub Pages, opened at phone size.
usage: npm run build && python3 -I tools/smoke.py [out.png] [query]
Fails (exit 1) on page errors or when the game never becomes ready."""
import asyncio, os, shutil, socket, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'fishing-smoke.png')
QUERY = sys.argv[2] if len(sys.argv) > 2 else ''

async def main():
    site = tempfile.mkdtemp()
    shutil.copytree(os.path.join(ROOT, 'dist'), os.path.join(site, 'Fishing'))
    with socket.socket() as s_:
        s_.bind(('127.0.0.1', 0)); port = s_.getsockname()[1]   # free port: several agents run this at once
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    errors, logs = [], []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            pg.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
            pg.on('console', lambda m: (errors if m.type == 'error' and '404' not in m.text else logs).append(f'{m.type}: {m.text}'))
            await pg.goto(f'http://127.0.0.1:{port}/Fishing/{QUERY}', wait_until='load', timeout=60000)
            ready = False
            for _ in range(40):
                await pg.wait_for_timeout(500)
                if await pg.evaluate('!!window.__game'):
                    ready = True
                    break
            await pg.wait_for_timeout(4000)
            await pg.screenshot(path=OUT)
            await b.close()
    finally:
        srv.terminate()
        shutil.rmtree(site, ignore_errors=True)
    print(f'ready: {ready}  screenshot: {OUT}')
    for e in errors: print(e)
    if not ready or errors: sys.exit(1)

asyncio.run(main())
