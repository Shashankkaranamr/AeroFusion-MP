import sys, asyncio, time, os
from playwright.async_api import async_playwright
# usage: frames.py outdir t1 t2 ...   or  frames.py outdir --range N start end
async def main():
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    args = sys.argv[2:]
    if args[0] == "--range":
        N, a, b = int(args[1]), int(args[2]), int(args[3])
        jobs = [(i / (N - 1), f"frame_{i:04d}.png") for i in range(a, b)]
    else:
        jobs = [(float(t), f"t_{float(t):.3f}.png") for t in args]
    async with async_playwright() as p:
        br = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await br.new_page(viewport={"width":1920,"height":1080})
        logs=[]; pg.on("pageerror", lambda e: logs.append("ERR "+str(e))); pg.on("console", lambda m: logs.append(m.text) if m.type=="error" else None)
        await pg.goto("http://localhost:8765/anim.html")
        await pg.wait_for_function("window.__ready===true", timeout=240000)
        for t, name in jobs:
            t0=time.time()
            await pg.evaluate(f"window.renderAt({t})")
            await pg.screenshot(path=os.path.join(out, name))
            print(name, round(time.time()-t0,1), flush=True)
        print("\n".join(logs[:10]))
        await br.close()
asyncio.run(main())
