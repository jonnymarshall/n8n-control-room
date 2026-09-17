// Blocks the agent from reading or printing secrets.
//
// Ported from ~/.claude/hooks/block-secrets.py (the Claude Code version) so the
// same protection runs under opencode. That hook only fires inside Claude Code,
// which is how a Read on .env slipped through under opencode (it was only
// stopped by a manual permission prompt).
//
// Covers:
//   - Read/Edit/Write (and their subagent aliases) on sensitive file paths.
//   - Bash commands that reference sensitive files or dump the environment.
//
// Behaviour matches the Python original: template dotenv files (.env.example
// etc.) are exempt, heredoc bodies and commit/PR message commands are not
// path-scanned, inert segments (descriptive echo / git metadata queries) are
// skipped, and malformed input fails OPEN (allows) so it never breaks
// unrelated tool calls. A confirmed sensitive target is the only thing that
// blocks.

// Leading separator: start-of-string, path separator, or any non-identifier char.
const SEP = "(?:^|[^A-Za-z0-9_])"

// Template / example dotenv files contain placeholders, not real secrets.
const TPL = "example|sample|template|tpl|dist|defaults|schema"

const SECRET_PATTERNS = [
  // dotenv variants (.env, .env.local, .env.production, ...) but NOT templates.
  `${SEP}\\.env(?!\\.(?:${TPL})\\b)(?:$|\\.[A-Za-z0-9._-]+|[^A-Za-z0-9])`,
  // credential / secret JSON files
  `${SEP}credentials\\.json\\b`,
  `${SEP}secrets?\\.json\\b`,
  `${SEP}service-account[A-Za-z0-9._-]*\\.json\\b`,
  // SSH private keys
  `${SEP}id_(?:rsa|ed25519|ecdsa|dsa)(?:$|[^A-Za-z0-9])`,
  `\\.ssh/[A-Za-z0-9._-]*(?:_key|\\.key)\\b`,
  // cloud creds
  `\\.aws/credentials\\b`,
  `\\.config/gcloud/.*credential`,
  // package-registry / shell creds files
  `${SEP}\\.npmrc\\b`,
  `${SEP}\\.pypirc\\b`,
  `${SEP}\\.netrc\\b`,
  `${SEP}\\.pgpass\\b`,
  // key / cert / keystore extensions
  `\\.(?:pem|key|p12|pfx|asc|gpg|kdbx|jks)(?:$|[^A-Za-z0-9])`,
  // live per-process environment
  `/proc/[^/\\s]+/environ\\b`,
]
const SECRET_RE = new RegExp(SECRET_PATTERNS.join("|"))

// Commands that dump the environment (or all shell variables) to stdout.
// Bare verbs are blocked; assignment / run-with-env / option forms are not.
const LB = "(?:^|[\\s;|&`$(])"
const END = "(?:$|[|>;&\\n)])"
const ENV_DUMP_PATTERNS = [
  `${LB}printenv(?:\\s|$|[|>;&)])`,              // printenv [NAME] prints values
  `${LB}env\\s*${END}`,                           // bare `env`, `env | ...` (not `env VAR=...`)
  `${LB}set\\s*${END}`,                           // bare `set` (not `set -x`)
  `${LB}export\\s*${END}`,                        // bare `export`
  `${LB}export\\s+-p\\b`,
  `${LB}(?:declare|typeset)\\s+-[A-Za-z]*p`,      // `declare -p ...` prints values
  `${LB}(?:declare|typeset)\\s+-[A-Za-z]+\\s*${END}`,
  `${LB}(?:declare|typeset)\\s*${END}`,           // bare `declare` / `typeset`
]
const ENV_DUMP_RE = new RegExp(ENV_DUMP_PATTERNS.join("|"))

// Heredoc bodies are text content (commit messages, PR bodies, doc strings),
// never interpreted as file paths. Strip them before path matching so
// mentioning ".env" in a commit message doesn't trip the file check.
const HEREDOC_RE = /<<-?\s*['"]?(\w+)['"]?\s*\n[\s\S]*?\n\s*\1\s*(?:\n|$)/g

// Commit / PR / issue creation commands take human-readable text as args; they
// don't open the named files. Skip the file regex (still check env dumps).
const TEXT_ONLY_CMD_RE =
  /^\s*(?:git\s+commit(?!\s+(?:-F|--file)\b)|gh\s+(?:pr|issue)\s+(?:create|edit|comment))\b/

// Segments provably unable to leak file contents: descriptive echo/printf of
// literal text, or git metadata queries (ls-files / check-ignore / check-attr)
// that print pathnames, never contents. Splitting is deliberately coarse: we
// only ever REMOVE segments we are confident are inert, so a content read in
// another segment survives the split and is still scanned.
const SEGMENT_SPLIT_RE = /[;&|\n]/
const INERT_SEGMENT_RE = /^\s*(?:echo|printf|git\s+(?:ls-files|check-ignore|check-attr))\b/

function stripInertSegments(cmd) {
  const kept = []
  for (const seg of cmd.split(SEGMENT_SPLIT_RE)) {
    if (INERT_SEGMENT_RE.test(seg) && !seg.includes("$") && !seg.includes("`")) continue
    kept.push(seg)
  }
  return kept.join("\n")
}

function blocked(reason) {
  return new Error(
    `Blocked by the secrets guard: ${reason}\n` +
    `Ported from ~/.claude/hooks/block-secrets.py to ` +
    `.opencode/plugins/block-secrets.js. Edit or remove to change.`
  )
}

// Tool names that open a file path. Covers this repo's tools plus the common
// Claude-Code-style aliases subagents may expose.
const FILE_TOOLS = new Set(["read", "edit", "write", "notebookedit", "multiedit"])

export const BlockSecrets = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input.tool || "").toLowerCase()
      const args = (output && output.args) || {}

      if (FILE_TOOLS.has(tool)) {
        const path = args.filePath || args.file_path || args.notebook_path || args.path || ""
        if (path && SECRET_RE.test(path)) {
          throw blocked(`${input.tool} on sensitive path '${path}'`)
        }
        return
      }

      if (tool === "bash") {
        const cmd = args.command || ""
        // Env-dump check runs against the raw command: dumping values is not
        // legitimate inside heredocs or commit messages either.
        if (ENV_DUMP_RE.test(cmd)) {
          throw blocked(
            "bash command would print environment/shell variable values " +
            "(printenv / env / set / export / declare -p); a secret could leak to stdout"
          )
        }
        // Strip text-content regions, then provably-inert segments, before the
        // file-path scan. Skip the file scan entirely for text-arg commands.
        let stripped = cmd.replace(HEREDOC_RE, "")
        stripped = stripInertSegments(stripped)
        if (TEXT_ONLY_CMD_RE.test(stripped)) return
        if (SECRET_RE.test(stripped)) {
          throw blocked(`bash command references a sensitive file: ${stripped.slice(0, 200)}`)
        }
      }
    },
  }
}

export default BlockSecrets
