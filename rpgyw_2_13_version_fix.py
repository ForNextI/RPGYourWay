#!/usr/bin/env python3
# RPGYW repository 2.13.0 release-version repair.
# Run from the ROOT of the RPGYW repository.
#
# Check:
#   python rpgyw_2_13_version_fix.py --check
# Apply:
#   python rpgyw_2_13_version_fix.py --apply

from __future__ import annotations
import argparse
import json
from pathlib import Path

ROOT = Path.cwd()
PACKAGE = ROOT / "package.json"
VERSION_FILE = ROOT / "lib" / "version.ts"
VALIDATOR = ROOT / "scripts" / "validate-release.mts"

OLD = "2.12.2"
NEW = "2.13.0"

def fail(msg: str) -> None:
    raise SystemExit(f"\nERROR: {msg}\n")

def read(path: Path) -> str:
    if not path.exists():
        fail(f"Missing expected file: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")

def check() -> None:
    pkg = json.loads(read(PACKAGE))
    if pkg.get("version") != NEW or pkg.get("rpgywVersion") != NEW:
        fail(
            f"package.json is not already at {NEW}. "
            f"Found version={pkg.get('version')!r}, rpgywVersion={pkg.get('rpgywVersion')!r}."
        )

    version_text = read(VERSION_FILE)
    validator = read(VALIDATOR)

    if NEW in version_text and NEW in validator and OLD not in validator[:1200]:
        print("RPGYW 2.13.0 version sentries already repaired.")
        print("CHECK OK")
        return

    if f"APP_VERSION = '{OLD}'" not in version_text:
        fail("lib/version.ts no longer has the expected 2.12.2 APP_VERSION marker.")

    required = [
        f"assert.equal(pkg.version, '{OLD}')",
        f"assert.equal(pkg.rpgywVersion, '{OLD}')",
        f"APP_VERSION = '{OLD}'",
    ]
    for marker in required:
        if marker not in validator:
            fail(f"validate-release.mts is missing expected marker: {marker}")

    print("RPGYW repository 2.13.0 version-sentry repair")
    print("  package.json: already 2.13.0")
    print("  lib/version.ts: 2.12.2 -> 2.13.0")
    print("  validate-release.mts package version: 2.12.2 -> 2.13.0")
    print("  validate-release.mts rpgywVersion: 2.12.2 -> 2.13.0")
    print("  validate-release.mts visible APP_VERSION assertion: 2.12.2 -> 2.13.0")
    print("\nCHECK OK")

def apply() -> None:
    check()

    version_text = read(VERSION_FILE)
    validator = read(VALIDATOR)

    if f"APP_VERSION = '{NEW}'" not in version_text:
        version_text = version_text.replace(
            f"APP_VERSION = '{OLD}'",
            f"APP_VERSION = '{NEW}'",
            1,
        )

    validator = validator.replace(
        f"assert.equal(pkg.version, '{OLD}')",
        f"assert.equal(pkg.version, '{NEW}')",
        1,
    )
    validator = validator.replace(
        f"assert.equal(pkg.rpgywVersion, '{OLD}')",
        f"assert.equal(pkg.rpgywVersion, '{NEW}')",
        1,
    )
    validator = validator.replace(
        f"""has(read('lib/version.ts'), "APP_VERSION = '{OLD}'", 'visible app version')""",
        f"""has(read('lib/version.ts'), "APP_VERSION = '{NEW}'", 'visible app version')""",
        1,
    )

    VERSION_FILE.write_text(version_text, encoding="utf-8", newline="\n")
    VALIDATOR.write_text(validator, encoding="utf-8", newline="\n")

    print("\nApplied RPGYW 2.13.0 release-version repair.")
    print("Rerun: pnpm validate:release")

def main() -> None:
    ap = argparse.ArgumentParser()
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    check() if args.check else apply()

if __name__ == "__main__":
    main()
