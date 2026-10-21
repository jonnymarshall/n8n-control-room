// Blocks the agent from merging its own pull requests.
//
// The rule: the AGENT creates the PR, JONNY merges it. Never merge yourself.
// "I'm ready to merge this" is readiness, not the go-ahead. The go-ahead is one of
// "merge it", "merge the PR", "go ahead and merge", "you can merge".
//
// This exists because the rule lived only in a skill (no-auto-merge) that the agent
// had to choose to load. On 2026-10-21 an agent read "I'm ready to merge this" as
// authorisation and merged PR #15, so the rule is now enforced in code as well.
//
// Ported from .claude/hooks/merge-guard.py so the same check runs under opencode.
//
// Covers:
//   - `gh pr merge`
//   - the REST merge endpoint via `gh api ... /pulls/<n>/merge`
//   - `git push` whose refspec targets main/master, including a bare `git push`
//     while main is checked out
//
// Deliberately NOT blocked: `git merge --ff-only origin/main` and other local
// syncs. Those move no PR into main; the push check covers publishing.
//
// Fail-open: malformed input or an unreadable git state allows the command. A
// confirmed merge attempt is the only thing that blocks.

let execSync = null
try {
  ;({ execSync } = await import("node:child_process"))
} catch {
  // Running without child_process (unusual): fall back to static matching only.
}

const MERGE_RULE =
  "The rule is: the agent creates the PR and Jonny merges it. " +
  "Report the PR URL and stop. Do not merge, and do not ask an approval prompt " +
  "to stand in for his instruction."

function blocked(reason) {
  return new Error(
    `Blocked by the merge guard: ${reason}\n` +
    MERGE_RULE +
    `\nEnforced by .opencode/plugins/merge-guard.js and .claude/hooks/merge-guard.py.`
  )
}

function currentBranch() {
  if (!execSync) return ""
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim()
  } catch {
    return ""
  }
}

// Split a shell command into simple command segments so `a && gh pr merge` is seen.
function segments(cmd) {
  return String(cmd || "")
    .split(/\n|&&|\|\||;|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Remove regions that are data, not commands: heredoc bodies (commit messages, PR
// bodies) and single-quoted spans. Without this, `git commit -m 'never run gh pr
// merge'` would block, and so would half the commit messages that explain this rule.
function stripTextRegions(cmd) {
  return String(cmd || "")
    .replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?\n\s*\2\b/g, "")
    .replace(/'[^']*'/g, "''")
}

function isProtectedRef(ref) {
  const dest = String(ref || "").includes(":") ? String(ref).split(":").pop() : ref
  return /^(refs\/heads\/)?(main|master)$/.test(String(dest || "").trim())
}

// Returns a reason string when the segment merges something, otherwise "".
function mergeAttempt(segment, branch) {
  // gh pr merge, with any flags or PR number.
  if (/\bgh\s+pr\s+merge\b/.test(segment)) {
    return "`gh pr merge` merges a pull request"
  }

  // gh api against the PR merge endpoint, e.g.
  //   gh api -X PUT repos/o/r/pulls/15/merge
  //   gh api repos/o/r/pulls/15/merge -f merge_method=squash
  if (/\bgh\s+api\b/.test(segment) && /\/pulls\/[^\s"']*\/merge\b/.test(segment)) {
    return "the GitHub API merge endpoint merges a pull request"
  }

  // git push targeting main/master.
  const push = segment.match(/\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*push\b(.*)$/)
  if (push) {
    const tokens = (push[1] || "").match(/(?:'[^']*'|"[^"]*"|\S)+/g) || []
    const positional = tokens
      .map((t) => t.replace(/^['"]|['"]$/g, ""))
      .filter((t) => t && !t.startsWith("-"))

    // `git push` with no refspec pushes the current branch.
    const refspecs = positional.slice(1)
    if (refspecs.length === 0) {
      if (branch === "main" || branch === "master") {
        return "`git push` with no refspec pushes the checked-out " + branch + " branch"
      }
      return ""
    }
    for (const ref of refspecs) {
      if (isProtectedRef(ref)) {
        return "`git push` sends commits straight to " + ref.replace(/^.*:/, "")
      }
    }
  }

  return ""
}

export const MergeGuard = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input.tool || "").toLowerCase()
      if (tool !== "bash") return

      const args = (output && output.args) || (input && input.args) || {}
      const raw = args.command || ""
      if (!raw) return

      const cmd = stripTextRegions(raw)
      const branch = /\bgit\s+[^\n]*\bpush\b/.test(cmd) ? currentBranch() : ""
      for (const segment of segments(cmd)) {
        const reason = mergeAttempt(segment, branch)
        if (reason) throw blocked(reason)
      }
    },
  }
}
