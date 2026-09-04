// Blocks n8n workflow pushes that would overwrite Jonny's manual edits.
//
// Ported from .claude/hooks/n8n-sync-guard.py (the Claude Code version) so the
// same protection runs under opencode. Live n8n state is the source of truth;
// this enforces it by refusing an update_workflow push when the live workflow
// is newer than the last-synced baseline recorded in .claude/n8n-sync-state.json.
//
// Fail-open: if creds are missing or n8n is unreachable, the push is allowed
// but a warning is logged. A confirmed drift is the only thing that blocks.

import fs from "node:fs"
import path from "node:path"

const LEDGER_REL = path.join(".claude", "n8n-sync-state.json")
const ENV_REL = ".env"
// n8n's updatedAt can lag a push by a fraction of a second / round to whole
// seconds; only treat n8n as "ahead" if newer than baseline by more than this.
const GRACE_SECONDS = 5

function readEnvFile(dir) {
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

function workflowIdFrom(args, resultText) {
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

async function fetchUpdatedAt(baseUrl, apiKey, id) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
    headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return { updatedAt: data.updatedAt, name: data.name }
}

export const N8nSyncGuard = async ({ directory, client }) => {
  const env = { ...readEnvFile(directory), ...process.env }
  const baseUrl = (env.N8N_URL || "").replace(/\/+$/, "")
  const apiKey = env.N8N_API_KEY || ""

  const log = async (level, message) => {
    try {
      await client.app.log({ body: { service: "n8n-sync-guard", level, message } })
    } catch {}
  }

  return {
    "tool.execute.before": async (input, output) => {
      // Guard the push tool only. create_workflow_from_code makes a NEW workflow
      // (nothing live to clobber), so it doesn't need the pre-check.
      if (!input.tool.includes("update_workflow")) return
      const id = workflowIdFrom(output.args, null)
      if (!id) return // nothing to compare against (e.g. no id in args) -> allow

      if (!baseUrl || !apiKey) {
        await log("warn", `n8n-sync-guard: N8N_URL/N8N_API_KEY missing; manual-edit check skipped for workflow ${id}. Push allowed, but if Jonny may have edited it by hand, pull it first with get_workflow_details.`)
        return
      }

      let live
      try {
        live = await fetchUpdatedAt(baseUrl, apiKey, id)
      } catch (e) {
        await log("warn", `n8n-sync-guard: couldn't reach n8n to verify workflow ${id} (${e.message}). Push allowed (fail-open); the manual-edit check did not run.`)
        return
      }

      const entry = loadLedger(directory)[id]
      if (!entry || !entry.updatedAt) {
        await log("info", `n8n-sync-guard: no sync baseline yet for workflow ${id} (${live.name || "?"}); allowing this push and recording its state. Future manual edits WILL be detected before the next push.`)
        return
      }

      const baseTs = Date.parse(entry.updatedAt)
      const currTs = Date.parse(live.updatedAt)
      if (Number.isNaN(baseTs) || Number.isNaN(currTs)) {
        await log("warn", `n8n-sync-guard: couldn't compare timestamps for workflow ${id}; push allowed without the manual-edit check.`)
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
    },

    "tool.execute.after": async (input, output) => {
      const isWrite = input.tool.includes("update_workflow") || input.tool.includes("create_workflow_from_code")
      const isPull = input.tool.includes("get_workflow_details")
      if (!isWrite && !isPull) return
      const id = workflowIdFrom(input.args, output.output)
      if (!id || !baseUrl || !apiKey) return
      try {
        const live = await fetchUpdatedAt(baseUrl, apiKey, id)
        if (live.updatedAt) {
          saveBaseline(directory, id, live.updatedAt, live.name, isPull ? "pull" : "push")
        }
      } catch {}
    },
  }
}
