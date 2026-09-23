#!/usr/bin/env node
// Minimal MCP stdio server: lets Codex delegate decisions to TypeSafe Jev.
// Env: TYPESAFE_API_KEY (required), JEV_MODEL (default jev-latest)
import { createInterface } from "node:readline";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL || "jev-latest";

const TOOL = {
  name: "jev_ask",
  description:
    "Ask TypeSafe Jev, a System One decision model, typed questions about a state and get structured answers " +
    "(choice/score/noul with probabilities and confidence). Use it for judgments and decisions: classify or route " +
    "(choice), rate on a rubric (score), check whether something holds (noul). Jev does not write code, produce prose, " +
    "or reason step by step - do that yourself and use this only for the decision. Answers come back keyed by question id. " +
    "Ask every independent question in a single call: they run in parallel and are far cheaper batched.",
  inputSchema: {
    type: "object",
    properties: {
      state: {
        description:
          "What to judge: a string, or a structured object/array holding the relevant facts (records, messages, candidates).",
      },
      questions: {
        type: "object",
        description:
          'Map of question id -> question. noul: {type:"noul", instructions, criteria?:{true,false}}. ' +
          'choice: {type:"choice", instructions, criteria:{option: description|null, ...}}. ' +
          'score: {type:"score", instructions, criteria:[level, level, ...]} (2-10 ordered levels). ' +
          "Put the judgment in instructions; question ids are not sent to the model.",
        additionalProperties: true,
      },
    },
    required: ["state", "questions"],
  },
};

async function ask(args) {
  if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is not set in the MCP server environment");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state: args.state, model: MODEL, questions: args.questions }),
  });
  const body = await res.text();
  if (!res.ok) return { content: [{ type: "text", text: `TypeSafe ${res.status}: ${body}` }], isError: true };
  return { content: [{ type: "text", text: body }] };
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const ok = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

createInterface({ input: process.stdin }).on("line", async (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (id === undefined) return; // notification
  try {
    if (method === "initialize") {
      ok(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "jev", version: "1.0.0" },
      });
    } else if (method === "tools/list") {
      ok(id, { tools: [TOOL] });
    } else if (method === "tools/call") {
      ok(id, params?.name === TOOL.name ? await ask(params.arguments ?? {}) : { content: [], isError: true });
    } else {
      fail(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    fail(id, -32603, String(err?.message ?? err));
  }
});
