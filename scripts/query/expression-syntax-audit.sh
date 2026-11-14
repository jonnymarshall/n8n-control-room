#!/usr/bin/env bash
# Read-only. Audits every expression chunk in the .sdk.js snapshots for string
# literals that never close, and prints a per-workflow scoreboard.
#
# Why this exists: on 2026-11-14 `BA - Subworkflow - Apply Fountain Sync` died at
# its last node with `ExpressionExtensionError: invalid syntax`. The message
# template had `\n\n` inside a quoted warning, but the two-character escape had
# been stored as two real line breaks. n8n sees a quote that runs across a line,
# calls it a syntax error, and the whole run fails after the Airtable write has
# already succeeded. Nothing else in the fleet catches this: the expression
# editor's warnings only fire in the UI, not on a pushed workflow, and the
# Telegram style audit only looks at wording.
#
# The rule it enforces: inside a `{{ ... }}` chunk, a quoted string may contain
# the two-character escape `\n`, but never a literal line break.
#
# The snapshots are regenerated from live by snapshot-sdk.sh and checked by
# sdk-drift.sh, so this reflects what n8n will actually parse. A snapshot that
# has drifted from live can still hide a live problem — run sdk-drift.sh too.
#
# Exit codes: 0 clean, 1 at least one broken expression chunk.
#
# Usage:
#   scripts/query/expression-syntax-audit.sh              # all workflows
#   scripts/query/expression-syntax-audit.sh --quiet      # only print problems
#   scripts/query/expression-syntax-audit.sh <file.sdk.js>

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2

QUIET=0
FILES=()
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    *) FILES+=("$arg") ;;
  esac
done

if [ ${#FILES[@]} -eq 0 ]; then
  while IFS= read -r f; do FILES+=("$f"); done < <(ls scripts/deploy/workflows/*.sdk.js)
fi

node - "$QUIET" "${FILES[@]}" <<'NODE'
const fs = require('fs');

const quiet = process.argv[2] === '1';
const files = process.argv.slice(3);

// n8n's own splitter: {{ opens a code chunk, }} closes it. Escaped \}} is text.
function splitExpression(expression) {
	const chunks = [];
	let searchingFor = 'open';
	let buffer = '';
	let index = 0;
	while (index < expression.length) {
		const rest = expression.slice(index);
		const match = (searchingFor === 'open' ? /\{\{/ : /\}\}/).exec(rest);
		if (!match) {
			buffer += rest;
			chunks.push({ type: searchingFor === 'open' ? 'text' : 'code', text: buffer });
			break;
		}
		buffer += rest.slice(0, match.index);
		chunks.push({ type: searchingFor === 'open' ? 'text' : 'code', text: buffer });
		searchingFor = searchingFor === 'open' ? 'close' : 'open';
		index += match.index + 2;
		buffer = '';
	}
	return chunks;
}

// Finds a quoted string that is still open when a real newline arrives, or that
// is still open at the end of the chunk. Returns a short description or null.
//
// Regex literals are stepped over, because a `/"/g` in an expression is not a
// string and would otherwise open a phantom double quote.
function findUnclosedString(code) {
	const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '^', '~', '<', '>', '']);
	let quote = null;
	let startLine = 0;
	let line = 1;
	let lastSignificant = '';
	for (let i = 0; i < code.length; i++) {
		const ch = code[i];
		if (quote) {
			if (ch === '\\') { i++; continue; } // skip the escaped character
			if (ch === '\n') {
				return `quote ${quote} opened on line ${startLine} is still open at the line break (line ${line})`;
			}
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '\n') { line++; lastSignificant = ''; continue; }
		if (ch === '/' && REGEX_PRECEDERS.has(lastSignificant) && code[i + 1] !== '/' && code[i + 1] !== '*') {
			// regex literal: skip to the closing slash, honouring [classes] and escapes
			let inClass = false;
			i++;
			for (; i < code.length; i++) {
				const rc = code[i];
				if (rc === '\\') { i++; continue; }
				if (rc === '[') inClass = true;
				else if (rc === ']') inClass = false;
				else if (rc === '/' && !inClass) break;
			}
			lastSignificant = '/';
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch;
			startLine = line;
			continue;
		}
		if (!/\s/.test(ch)) lastSignificant = ch;
	}
	if (quote) return `quote ${quote} opened on line ${startLine} is never closed`;
	return null;
}

function walkParams(params, prefix, sink) {
	for (const [key, value] of Object.entries(params || {})) {
		if (typeof value === 'string' && value.startsWith('=')) {
			for (const chunk of splitExpression(value)) {
				if (chunk.type !== 'code') continue;
				const problem = findUnclosedString(chunk.text);
				if (problem) sink.push({ param: prefix + key, problem, code: chunk.text });
			}
		} else if (value && typeof value === 'object') {
			walkParams(value, prefix + key + '.', sink);
		}
	}
}

let workflowCount = 0;
let chunkCount = 0;
let broken = 0;
const report = [];

for (const file of files) {
	let source;
	try {
		source = fs.readFileSync(file, 'utf8');
	} catch {
		report.push(`SKIP  ${file}  cannot read`);
		continue;
	}
	const start = source.indexOf('const liveNodes = [');
	if (start === -1) {
		report.push(`SKIP  ${file}  not a generated snapshot`);
		continue;
	}
	const end = source.indexOf('\n];', start);
	if (end === -1) {
		report.push(`FAIL  ${file}  cannot find the end of liveNodes`);
		broken++;
		continue;
	}
	let nodes;
	const arrayText = source.slice(start + 'const liveNodes = '.length, end + 2);
	try {
		nodes = JSON.parse(arrayText);
	} catch {
		// Hand-authored snapshots (e.g. Build Fountain Content) write the same
		// array as JavaScript object literals with unquoted keys. Evaluate it in
		// an empty sandbox so both styles are audited the same way.
		try {
			nodes = require('vm').runInNewContext(`(${arrayText})`, Object.create(null), { timeout: 1000 });
		} catch (error) {
			report.push(`FAIL  ${file}  liveNodes will not parse: ${error.message.split('\n')[0]}`);
			broken++;
			continue;
		}
	}

	workflowCount++;
	const findings = [];
	for (const node of nodes) walkParams(node.parameters, '', findings);
	chunkCount += 1;

	if (findings.length === 0) {
		if (!quiet) report.push(`ok    ${file.replace(/^.*\//, '')}  no unclosed strings`);
		continue;
	}

	broken += findings.length;
	report.push(`FAIL  ${file.replace(/^.*\//, '')}  ${findings.length} broken expression chunk(s)`);
	for (const finding of findings) {
		report.push(`        ${finding.param}: ${finding.problem}`);
		report.push(`        ${JSON.stringify(finding.code.slice(0, 200))}`);
	}
}

console.log(report.join('\n'));
console.log('');
console.log(
	`workflows: ${workflowCount} · broken expression chunks: ${broken}`,
);
if (broken === 0) console.log('Every expression chunk parses as a string.');
process.exit(broken === 0 ? 0 : 1);
NODE
