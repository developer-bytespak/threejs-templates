#!/usr/bin/env python3
"""
Fill the photography slots on /construction-two from the Pexels API.

The page is built to work without this. Every image slot falls back to a drawn
architectural plate, so a slot you never fill simply stays a drawing and the
section still reads. This script fills the slots you want filled, one or all
of them, and never touches one that already has a file unless you say so.

    pip install Pillow
    set PEXELS_API_KEY=your_key_here          (Windows cmd)
    $env:PEXELS_API_KEY="your_key_here"       (PowerShell)
    export PEXELS_API_KEY=your_key_here       (bash)

    python tools/fetch_construction_photos.py --dry-run    # what it would do
    python tools/fetch_construction_photos.py              # fill empty slots
    python tools/fetch_construction_photos.py --list the-atrium
    python tools/fetch_construction_photos.py --only the-atrium --pick 3 --force

A free key takes about a minute at https://www.pexels.com/api/ and allows 200
requests an hour, which is far more than a full run needs (one search per slot
plus one download).

WHAT IT DOES TO EACH IMAGE
    centre-crops to 3:2 (with a per-slot bias, because a tower cropped from the
    centre loses its top), resizes to 2000x1400, saves progressive JPEG at
    quality 80, and for the four project slots also writes a 1000x700 "@1x"
    that the page's srcset uses on phones.

WHAT IT REFUSES
    The brief for this page rules out posed workers, hard-hat stock, handshakes
    and people smiling at camera. Pexels returns an `alt` description for every
    photo, and REJECT below drops any candidate whose description contains one
    of those words before it is ever considered. It is a blunt filter and it is
    not a substitute for looking at the results — use --list, and if the top
    pick is wrong, --pick a different one.

LICENSING
    The Pexels licence allows commercial use without attribution. This still
    writes a CREDITS.md next to the images with the photographer and the source
    URL for each one, because you will want to know where a picture came from
    long after this script has been forgotten. The demo project names are
    fictional: do not caption any of these as a building Bytes Construction
    actually built.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

API = "https://api.pexels.com/v1/search"

# Output geometry. 3:2 landscape, sized for the largest the page ever shows a
# project photograph (about 52vw tall on a wide desktop) with a little headroom.
FULL = (2000, 1400)
SMALL = (1000, 700)
QUALITY = 80
MIN_SOURCE_WIDTH = 2400

# Anything whose Pexels description contains one of these is dropped outright.
REJECT = (
    "worker", "workers", "hard hat", "hardhat", "helmet", "safety vest",
    "high vis", "high-vis", "hi-vis", "engineer", "architect ", "foreman",
    "smiling", "smile", "handshake", "shaking hands", "team meeting",
    "portrait", "posing", "poses", "selfie", "thumbs up", "businessman",
    "businesswoman", "colleagues", "coworkers", "happy", "young man",
    "young woman", "group of people", "holding a", "using a laptop",
)

# One entry per file the page looks for. `queries` are tried in order until a
# slot has enough candidates; `prefer` words push a candidate up the ranking;
# `bias` moves the crop window (0.0 keeps the top of the frame, 1.0 the bottom,
# 0.5 is a plain centre crop).
SLOTS = [
    {
        "path": "projects/harbor-district.jpg",
        "small": True,
        "bias": 0.38,
        "wants": "mixed-use waterfront block, podium and tower",
        "queries": [
            "modern mixed use building facade",
            "contemporary apartment building exterior",
            "waterfront modern architecture building",
        ],
        "prefer": ("facade", "building", "architecture", "exterior", "tower",
                   "apartment", "urban", "windows", "concrete", "glass"),
    },
    {
        "path": "projects/northline-works.jpg",
        "small": True,
        "bias": 0.5,
        "wants": "long-span steel, industrial frame or clear-height interior",
        "queries": [
            "warehouse interior steel structure",
            "industrial hall roof steel beams",
            "empty warehouse interior architecture",
        ],
        "prefer": ("warehouse", "steel", "beam", "beams", "industrial",
                   "hall", "structure", "roof", "hangar", "factory"),
    },
    {
        "path": "projects/the-atrium.jpg",
        "small": True,
        "bias": 0.3,
        "wants": "full-height atrium, strong repetition",
        "queries": [
            "atrium building interior looking up",
            "modern building atrium balconies",
            "hotel atrium architecture interior",
        ],
        "prefer": ("atrium", "looking up", "balcon", "interior", "symmetr",
                   "ceiling", "skylight", "floors", "railing"),
    },
    {
        "path": "projects/civic-commons.jpg",
        "small": True,
        "bias": 0.42,
        "wants": "contemporary civic architecture, stone or concrete, restrained",
        "queries": [
            "modern concrete architecture library building",
            "brutalist civic building exterior",
            "contemporary museum building architecture",
        ],
        "prefer": ("concrete", "library", "museum", "civic", "brutalist",
                   "architecture", "facade", "stone", "public"),
    },
    {
        "path": "site/foundation.jpg",
        "small": False,
        "bias": 0.55,
        "wants": "formwork, rebar, slab at ground level",
        "queries": [
            "concrete formwork rebar construction",
            "reinforced concrete foundation site",
            "rebar steel reinforcement grid",
        ],
        "prefer": ("rebar", "reinforce", "formwork", "concrete", "foundation",
                   "slab", "steel bars", "site"),
    },
    {
        "path": "site/structure.jpg",
        "small": False,
        "bias": 0.45,
        "wants": "steel or concrete frame going up",
        "queries": [
            "steel frame building under construction",
            "concrete building frame construction site",
            "building skeleton structure construction",
        ],
        "prefer": ("frame", "structure", "steel", "column", "skeleton",
                   "under construction", "crane", "concrete"),
    },
    {
        "path": "site/envelope.jpg",
        "small": False,
        "bias": 0.45,
        "wants": "curtain wall or cladding going on",
        "queries": [
            "glass curtain wall facade construction",
            "building cladding facade panels",
            "glass facade building detail",
        ],
        "prefer": ("curtain wall", "facade", "glass", "cladding", "panel",
                   "window", "envelope", "grid"),
    },
    {
        "path": "site/interiors.jpg",
        "small": False,
        "bias": 0.5,
        "wants": "unfinished interior, services exposed",
        "queries": [
            "unfinished interior concrete ceiling",
            "building interior under construction empty",
            "exposed ceiling services interior",
        ],
        "prefer": ("unfinished", "interior", "ceiling", "concrete", "empty",
                   "renovation", "duct", "services", "room"),
    },
    {
        "path": "site/handover.jpg",
        "small": False,
        "bias": 0.45,
        "wants": "finished, empty, handed over",
        "queries": [
            "modern office lobby interior empty",
            "minimal finished interior architecture",
            "modern building reception interior",
        ],
        "prefer": ("lobby", "reception", "interior", "minimal", "finished",
                   "office", "clean", "empty", "marble", "light"),
    },
]


# --------------------------------------------------------------------------- io
def out_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    # tools/fetch_construction_photos.py  ->  public/assets/construction-two/
    return (Path(__file__).resolve().parent.parent
            / "public" / "assets" / "construction-two")


def api_key(explicit: str | None) -> str:
    key = explicit or os.environ.get("PEXELS_API_KEY", "")
    if not key:
        sys.exit(
            "No Pexels API key.\n"
            "  Get one free at https://www.pexels.com/api/ then either\n"
            "    set PEXELS_API_KEY=...        (Windows cmd)\n"
            "    $env:PEXELS_API_KEY='...'     (PowerShell)\n"
            "    export PEXELS_API_KEY=...     (bash)\n"
            "  or pass --key ..."
        )
    return key.strip()


def get_json(url: str, key: str) -> dict:
    req = urllib.request.Request(url, headers={
        "Authorization": key,
        "User-Agent": "bytes-construction-template/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("Pexels rejected the API key (401). Check PEXELS_API_KEY.")
        if e.code == 429:
            sys.exit("Pexels rate limit reached (429). It resets hourly.")
        sys.exit(f"Pexels returned HTTP {e.code} for {url}")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Pexels: {e.reason}")


def get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": "bytes-construction-template/1.0",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


# ---------------------------------------------------------------- candidates
def rejected(photo: dict) -> str | None:
    alt = (photo.get("alt") or "").lower()
    for word in REJECT:
        if word in alt:
            return word
    if photo.get("width", 0) < MIN_SOURCE_WIDTH:
        return f"only {photo.get('width')}px wide"
    return None


def score(photo: dict, slot: dict) -> float:
    alt = (photo.get("alt") or "").lower()
    hits = sum(1 for w in slot["prefer"] if w in alt)
    w, h = photo.get("width", 1), photo.get("height", 1)
    ratio = w / max(h, 1)
    # 3:2 is the target; penalise anything far from it, panoramas included.
    shape = max(0.0, 1.0 - abs(ratio - 1.5) / 1.2)
    size = min(w / 6000.0, 1.0)
    return hits * 3.0 + shape * 2.0 + size


def candidates(slot: dict, key: str, want: int, seen: set[int]) -> list[dict]:
    found: list[dict] = []
    for query in slot["queries"]:
        url = API + "?" + urllib.parse.urlencode({
            "query": query,
            "orientation": "landscape",
            "size": "large",
            "per_page": 40,
        })
        data = get_json(url, key)
        for photo in data.get("photos", []):
            if photo["id"] in seen or any(p["id"] == photo["id"] for p in found):
                continue
            why = rejected(photo)
            if why:
                continue
            photo["_query"] = query
            found.append(photo)
        if len(found) >= want:
            break
        time.sleep(0.3)
    found.sort(key=lambda p: score(p, slot), reverse=True)
    return found


# ------------------------------------------------------------------- process
def process(raw: bytes, dest: Path, slot: dict, also_small: bool) -> list[str]:
    from PIL import Image

    img = Image.open(BytesIO(raw))
    if img.mode != "RGB":
        img = img.convert("RGB")

    # Crop to 3:2 around the slot's bias rather than the dead centre.
    target = FULL[0] / FULL[1]
    w, h = img.size
    if w / h > target:
        new_w = int(round(h * target))
        left = int(round((w - new_w) * 0.5))
        img = img.crop((left, 0, left + new_w, h))
    else:
        new_h = int(round(w / target))
        top = int(round((h - new_h) * slot["bias"]))
        top = max(0, min(top, h - new_h))
        img = img.crop((0, top, w, top + new_h))

    written = []
    dest.parent.mkdir(parents=True, exist_ok=True)

    full = img.resize(FULL, Image.LANCZOS)
    full.save(dest, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    written.append(dest.name)

    if also_small:
        small_path = dest.with_name(dest.stem + "@1x" + dest.suffix)
        img.resize(SMALL, Image.LANCZOS).save(
            small_path, "JPEG", quality=QUALITY, optimize=True, progressive=True
        )
        written.append(small_path.name)

    return written


def kb(path: Path) -> str:
    return f"{path.stat().st_size / 1024:,.0f} KB"


# ---------------------------------------------------------------------- main
def write_credits(root: Path, used: dict[str, dict]) -> None:
    if not used:
        return
    lines = [
        "# Photography credits",
        "",
        "Fetched from Pexels by `tools/fetch_construction_photos.py`.",
        "The Pexels licence permits commercial use without attribution; this",
        "file exists so you can trace any image back to its source.",
        "",
        "The project names on this page are fictional. Nothing here should be",
        "captioned as a building Bytes Construction actually delivered.",
        "",
    ]
    existing = root / "CREDITS.md"
    for path in sorted(used):
        p = used[path]
        lines += [
            f"## {path}",
            f"- Photographer: {p['photographer']} ({p['photographer_url']})",
            f"- Source: {p['url']}",
            f"- Description: {p.get('alt') or '—'}",
            "",
        ]
    existing.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n  wrote {existing}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fill /construction-two's photography slots from Pexels.")
    ap.add_argument("--key", help="Pexels API key (else $PEXELS_API_KEY)")
    ap.add_argument("--out", help="asset root (default: public/assets/construction-two)")
    ap.add_argument("--only", action="append", default=[],
                    help="slot name or path fragment, repeatable")
    ap.add_argument("--pick", type=int, default=1,
                    help="take the Nth ranked candidate (with --only)")
    ap.add_argument("--list", dest="show", metavar="SLOT",
                    help="print ranked candidates for a slot and stop")
    ap.add_argument("--force", action="store_true",
                    help="overwrite slots that already have a file")
    ap.add_argument("--dry-run", action="store_true",
                    help="say what would happen, download nothing")
    args = ap.parse_args()

    root = out_root(args.out)
    print(f"asset root: {root}")

    def wanted(slot):
        if not args.only:
            return True
        return any(frag.lower() in slot["path"].lower() for frag in args.only)

    if args.show:
        slot = next((s for s in SLOTS if args.show.lower() in s["path"].lower()), None)
        if not slot:
            sys.exit(f"No slot matching {args.show!r}. "
                     f"Try one of: {', '.join(Path(s['path']).stem for s in SLOTS)}")
        key = api_key(args.key)
        print(f"\n{slot['path']} — {slot['wants']}\n")
        for i, p in enumerate(candidates(slot, key, 12, set())[:12], 1):
            print(f"  {i:2}. {p['width']}x{p['height']}  {p['photographer']}")
            print(f"      {(p.get('alt') or '').strip()[:96]}")
            print(f"      {p['url']}")
        print("\n  re-run with:  --only "
              f"{Path(slot['path']).stem} --pick N --force")
        return 0

    todo = [s for s in SLOTS if wanted(s)]
    if not todo:
        sys.exit(f"Nothing matched --only {args.only}")

    pending, skipped = [], []
    for slot in todo:
        dest = root / slot["path"]
        (skipped if dest.exists() and not args.force else pending).append(slot)

    for slot in skipped:
        print(f"  keep   {slot['path']:<34} already there (--force to replace)")

    if not pending:
        print("\nNothing to fetch. Every requested slot already has a file.")
        return 0

    if args.dry_run:
        print()
        for slot in pending:
            print(f"  fetch  {slot['path']:<34} {slot['wants']}")
        print(f"\n{len(pending)} slot(s). Drop --dry-run to do it.")
        return 0

    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is not installed.  pip install Pillow")

    key = api_key(args.key)
    seen: set[int] = set()
    used: dict[str, dict] = {}
    failed: list[str] = []

    print()
    for slot in pending:
        dest = root / slot["path"]
        found = candidates(slot, key, max(args.pick, 6), seen)
        if len(found) < args.pick:
            print(f"  MISS   {slot['path']:<34} "
                  f"only {len(found)} candidate(s) survived the filter")
            failed.append(slot["path"])
            continue

        photo = found[args.pick - 1]
        seen.add(photo["id"])
        src = photo["src"].get("original") or photo["src"].get("large2x")
        try:
            raw = get_bytes(src)
            names = process(raw, dest, slot, slot["small"])
        except Exception as exc:                      # noqa: BLE001
            print(f"  FAIL   {slot['path']:<34} {exc}")
            failed.append(slot["path"])
            continue

        used[slot["path"]] = photo
        sizes = "  ".join(f"{n} ({kb(dest.with_name(n))})" for n in names)
        print(f"  ok     {slot['path']:<34} {sizes}")
        print(f"         {photo['photographer']} — "
              f"{(photo.get('alt') or '').strip()[:70]}")

    write_credits(root, used)

    print(f"\n{len(used)} filled, {len(skipped)} kept, {len(failed)} missed.")
    if failed:
        print("  Slots that missed keep their drawn plate — the page is fine.")
        print("  Try:  --list " + Path(failed[0]).stem)
    print("\nLook at them before you ship. --list SLOT shows the alternatives,")
    print("--only SLOT --pick N --force swaps one out.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
