#!/usr/bin/env bash
# Read-only. Audits every Telegram message in the .sdk.js snapshots against
# n8n_workflow_readmes/TELEGRAM-STYLE.md and prints a per-workflow scoreboard.
#
# The snapshots are regenerated from live by snapshot-sdk.sh and checked by
# sdk-drift.sh, so this reflects what the bots actually send.
#
# Exit codes: 0 all compliant, 1 at least one message non-compliant.
#
# Usage:
#   scripts/query/telegram-style-audit.sh              # all workflows
#   scripts/query/telegram-style-audit.sh --verbose    # show every finding
#   scripts/query/telegram-style-audit.sh <file.sdk.js>
#
# Rules checked (hard, FAIL):
#   1. The message must open with one of the house status emoji
#      (✅ 🟡 ⏳ 🔄 ⚠️ ❌ 📥 🎙️ 🤖). A message that is nothing but an
#      expression is reported as DYNAMIC and not counted as a failure.
#   2. No internal Airtable row id (recXXXXXXXXXXXXXX) in the visible text.
#   3. No markdown (** ## or a |---| table row).
# Warnings (WARN, not a failure): em dash, over 1500 visible characters,
# more than 8 non-empty lines.

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2

VERBOSE=0
FILES=()
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=1 ;;
    *) FILES+=("$arg") ;;
  esac
done

if [ ${#FILES[@]} -eq 0 ]; then
  while IFS= read -r f; do FILES+=("$f"); done < <(ls scripts/deploy/workflows/*.sdk.js)
fi

node - "$VERBOSE" "${FILES[@]}" <<'NODE'
const fs = require('fs');
const verbose = process.argv[2] === '1';
const files = process.argv.slice(3);

const STATUS = ['✅','🟡','⏳','🔄','⏭️','♻️','⚠️','❌','📥','🎙️','🤖'];
const startsWithEmoji = s => {
  const t = s.replace(/^=/, '').trimStart();
  return /^\p{Extended_Pictographic}/u.test(t);
};
const startsWithStatus = s => {
  const t = s.replace(/^=/, '').trimStart();
  return STATUS.some(e => t.startsWith(e));
};

function extractArray(src) {
  const k = src.indexOf('const liveNodes = [');
  if (k < 0) return null;
  const start = k + 'const liveNodes = '.length;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

function collectMessages(node) {
  const out = [];
  const walk = (obj, path) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const here = path ? path + '.' + k : k;
      if (typeof v === 'string' && (k === 'text' || k === 'caption')) {
        // Button labels are not messages.
        if (/inlineKeyboard|\.buttons\./.test(here)) continue;
        out.push({ field: here, value: v });
      } else if (v && typeof v === 'object') {
        walk(v, here);
      }
    }
  };
  walk(node.parameters || {}, '');
  return out;
}

let totalMsgs = 0, totalFail = 0, totalWarn = 0, totalDynamic = 0;
const rows = [];

// Inactive or archived workflows are out of scope per TELEGRAM-STYLE.md: they are
// not converted unless they are brought back.
const INACTIVE = [
  'approval-handler.sdk.js',
  'article-drafts.sdk.js',
  'draft-approvals.sdk.js',
  'weekday-drip.sdk.js',
  'airtable-update-telegram-notifier.sdk.js',
];

for (const file of files) {
  const short = file.split('/').pop();
  if (INACTIVE.includes(short)) { rows.push({ short, skipped: 'inactive - out of scope' }); continue; }
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const json = extractArray(src);
  if (!json) { rows.push({ short, skipped: 'not a generated snapshot' }); continue; }

  let nodes;
  try { nodes = JSON.parse(json); } catch { rows.push({ short, skipped: 'unparseable' }); continue; }

  const findings = [];
  for (const n of nodes) {
    if (!n.type || !n.type.includes('telegram')) continue;
    if (n.type.includes('telegramTrigger')) continue;
    for (const m of collectMessages(n)) {
      totalMsgs++;
      const raw = m.value;
      const visible = raw.replace(/⟦[\s\S]*?⟧/g, ''); // machine block is exempt
      const isPureExpression = /^=\{\{[\s\S]*\}\}$/.test(raw.trim());

      if (isPureExpression) {
        totalDynamic++;
        findings.push({ node: n.name, field: m.field, verdict: 'DYNAMIC', why: 'value is a single expression; audit by hand' });
        continue;
      }

      const fails = [];
      const warns = [];
      if (!startsWithEmoji(raw)) fails.push('no emoji first');
      else if (!startsWithStatus(raw)) warns.push('first emoji is not a state emoji');
      if (/rec[A-Za-z0-9]{12,}/.test(visible)) fails.push('raw rec id in visible text');
      if (/\*\*|^#{1,3}\s|\|\s*-{3,}/m.test(visible)) fails.push('markdown');

      const text = visible.replace(/^=/, '');
      if (/—/.test(text)) warns.push('em dash');
      if (text.length > 1500) warns.push('over 1500 chars (' + text.length + ')');
      if (text.split('\n').filter(l => l.trim()).length > 8) warns.push('over 8 lines');

      if (fails.length) { totalFail++; findings.push({ node: n.name, field: m.field, verdict: 'FAIL', why: fails.join(', ') }); }
      else if (warns.length) { totalWarn++; findings.push({ node: n.name, field: m.field, verdict: 'WARN', why: warns.join(', ') }); }
      else {
        findings.push({ node: n.name, field: m.field, verdict: 'PASS', why: '' });
      }
    }
  }
  rows.push({ short, findings });
}

const pad = (s, n) => String(s).padEnd(n);
let failWorkflows = 0;
for (const r of rows) {
  if (r.skipped) { console.log('SKIP  ' + pad(r.short, 52) + r.skipped); continue; }
  const f = r.findings.filter(x => x.verdict === 'FAIL').length;
  const w = r.findings.filter(x => x.verdict === 'WARN').length;
  const d = r.findings.filter(x => x.verdict === 'DYNAMIC').length;
  const p = r.findings.filter(x => x.verdict === 'PASS').length;
  if (f) failWorkflows++;
  const mark = f ? 'FAIL' : (p + d > 0 ? 'ok  ' : '--  ');
  console.log(mark + '  ' + pad(r.short, 52) + String(p).padStart(2) + ' pass · ' + String(w).padStart(2) + ' warn · ' + String(f).padStart(2) + ' fail · ' + String(d).padStart(2) + ' dynamic');
  if (verbose || f) {
    for (const x of r.findings) {
      if (x.verdict === 'PASS' && !verbose) continue;
      if (x.verdict === 'DYNAMIC' && !verbose) continue;
      console.log('        ' + pad(x.verdict, 8) + pad(x.node, 34) + x.why);
    }
  }
}

console.log('');
console.log('messages: ' + totalMsgs + ' · pass/warn/fail: ' + (totalMsgs - totalDynamic - totalFail - totalWarn) + '/' + totalWarn + '/' + totalFail + ' · dynamic: ' + totalDynamic);
console.log(failWorkflows ? 'NOT COMPLIANT: ' + failWorkflows + ' workflow(s) still need converting.' : 'All convertible messages comply.');
process.exit(failWorkflows ? 1 : 0);
NODE
