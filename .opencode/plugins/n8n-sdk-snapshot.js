// Refreshes a workflow's .sdk.js snapshot after any successful push.
//
// Why this exists: every workflow in this repo is supposed to keep a local
// snapshot in scripts/deploy/workflows/, but the refresh was only ever an
// instruction in AGENTS.md, so agents forgot it. On 2026-10-23 three live
// workflows had changes that never reached their snapshots (and one had weeks of
// them), which meant the local copies were lying about the source of truth.
//
// This turns the reminder into code: after update_workflow (partial or full) or a
// workflow create succeeds, it runs scripts/deploy/workflows/snapshot-sdk.sh for
// that workflow. Fail-open in every direction. A snapshot that cannot be written
// logs a warning and leaves the push alone, because a missing snapshot must never
// fail an otherwise good deploy.
//
// The readme and System Map reminders are separate duties; this only covers the
// snapshot.

import fs from "node:fs"
import path from "node:path"

let execSync = null
try {
  ;({ execSync } = await import("node:child_process"))
} catch {
  // No child_process available: the hook becomes a no-op logger.
}

// Tool names arrive bare (update_workflow) or fully qualified
// (tools.n8n.n8n_update_partial_workflow), the same reason n8n-sync-guard's
// matcher is unanchored. Match the tail, not the whole string.
const PUSH_TOOL_RE = /(^|\.)(n8n_)?(update_(partial_|full_)?workflow|create_workflow(_from_code)?)$/
const SNAPSHOT_REL = path.join("scripts", "deploy", "workflows", "snapshot-sdk.sh")
const SDK_DIR_REL = path.join("scripts", "deploy", "workflows")
const HEAD_BYTES = 8192

function argsOf(input, output) {
  if (output && output.args && typeof output.args === "object") return output.args
  if (input && input.args && typeof input.args === "object") return input.args
  return {}
}

function idFrom(args, resultText) {
  if (args && typeof args === "object") {
    for (const k of ["workflowId", "id", "workflow_id"]) {
      if (args[k]) return String(args[k])
    }
  }
  if (resultText) {
    const m = String(resultText).match(/"(?:workflowId|id)"\s*:\s*"([A-Za-z0-9]+)"/)
    if (m) return m[1]
  }
  return null
}

function pushFailed(resultText) {
  const text = typeof resultText === "string" ? resultText : JSON.stringify(resultText || "")
  return /"success"\s*:\s*false|"saved"\s*:\s*false/.test(text)
}

// Reuse the filename a workflow already has. Without this the snapshot script
// would slugify the display name and leave a second, differently named file
// behind. Returns null for a workflow with no snapshot yet, which is exactly when
// the script's own slugification should run.
function existingSlug(directory, id) {
  const dir = path.join(directory, SDK_DIR_REL)
  let entries = []
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith(".sdk.js"))
  } catch {
    return null
  }
  const idPattern = new RegExp(`workflow\\s*\\(\\s*["']${id}["']`)
  for (const file of entries) {
    let head = ""
    try {
      const fd = fs.openSync(path.join(dir, file), "r")
      const buf = Buffer.alloc(HEAD_BYTES)
      const read = fs.readSync(fd, buf, 0, HEAD_BYTES, 0)
      fs.closeSync(fd)
      head = buf.subarray(0, read).toString("utf8")
    } catch {
      continue
    }
    if (head.includes(`Snapshot of live workflow ${id}`) || idPattern.test(head)) {
      return file.replace(/\.sdk\.js$/, "")
    }
  }
  return null
}

export const N8nSdkSnapshot = async ({ directory, client }) => {
  const log = async (level, message) => {
    try {
      await client.app.log({ body: { service: "n8n-sdk-snapshot", level, message } })
    } catch {}
  }

  return {
    "tool.execute.after": async (input, output) => {
      if (!execSync) return
      if (!PUSH_TOOL_RE.test(String(input.tool || ""))) return

      const resultText = output && output.output
      if (pushFailed(resultText)) return

      const id = idFrom(argsOf(input, output), resultText)
      if (!id) return

      const script = path.join(directory, SNAPSHOT_REL)
      if (!fs.existsSync(script)) {
        await log("warn", `n8n-sdk-snapshot: ${SNAPSHOT_REL} not found; snapshot for ${id} not refreshed`)
        return
      }

      const slug = existingSlug(directory, id)
      const args = slug ? `${id} ${slug}` : id
      try {
        const out = execSync(`./${SNAPSHOT_REL} ${args}`, {
          cwd: directory,
          timeout: 60000,
          encoding: "utf8",
          stdio: "pipe",
        })
        const wrote = String(out).match(/wrote\s+(\S+)/)
        await log(
          "info",
          `n8n-sdk-snapshot: refreshed ${wrote ? wrote[1] : slug || id + ".sdk.js"} from live workflow ${id}`
        )
      } catch (e) {
        const detail = (e && e.stderr ? String(e.stderr) : e && e.message ? e.message : "unknown error")
          .split("\n")[0]
          .slice(0, 300)
        await log(
          "warn",
          `n8n-sdk-snapshot: could NOT refresh the snapshot for ${id} (${detail}). Run ./${SNAPSHOT_REL} ${id} by hand.`
        )
      }
    },
  }
}
