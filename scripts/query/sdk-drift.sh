#!/usr/bin/env bash
#
# Read-only. Reports every .sdk.js snapshot that no longer matches the live n8n
# workflow it was generated from.
#
# Why this exists: a snapshot is only useful if it is true. The refresh was a
# written instruction in AGENTS.md and it got missed, so on 2026-10-23 three live
# workflows had changes that had never reached their snapshots. Pushes now refresh
# their own snapshot automatically (the n8n-sdk-snapshot plugin / Claude hook), but
# a manual edit in the n8n UI, a push from another machine, or a hook that did not
# run still leaves drift behind. Run this to find it.
#
# Compares per node: name, type, typeVersion, parameters, position. Also compares
# the connection graph. Node IDs are ignored on purpose (a rebuilt node gets a new
# id, which is not itself drift).
#
# Files without a `const liveNodes = [` block are hand-authored SDK sources, not
# generated snapshots, so there is nothing to compare. They are reported as SKIP
# and do not fail the check. `guys-take-script-generation.sdk.js` is one of these.
#
# Exit codes: 0 = every generated snapshot matches live. 1 = drift (or a fetch
# failure). Safe to call from the post-push ritual or a pre-commit check.
#
# Reads from .env: N8N_URL, N8N_API_KEY
#
# Usage:
#   ./scripts/query/sdk-drift.sh
#   ./scripts/query/sdk-drift.sh --quiet     # only print problems

set -euo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
SDK_DIR="$REPO_ROOT/scripts/deploy/workflows"
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

: "${N8N_URL:?N8N_URL not set in .env}"
: "${N8N_API_KEY:?N8N_API_KEY not set in .env}"

export SDK_DIR N8N_URL N8N_API_KEY QUIET

node <<'JS'
const fs = require('node:fs');
const path = require('node:path');

const dir = process.env.SDK_DIR;
const baseUrl = process.env.N8N_URL.replace(/\/+$/, '');
const apiKey = process.env.N8N_API_KEY;
const quiet = process.env.QUIET === '1';

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sdk.js')).sort();

function arrayBlock(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return null;
  let i = src.indexOf('[', start + marker.length - 1);
  if (i < 0) return null;
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return null;
}

function parseBlock(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return new Function('return (' + text + ')')(); }
}

function workflowId(src) {
  let m = src.match(/Snapshot of live workflow ([A-Za-z0-9]+)/);
  if (m) return m[1];
  m = src.match(/workflow\s*\(\s*["']([A-Za-z0-9]+)["']/);
  return m ? m[1] : null;
}

function sig(n) {
  return JSON.stringify({
    name: n.name,
    type: n.type,
    tv: n.typeVersion,
    p: n.parameters,
    pos: n.position,
  });
}

function connSig(connections) {
  const rows = [];
  for (const [source, outputs] of Object.entries(connections || {})) {
    for (const [type, branches] of Object.entries(outputs || {})) {
      // The generated snapshot only records main connections, so only main can be
      // compared. AI sub-node wiring (ai_languageModel, ai_outputParser, ...) is
      // stored live only; ignoring it here avoids false "connections differ".
      if (type !== 'main') continue;
      (branches || []).forEach((branch, index) => {
        for (const link of branch || []) {
          rows.push(`${source}|${index}|${link.node}|${link.index || 0}`);
        }
      });
    }
  }
  return rows.sort().join('\n');
}

(async () => {
  let drifted = 0;
  let skipped = 0;
  let clean = 0;
  const problems = [];

  if (!quiet) console.log(`Checking ${files.length} snapshots against ${baseUrl}\n`);

  for (const file of files) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const id = workflowId(src);
    const nodeText = src.includes('const liveNodes = [')
      ? arrayBlock(src, 'const liveNodes = [')
      : null;

    if (!id || !nodeText) {
      skipped++;
      if (!quiet) console.log(`  SKIP      ${file}  (hand-authored, no generated node list)`);
      continue;
    }

    const localNodes = parseBlock(nodeText);
    const localConns = parseBlock(arrayBlock(src, 'const connections = [')) || [];

    let live;
    try {
      const res = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
        headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      live = await res.json();
    } catch (e) {
      drifted++;
      problems.push(`  FETCH FAIL ${file}  (${id}: ${e.message})`);
      continue;
    }

    const localMap = new Map(localNodes.map((n) => [n.name, sig(n)]));
    const liveMap = new Map(live.nodes.map((n) => [n.name, sig(n)]));
    const changed = [...liveMap.keys()].filter((k) => localMap.has(k) && localMap.get(k) !== liveMap.get(k));
    const onlyLive = [...liveMap.keys()].filter((k) => !localMap.has(k));
    const onlyLocal = [...localMap.keys()].filter((k) => !liveMap.has(k));

    const localConnText = localConns
      .map((row) => {
        const [source, output, target, targetIndex] = row;
        return `${source}|${output}|${target}|${targetIndex || 0}`;
      })
      .sort()
      .join('\n');
    const connsDiffer = localConnText !== connSig(live.connections);

    const isDrift = changed.length || onlyLive.length || onlyLocal.length || connsDiffer;
    if (!isDrift) {
      clean++;
      if (!quiet) console.log(`  OK        ${file}`);
      continue;
    }

    drifted++;
    const lines = [`  DRIFT     ${file}  (${live.name})`, `              live updated ${live.updatedAt}`];
    if (changed.length) lines.push(`              changed in live: ${changed.join(', ')}`);
    if (onlyLive.length) lines.push(`              only live: ${onlyLive.join(', ')}`);
    if (onlyLocal.length) lines.push(`              only local: ${onlyLocal.join(', ')}`);
    if (connsDiffer) lines.push('              connections differ');
    lines.push(`              fix: ./scripts/deploy/workflows/snapshot-sdk.sh ${id} ${file.replace(/\.sdk\.js$/, '')}`);
    problems.push(lines.join('\n'));
  }

  for (const line of problems) console.log(line);

  console.log(
    `\n${clean} in sync, ${drifted} drifted, ${skipped} hand-authored (skipped).`
  );
  if (drifted) {
    console.log('A drifted snapshot means a live change never reached the repo. Pull it into the sdk file before editing that workflow.');
    process.exit(1);
  }
  console.log('Every generated snapshot matches live.');
})();
JS
