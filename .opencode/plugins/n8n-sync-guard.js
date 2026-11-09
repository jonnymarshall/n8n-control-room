// Blocks n8n workflow pushes that would overwrite Jonny's manual edits.
//
// Ported from .claude/hooks/n8n-sync-guard.py (the Claude Code version) so the
// same protection runs under opencode. Live n8n state is the source of truth;
// this enforces it by refusing an update_workflow push when the live workflow
// is newer than the last-synced baseline recorded in .claude/n8n-sync-state.json.
//
// Migrated to the OpenCode 2 plugin API on 2026-11-07: Plugin.define with an id and
// a setup function, directory from ctx.location.directory, arguments from the hook
// event rather than a separate args object, and the tool result read from
// event.result. OpenCode 2 has no structured logging method for plugins, so
// advisory messages go to stderr (visible with `--print-logs`).
//
// Fail-open: if creds are missing or n8n is unreachable, the push is allowed
// but a warning is logged. A confirmed drift is the only thing that blocks.

import fs from "node:fs"
import path from "node:path"
import { Plugin } from "@opencode/plugin"

const LEDGER_REL = path.join(".claude", "n8n-sync-state.json")
const ENV_REL = ".env"
// n8n's updatedAt can lag a push by a fraction of a second / round to whole
// seconds; only treat n8n as "ahead" if newer than baseline by more than this.
const GRACE_SECONDS = 5

function readEnvFile(dir) {
  /** @type {Record<string, string>} */
  const out = {}
  try {
    const text = fs.readFileSync(path.join(dir, ENV_REL), "utf8")
    for (const line of text.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#") || !t.includes("=")) continue
      const i = t.indexOf("=")
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      out[k] = v
    }
  } catch {}
  return out
}

function loadLedger(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, LEDGER_REL), "utf8"))
  } catch {
    return {}
  }
}

function saveBaseline(dir, id, updatedAt, name, how) {
  const ledger = loadLedger(dir)
  ledger[String(id)] = {
    updatedAt,
    name,
    syncedVia: how,
    syncedAt: new Date().toISOString(),
  }
  try {
    fs.writeFileSync(path.join(dir, LEDGER_REL), JSON.stringify(ledger, null, 2))
  } catch {}
}

// Tool-name matching. MCP exposes the push as n8n_update_partial_workflow,
// n8n_update_full_workflow, or (older builds) update_workflow. Matching only the
// literal "update_workflow" silently skipped every partial push, which is the
// common case, so the manual-edit guard never ran. Match the family instead.
const UPDATE_TOOL_RE = /update_(partial_|full_)?workflow$/
const CREATE_FROM_CODE_RE = /create_workflow_from_code$/
const PULL_TOOL_RE = /get_workflow_details$|get_workflow$/

const isUpdateTool = (name) => UPDATE_TOOL_RE.test(String(name || ""))
const isCreateFromCodeTool = (name) => CREATE_FROM_CODE_RE.test(String(name || ""))
const isPullTool = (name) => PULL_TOOL_RE.test(String(name || ""))

// Tool arguments arrive on the hook event as `input`. Older shapes put them on
// the output object; read whichever exists, otherwise the id is never found and
// the guard silently does nothing.
function argsOf(input) {
  return input && typeof input === "object" ? input : {}
}

// OpenCode 2 carries the tool result as { content, output, metadata }. Flatten
// whichever of those holds the text so id extraction keeps working.
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

function workflowIdFrom(args, text) {
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

async function fetchUpdatedAt(baseUrl, apiKey, id) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
    headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return { updatedAt: data.updatedAt, name: data.name }
}

export default Plugin.define({
  id: "n8n-control-room.sync-guard",
  async setup(ctx) {
    const directory = ctx.location.directory
    const env = { ...readEnvFile(directory), ...process.env }
    const baseUrl = (env.N8N_URL || "").replace(/\/+$/, "")
    const apiKey = env.N8N_API_KEY || ""

    const log = (level, message) => {
      console.error(`[n8n-sync-guard] ${level}: ${message}`)
    }

    await ctx.tool.hook("execute.before", async (event) => {
      // Guard every push tool. create_workflow_from_code makes a NEW workflow
      // (nothing live to clobber), so it doesn't need the pre-check.
      if (!isUpdateTool(event.tool)) return
      const id = workflowIdFrom(argsOf(event.input), null)
      if (!id) return // nothing to compare against (e.g. no id in args) -> allow

      if (!baseUrl || !apiKey) {
        log("warn", `N8N_URL/N8N_API_KEY missing; manual-edit check skipped for workflow ${id}. Push allowed, but if Jonny may have edited it by hand, pull it first with get_workflow_details.`)
        return
      }

      let live
      try {
        live = await fetchUpdatedAt(baseUrl, apiKey, id)
      } catch (e) {
        log("warn", `couldn't reach n8n to verify workflow ${id} (${e.message}). Push allowed (fail-open); the manual-edit check did not run.`)
        return
      }

      const entry = loadLedger(directory)[id]
      if (!entry || !entry.updatedAt) {
        log("info", `no sync baseline yet for workflow ${id} (${live.name || "?"}); allowing this push and recording its state. Future manual edits WILL be detected before the next push.`)
        return
      }

      const baseTs = Date.parse(entry.updatedAt)
      const currTs = Date.parse(live.updatedAt)
      if (Number.isNaN(baseTs) || Number.isNaN(currTs)) {
        log("warn", `couldn't compare timestamps for workflow ${id}; push allowed without the manual-edit check.`)
        return
      }

      const drift = (currTs - baseTs) / 1000
      if (drift > GRACE_SECONDS) {
        throw new Error(
          `STOP — workflow ${id} ("${entry.name || "?"}") was modified on n8n AFTER it was last synced.\n` +
          `  • Last-known version (baseline): ${entry.updatedAt}\n` +
          `  • Live on n8n now:               ${live.updatedAt}\n` +
          `This almost always means Jonny edited it by hand in the n8n UI. Pushing now would OVERWRITE those manual changes.\n\n` +
          `Do this first:\n` +
          `  1. Call get_workflow_details({workflowId: "${id}"}) to see the live version (this refreshes the sync baseline).\n` +
          `  2. Diff it against the local .sdk.js and merge Jonny's manual changes in.\n` +
          `  3. Then re-run update_workflow — it will be allowed once the latest has been pulled.\n` +
          `If you're certain you want to overwrite the live version anyway, tell Jonny what manual changes will be lost and get the OK before forcing the push.`
        )
      }
      // In sync -> allow silently.
    })

    await ctx.tool.hook("execute.after", async (event) => {
      // Record a baseline after any successful push, and after a pull (a pull is
      // how an agent acknowledges the live version, so it refreshes the baseline
      // too). Without this the next push has nothing to compare against.
      if (event.status !== "completed") return
      const isWrite = isUpdateTool(event.tool) || isCreateFromCodeTool(event.tool)
      const isPull = isPullTool(event.tool)
      if (!isWrite && !isPull) return
      const id = workflowIdFrom(argsOf(event.input), resultText(event.result))
      if (!id || !baseUrl || !apiKey) return
      try {
        const live = await fetchUpdatedAt(baseUrl, apiKey, id)
        if (live.updatedAt) {
          saveBaseline(directory, id, live.updatedAt, live.name, isPull ? "pull" : "push")
        }
      } catch {}
    })
  },
})
