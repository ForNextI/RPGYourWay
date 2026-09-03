#!/usr/bin/env python3
"""
RPG Your Way 3.0.3
Landing-page top-level typography bump.

Run from the RPGYW repository root:

    python rpgyw_3_0_3_typography_apply.py --check
    python rpgyw_3_0_3_typography_apply.py --apply
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path.cwd()
BASE_VERSION = "3.0.0"
NEW_VERSION = "3.0.3"

CSS = Path("app/globals.css")
PKG = Path("package.json")
VERSION = Path("lib/version.ts")
VALIDATOR = Path("scripts/validate-release.mts")

HEADING_TEXT = "Why would you spend your money at RPG Your Way?"

OLD_HEADING_SIZE = "font-size: clamp(1.2rem, 2vw, 1.55rem);"
NEW_HEADING_SIZE = "font-size: clamp(1.34rem, 2.35vw, 1.72rem);"

OLD_INTRO_SIZE = "font-size: clamp(.97rem, 1.25vw, 1.08rem);"
NEW_INTRO_SIZE = "font-size: clamp(1.06rem, 1.45vw, 1.20rem);"

OLD_MAJOR_SIZE = "font-size: clamp(1.08rem, 2.4vw, 1.34rem);"
NEW_MAJOR_SIZE = "font-size: clamp(1.18rem, 2.65vw, 1.48rem);"

SUMMARY_ANCHOR = """  padding: .68rem .78rem .68rem 1rem;
  color: var(--rpgyw-forest);
  font-weight: 900;"""

SUMMARY_REPLACEMENT = """  padding: .68rem .78rem .68rem 1rem;
  color: var(--rpgyw-forest);
  font-size: clamp(1.04rem, 1.6vw, 1.18rem);
  font-weight: 900;"""

VALIDATION_MARKER = "// RPGYW 3.0.3 landing typography contract."


def fail(message: str) -> None:
    raise SystemExit(f"\nERROR: {message}\n")


def read(path: Path) -> str:
    full = ROOT / path
    if not full.exists():
        fail(f"Missing expected file: {path}")
    return full.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one match, found {count}.")
    return text.replace(old, new, 1)


def prepare() -> dict[Path, str]:
    pkg_data = json.loads(read(PKG))
    if pkg_data.get("version") != BASE_VERSION or pkg_data.get("rpgywVersion") != BASE_VERSION:
        fail(
            f"Expected package version {BASE_VERSION}; found "
            f"version={pkg_data.get('version')!r}, rpgywVersion={pkg_data.get('rpgywVersion')!r}."
        )

    css = read(CSS)
    if HEADING_TEXT not in read(Path("app/page.tsx")):
        fail(f"Expected landing heading is missing: {HEADING_TEXT}")

    css = replace_once(css, OLD_HEADING_SIZE, NEW_HEADING_SIZE, "lead heading font size")
    css = replace_once(css, OLD_INTRO_SIZE, NEW_INTRO_SIZE, "intro paragraph font size")
    css = replace_once(css, OLD_MAJOR_SIZE, NEW_MAJOR_SIZE, "lower major accordion font size")
    css = replace_once(css, SUMMARY_ANCHOR, SUMMARY_REPLACEMENT, "four differentiator buttons font size")

    pkg = read(PKG)
    pkg = replace_once(pkg, '"version": "3.0.0"', '"version": "3.0.3"', "package version")
    pkg = replace_once(pkg, '"rpgywVersion": "3.0.0"', '"rpgywVersion": "3.0.3"', "RPGYW version")

    version = replace_once(
        read(VERSION),
        "APP_VERSION = '3.0.0'",
        "APP_VERSION = '3.0.3'",
        "visible app version",
    )

    validator = read(VALIDATOR)
    validator = replace_once(
        validator,
        "assert.equal(pkg.version, '3.0.0')",
        "assert.equal(pkg.version, '3.0.3')",
        "validator package version",
    )
    validator = replace_once(
        validator,
        "assert.equal(pkg.rpgywVersion, '3.0.0')",
        "assert.equal(pkg.rpgywVersion, '3.0.3')",
        "validator RPGYW version",
    )
    validator = replace_once(
        validator,
        'has(read(\'lib/version.ts\'), "APP_VERSION = \'3.0.0\'", \'visible app version\')',
        'has(read(\'lib/version.ts\'), "APP_VERSION = \'3.0.3\'", \'visible app version\')',
        "validator visible version",
    )

    if VALIDATION_MARKER not in validator:
        validator += f"""

{VALIDATION_MARKER}
has(css, '{NEW_HEADING_SIZE}', 'larger landing lead heading')
has(css, '{NEW_INTRO_SIZE}', 'larger landing intro copy')
has(css, 'font-size: clamp(1.04rem, 1.6vw, 1.18rem);', 'larger differentiator buttons')
has(css, '{NEW_MAJOR_SIZE}', 'larger lower major landing buttons')
"""

    return {
        CSS: css,
        PKG: pkg,
        VERSION: version,
        VALIDATOR: validator,
    }


def validate(updates: dict[Path, str]) -> None:
    css = updates[CSS]
    for marker, label in [
        (NEW_HEADING_SIZE, "lead heading"),
        (NEW_INTRO_SIZE, "intro paragraph"),
        ("font-size: clamp(1.04rem, 1.6vw, 1.18rem);", "four differentiator buttons"),
        (NEW_MAJOR_SIZE, "lower major accordions"),
    ]:
        if marker not in css:
            fail(f"Prepared CSS is missing {label} marker: {marker}")

    pkg = json.loads(updates[PKG])
    if pkg.get("version") != NEW_VERSION or pkg.get("rpgywVersion") != NEW_VERSION:
        fail("Prepared package.json did not reach 3.0.3.")

    if "APP_VERSION = '3.0.3'" not in updates[VERSION]:
        fail("Prepared lib/version.ts did not reach 3.0.3.")

    validator = updates[VALIDATOR]
    for marker in [
        "assert.equal(pkg.version, '3.0.3')",
        "assert.equal(pkg.rpgywVersion, '3.0.3')",
        "APP_VERSION = '3.0.3'",
        VALIDATION_MARKER,
    ]:
        if marker not in validator:
            fail(f"Prepared validator is missing: {marker}")


def check() -> None:
    updates = prepare()
    validate(updates)
    print("RPG Your Way 3.0.3 typography preflight")
    print("  ✓ lead eyebrow/nameplate heading: one step larger")
    print("  ✓ cream introductory paragraph: one step larger")
    print("  ✓ four numbered differentiator buttons: one step larger")
    print("  ✓ Why I created / Who benefits buttons: one step larger")
    print("  ✓ nested accordions unchanged")
    print("  ✓ version 3.0.0 → 3.0.3")
    print("  ✓ release validation updated")
    print("CHECK OK")


def apply() -> None:
    updates = prepare()
    validate(updates)
    for path, content in updates.items():
        (ROOT / path).write_text(content, encoding="utf-8", newline="\n")
    print("Applied RPG Your Way 3.0.3 typography update.")
    print("Changed 4 files.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply RPGYW 3.0.3 landing typography changes.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.check:
        check()
    else:
        apply()


if __name__ == "__main__":
    main()
