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
// Migrated to the OpenCode 2 plugin API on 2026-11-07: Plugin.define with an id and
// a setup function, directory from ctx.location.directory, and the tool result read
// from the after-hook event instead of a separate output object. OpenCode 2 has no
// structured logging method for plugins, so advisory messages go to stderr
// (visible with `--print-logs`).
//
// The readme and System Map reminders are separate duties; this only covers the
// snapshot.

import fs from "node:fs"
import path from "node:path"
import { Plugin } from "@opencode/plugin"

let execSync = null

async function loadExecSync() {
  if (execSync) return execSync
  try {
    ;({ execSync } = await import("node:child_process"))
  } catch {
    // No child_process available: the hook becomes a no-op logger.
  }
  return execSync
}

// Tool names arrive bare (update_workflow) or namespaced
// (tools.n8n.n8n_update_partial_workflow, n8n_n8n_update_partial_workflow), the
// same reason n8n-sync-guard's matcher is unanchored. Allow any namespace prefix
// and any number of n8n_ segments, then match the tail.
const PUSH_TOOL_RE = /(?:^|[.\s])(?:n8n_)*(?:update_(?:partial_|full_)?workflow|create_workflow(?:_from_code)?)$/
const SNAPSHOT_REL = path.join("scripts", "deploy", "workflows", "snapshot-sdk.sh")
const SDK_DIR_REL = path.join("scripts", "deploy", "workflows")
const HEAD_BYTES = 8192

function argsOf(input) {
  return input && typeof input === "object" ? input : {}
}

// OpenCode 2 carries the tool result on the hook event as { content, output,
// metadata }. Flatten whichever of those holds the text so the success check and
// the id extraction keep working.
function resultText(result) {
  if (!result || typeof result !== "object") return ""
  if (typeof result.content === "string") return result.content
  if (Array.isArray(result.content)) {
    return result.content.map((part) => (part && part.type === "text" ? part.text : "")).join("\n")
  }
  if (result.output !== undefined) {
    return typeof result.output === "string" ? result.output : JSON.stringify(result.output)
  }
  return ""
}

function idFrom(args, text) {
  if (args && typeof args === "object") {
    for (const k of ["workflowId", "id", "workflow_id"]) {
      if (args[k]) return String(args[k])
    }
  }
  if (text) {
    const m = String(text).match(/"(?:workflowId|id)"\s*:\s*"([A-Za-z0-9]+)"/)
    if (m) return m[1]
  }
  return null
}

function pushFailed(text) {
  const body = typeof text === "string" ? text : JSON.stringify(text || "")
  return /"success"\s*:\s*false|"saved"\s*:\s*false/.test(body)
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

export default Plugin.define({
  id: "n8n-control-room.sdk-snapshot",
  async setup(ctx) {
    const directory = ctx.location.directory
    await loadExecSync()

    const log = (level, message) => {
      console.error(`[n8n-sdk-snapshot] ${level}: ${message}`)
    }

    await ctx.tool.hook("execute.after", (event) => {
      if (!execSync) return
      if (event.status !== "completed") return
      if (!PUSH_TOOL_RE.test(String(event.tool || ""))) return

      const text = resultText(event.result)
      if (pushFailed(text)) return

      const id = idFrom(argsOf(event.input), text)
      if (!id) return

      const script = path.join(directory, SNAPSHOT_REL)
      if (!fs.existsSync(script)) {
        log("warn", `${SNAPSHOT_REL} not found; snapshot for ${id} not refreshed`)
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
        log(
          "info",
          `refreshed ${wrote ? wrote[1] : slug || id + ".sdk.js"} from live workflow ${id}`
        )
      } catch (e) {
        const detail = (e && e.stderr ? String(e.stderr) : e && e.message ? e.message : "unknown error")
          .split("\n")[0]
          .slice(0, 300)
        log(
          "warn",
          `could NOT refresh the snapshot for ${id} (${detail}). Run ./${SNAPSHOT_REL} ${id} by hand.`
        )
      }
    })
  },
})
