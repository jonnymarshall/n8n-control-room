#!/usr/bin/env bash
#
# Read-only. Checks every Airtable table id in every workflow snapshot against the
# live bases, so a stale or mistyped id is found here instead of at 03:43 in the
# group chat.
#
# Why this exists: on 2026-11-17 the assistant's system message carried the Social
# Posts table id as `tblY8EpeOlYrXHYNE` when the live id is `tbly8EpeOlYrXHYNE`
# (lowercase b). Airtable ids are case-sensitive, so the first write that used it
# would have failed with INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND, an error whose
# wording points at the token rather than at the id. Nothing checked the ids in
# the snapshots, so it sat there unnoticed.
#
# What it checks: every `app…`/`tbl…` pair in `scripts/deploy/workflows/*.sdk.js`,
# plus any `tbl…` id that appears without a base (it is tried against every base
# the repo mentions). Airtable ids are 17 characters, so only exact-length tokens
# are checked; prose examples such as "tblThumbnails" are ignored on purpose.
# The runtime guard for a made-up id lives in the assistant's button handler.
#
# Exit codes: 0 = every id exists. 1 = at least one id is missing or the request
# failed. Safe for a pre-commit check.
#
# Reads from .env: AIRTABLE_PAT_TOKEN
#
# Usage:
#   ./scripts/query/table-id-audit.sh
#   ./scripts/query/table-id-audit.sh --quiet              # only print problems
#   ./scripts/query/table-id-audit.sh --dir <snapshot dir> # check another checkout

set -euo pipefail

QUIET=0
SDK_DIR_OVERRIDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --quiet) QUIET=1; shift ;;
    --dir) SDK_DIR_OVERRIDE="${2:?--dir needs a path}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
SDK_DIR="${SDK_DIR_OVERRIDE:-$REPO_ROOT/scripts/deploy/workflows}"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
with open(sys.argv[1]) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1); k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'): v = v[1:-1]
        print(f"export {k}={shlex.quote(v)}")
PY
)"

: "${AIRTABLE_PAT_TOKEN:?AIRTABLE_PAT_TOKEN not set in .env}"

export SDK_DIR AIRTABLE_PAT_TOKEN QUIET

python3 - <<'PY'
import glob, json, os, re, sys, time, urllib.error, urllib.request

sdk_dir = os.environ["SDK_DIR"]
token = os.environ["AIRTABLE_PAT_TOKEN"]
quiet = os.environ["QUIET"] == "1"

APP = re.compile(r"\bapp[A-Za-z0-9]{14}\b")
TBL = re.compile(r"\btbl[A-Za-z0-9]{14}\b")

files = sorted(glob.glob(os.path.join(sdk_dir, "*.sdk.js")))
pairs = {}       # (base, table) -> set(files)
bare = {}        # table -> set(files)
bases = set()

for path in files:
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as f:
        text = f.read()

    found_pairs = set()
    for m in APP.finditer(text):
        base = m.group(0)
        bases.add(base)
        # A table id within 120 characters after the base id is treated as its table.
        window = text[m.end():m.end() + 120]
        for t in TBL.finditer(window):
            found_pairs.add((base, t.group(0)))

    for base, table in found_pairs:
        pairs.setdefault((base, table), set()).add(name)

    for m in TBL.finditer(text):
        table = m.group(0)
        # Skip ids already accounted for as a pair somewhere in this file.
        if any(p[1] == table for p in found_pairs):
            continue
        bare.setdefault(table, set()).add(name)

def fetch(base, table):
    url = f"https://api.airtable.com/v0/{base}/{table}?maxRecords=1"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            return e.code
        except Exception as e:
            return str(e)

missing = []
checked = 0

for (base, table), names in sorted(pairs.items()):
    status = fetch(base, table)
    checked += 1
    if status == 200:
        if not quiet:
            print(f"  OK       {base}/{table}   {', '.join(sorted(names))}")
    else:
        missing.append((f"{base}/{table}", status, names))
        print(f"  MISSING  {base}/{table}   {', '.join(sorted(names))}   (HTTP {status})")

pair_tables = {t for (_, t) in pairs}
for table, names in sorted(bare.items()):
    if table in pair_tables:
        continue
    # An id with no base in the same file: accept it if any base the repo uses has it.
    ok = False
    status = None
    for base in sorted(bases):
        status = fetch(base, table)
        checked += 1
        if status == 200:
            ok = True
            break
    if ok:
        if not quiet:
            print(f"  OK       {table}   {', '.join(sorted(names))}")
    else:
        missing.append((table, status, names))
        print(f"  MISSING  {table}   {', '.join(sorted(names))}   (HTTP {status})")

print()
if missing:
    print(f"{len(missing)} Airtable id(s) could not be found, from {checked} checks.")
    for ident, status, names in missing:
        print(f"  - {ident}  (HTTP {status})  in {', '.join(sorted(names))}")
    print("\nFix the id in the snapshot from the live base schema, then re-run.")
    sys.exit(1)

print(f"All {len(pairs) + len(bare)} Airtable ids exist ({checked} checks).")
PY
