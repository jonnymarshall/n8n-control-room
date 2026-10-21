#!/usr/bin/env bash
#
# Compares two .env-style files key by key WITHOUT printing secret values.
#
# Usage:
#   ./scripts/query/env-diff.sh                    # compares .env against .env.bak
#   ./scripts/query/env-diff.sh .env .env.local    # explicit files (A vs B)
#   ./scripts/query/env-diff.sh --show-values      # print full values (reveals secrets)
#
# It prints, for A vs B:
#   - keys only in A
#   - keys only in B (e.g. things that only exist in your backup)
#   - keys in both whose values differ (values masked unless --show-values)
#   - keys in both that are identical
#
# Reads nothing automatically beyond the two files you name (default .env / .env.bak).

set -euo pipefail

SHOW_VALUES=0
if [ "${1:-}" = "--show-values" ]; then SHOW_VALUES=1; shift; fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
A="${1:-$ROOT/.env}"
B="${2:-$ROOT/.env.bak}"

for f in "$A" "$B"; do
  [ -f "$f" ] || { echo "ERROR: file not found: $f" >&2; exit 1; }
done

python3 - "$A" "$B" "$SHOW_VALUES" <<'PY'
import sys

a_path, b_path, show = sys.argv[1], sys.argv[2], sys.argv[3] == "1"

def load(path):
    d = {}
    for raw in open(path):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        d[k] = v
    return d

a, b = load(a_path), load(b_path)

def mask(v):
    if show:
        return v
    if v == "":
        return "(empty)"
    if len(v) <= 6:
        return "*" * len(v) + f"  (len {len(v)})"
    return f"{v[:4]}...{v[-2:]}  (len {len(v)})"

print(f"A = {a_path}")
print(f"B = {b_path}")
print()

only_a = [k for k in a if k not in b]
only_b = [k for k in b if k not in a]
diff = [k for k in a if k in b and a[k] != b[k]]
same = [k for k in a if k in b and a[k] == b[k]]

print(f"Keys only in A ({len(only_a)}):")
for k in only_a:
    print(f"  {k} = {mask(a[k])}")
print()
print(f"Keys only in B ({len(only_b)}):")
for k in only_b:
    print(f"  {k} = {mask(b[k])}")
print()
print(f"Keys in both, different values ({len(diff)}):")
for k in diff:
    print(f"  {k}:")
    print(f"    A: {mask(a[k])}")
    print(f"    B: {mask(b[k])}")
print()
print(f"Keys in both, identical ({len(same)}): " + (", ".join(same) if same else "(none)"))
PY
