import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

// Snapshot of live workflow uSkbv5YFty7GLb2l, fetched 2026-09-30.
// Parameters and node settings are intentionally kept verbatim from live.
const liveNodes = [
  { id: "trigger", name: "Execute Workflow Trigger", type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1.2, position: [0,300], parameters: {"inputSource":"passthrough"} },
  { id: "build-description", name: "Build Description", type: "n8n-nodes-base.code", typeVersion: 2, position: [220,300], parameters: {"mode":"runOnceForAllItems","language":"javaScript","jsCode":"const bySection = (l, section) => l.filter(x => x.Section === section).sort((a,b) => Number(a['Sort Order'] || 0) - Number(b['Sort Order'] || 0));\nconst line = x => '- ' + String(x.Description || x.Name || '').trim() + ' (Link: <' + x.URL + '>)';\nconst hardLines = text => String(text).split('\\n').map(l => l.replace(/\\s+$/, '') + '\\\\').join('\\n');\nreturn $input.all().map(i => {\n  const j = i.json;\n  const links = (Array.isArray(j.links) ? j.links : []).filter(x => x.Active === true && (!Array.isArray(x.Destinations) || x.Destinations.includes('Episodes')));\n  const parts = [String(j.summary || '').trim(), '**Chapters**', hardLines(j.chapters || '')];\n  const affiliates = bySection(links, 'Affiliate');\n  const hosts = bySection(links, 'Host');\n  if (affiliates.length) parts.push('**Affiliate Links**', hardLines(affiliates.map(line).join('\\n')));\n  if (hosts.length) parts.push('**Host Links**', hardLines(hosts.map(line).join('\\n')));\n  return { json: { ...j, description: parts.join('\\n\\n') } };\n});"} },
];

const nodesByName = {};
for (const live of liveNodes) {
  const { type, typeVersion, credentials, ...config } = live;
  if (credentials) {
    config.credentials = Object.fromEntries(
      Object.entries(credentials).map(([credentialType, reference]) => [credentialType, newCredential(reference.name)])
    );
  }
  nodesByName[live.name] = (type === 'n8n-nodes-base.scheduleTrigger' || type === 'n8n-nodes-base.executeWorkflowTrigger' ? trigger : node)({ type, version: typeVersion, config, output: [{}] });
}

const connections = [
  ["Execute Workflow Trigger", 0, "Build Description"],
];

const wf = workflow("uSkbv5YFty7GLb2l", "BA - Subworkflow - Build Fountain Content").settings({"timezone":"America/New_York","executionOrder":"v1"});

for (const live of liveNodes) wf.add(nodesByName[live.name]);
for (const [source, output, target] of connections) { wf.connect(nodesByName[source], output, nodesByName[target], 0); }

export default wf;
