#!/usr/bin/env python3
"""Render the trailer to MP4.

    python3 -m http.server 8768 --directory public &
    node scripts/trailer/mix.mjs out/trailer/mix.wav
    python3 scripts/trailer/render.py --out out/trailer/protocole-h-trailer.mp4

The 60-second social cut (public/trailer/timeline-60.js):

    node scripts/trailer/mix.mjs out/trailer/mix-60.wav --cut 60
    python3 scripts/trailer/render.py --cut 60 --gpu --scale 2

--gpu renders WebGL on the real GPU through ANGLE/Vulkan (~0.1 s a frame on
Intel Iris Xe) instead of SwiftShader on the CPU (~6 s a frame at 1080p).
--scale 2 supersamples: every frame is drawn at twice the size, then reduced.

Frames are captured from public/trailer/?render=1 with Playwright (the page
exposes window.__trailer.seek(t)), then muxed with the ffmpeg mix.
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


SOFTWARE_GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
GPU_GL = ["--use-angle=vulkan", "--enable-features=Vulkan", "--enable-gpu", "--ignore-gpu-blocklist"]


async def capture(url, frames_dir, width, height, fps, start, end, voices, warmup=0.0, gpu=False, scale=1):
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=GPU_GL if gpu else SOFTWARE_GL)
        page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
        page.set_default_timeout(0)
        page.on("pageerror", lambda e: print("pageerror:", e, file=sys.stderr))
        await page.goto(url, wait_until="load")
        await page.wait_for_function("window.__trailer && window.__trailer.ready", timeout=120000)
        print("webgl:", await page.evaluate("window.__trailer.gl"), flush=True)
        if voices:
            await page.evaluate("(m) => window.__trailer.setVoiceDurations(m)", voices)
        if end is None:
            end = await page.evaluate("window.__trailer.duration")
        first = int(round(start * fps))
        last = int(round(end * fps))
        for i in range(max(0, first - int(round(warmup * fps))), first):
            await page.evaluate(f"window.__trailer.seek({i / fps})")
        for i in range(first, last):
            t = i / fps
            await page.evaluate(f"window.__trailer.seek({t})")
            await page.screenshot(path=str(frames_dir / f"f{i:05d}.jpg"), type="jpeg", quality=96)
            if i % (fps * 5) == 0:
                print(f"  {t:6.1f}s / {end:.0f}s", flush=True)
        await browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cut", help="render a shorter cut, e.g. 60 (public/trailer/timeline-60.js)")
    ap.add_argument("--url", default="http://127.0.0.1:8768/trailer/?render=1")
    ap.add_argument("--out")
    ap.add_argument("--mix")
    ap.add_argument("--frames")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, help="default: the whole timeline")
    ap.add_argument("--warmup", type=float, default=2.0, help="seconds simulated before --start so eased state settles")
    ap.add_argument("--skip-capture", action="store_true")
    ap.add_argument("--keep-frames", action="store_true", help="do not wipe --frames before capture")
    ap.add_argument("--skip-encode", action="store_true", help="capture only (parallel segment workers)")
    ap.add_argument("--gpu", action="store_true", help="WebGL on the GPU (ANGLE/Vulkan) instead of SwiftShader")
    ap.add_argument("--scale", type=int, default=1, help="supersampling factor (device scale), reduced at encode")
    args = ap.parse_args()
    suffix = f"-{args.cut}" if args.cut else ""
    if args.cut:
        args.url += f"&cut={args.cut}"
    args.out = args.out or str(ROOT / f"out/trailer/protocole-h-trailer{suffix}.mp4")
    args.mix = args.mix or str(ROOT / f"out/trailer/mix{suffix}.wav")
    args.frames = args.frames or str(ROOT / f"out/trailer/frames{suffix}")

    frames_dir = Path(args.frames)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    voices = {}
    voices_file = Path(args.mix).with_suffix(".voices.json")
    if voices_file.exists():
        voices = json.loads(voices_file.read_text())

    if not args.skip_capture:
        if frames_dir.exists() and not args.keep_frames:
            shutil.rmtree(frames_dir)
        frames_dir.mkdir(parents=True, exist_ok=True)
        asyncio.run(
            capture(args.url, frames_dir, args.width, args.height, args.fps, args.start, args.end, voices, args.warmup,
                    gpu=args.gpu, scale=args.scale)
        )

    if args.skip_encode:
        return

    first = int(round(args.start * args.fps))
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", str(args.fps), "-start_number", str(first),
        "-i", str(frames_dir / "f%05d.jpg"),
    ]
    if os.path.exists(args.mix):
        cmd += ["-ss", f"{args.start:.3f}", "-i", args.mix]
    if args.scale > 1:
        cmd += ["-vf", f"scale={args.width}:{args.height}:flags=lanczos"]
    cmd += [
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow",
        "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
