import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyGrokFileToolsOverlay,
  applyInstructionOverlay,
  applyModelFamilyPrompt,
  grokFileToolsOverlayFor,
} from "../src/instruction-overlays.mjs";
import { MODEL_BY_SLUG } from "../src/model-registry.mjs";

test("family prompts add bounded behavioral guidance across custom and reseller providers", () => {
  for (const [id, expected, behavior] of [
    ["anthropic/claude-opus-5-5", "Claude", /smallest complete solution.*requested scope/],
    ["moonshotai/kimi-k3", "Kimi", /After each tool result.*observed state/],
    ["bro/global.moonshotai.kimi-k3", "Kimi", /After each tool result.*observed state/],
    ["x-ai/grok-4.7", "Grok", /supported by actual tool results.*unverified/],
    ["google/gemini-4-argon", "Gemini", /Check prerequisites.*bounded retries for transient errors.*diagnose other failures/],
    ["Qwen/Qwen3.8-27B", "Qwen", /structured tool-call interface.*exact supplied tool names/],
    ["z-ai/glm-5.3", "GLM", /completion criteria.*Interpret each tool result/],
    ["MiniMaxAI/MiniMax-M3", "MiniMax", /adapt to the current environment.*reassess progress/],
    ["deepseek-ai/deepseek-v4-pro", "DeepSeek", /Continue from returned tool results.*evidence/],
  ]) {
    const model = { provider: "custom", slug: "custom/unrelated", upstreamModel: id };
    const result = applyModelFamilyPrompt("Keep tools and permissions.", model);
    assert.ok(result.startsWith("Keep tools and permissions.\n\n"));
    assert.ok(result.includes(`You are ${expected},`), id);
    assert.match(result, /tools and capabilities supplied in this session/);
    assert.match(result, /within the session's instructions, permissions, and response format/);
    assert.match(result, behavior, id);
    assert.doesNotMatch(result, /<think>|<tool_call>|\/no_think|\/think|Action:|Observation:|reasoning_content|clear_thinking/);
    assert.equal(applyModelFamilyPrompt(result, model), result);
  }
});

test("family detection avoids unknown models, misleading labels, and R1 variants", () => {
  for (const id of ["opaque-model", "not-claude", "deepseek-r1", "DeepSeek-R1-0528",
    "deepseek-r1-distill-qwen-32b", "deepseek-r1:free", "qwenish"]) {
    assert.equal(applyModelFamilyPrompt("Base.", {
      upstreamModel: id, provider: "anthropic-api", slug: "custom/claude-opus",
      displayName: "Claude",
    }), "Base.", id);
  }
  assert.equal(applyModelFamilyPrompt(undefined, {}), undefined);
  assert.match(applyModelFamilyPrompt("Base.", { slug: "custom/kimi-k3" }), /You are Kimi/);
  assert.match(applyModelFamilyPrompt("Base.", {
    provider: "kimi-oauth", upstreamModel: "k3",
  }), /You are Kimi.*After each tool result/s);
  assert.equal(applyModelFamilyPrompt("Base.", {
    provider: "custom", upstreamModel: "k3",
  }), "Base.");
});

test("Grok 4.6 OAuth distinguishes local files from discovered MCP resources", () => {
  const model = MODEL_BY_SLUG.get("grok-oauth/grok-4.6");
  assert.equal(model?.instructionOverlay, "filesystem-mcp-discipline");

  const instructions = applyInstructionOverlay("Base instructions.", model.instructionOverlay);
  assert.match(instructions, /local filesystem paths as files, never as MCP resource URIs/i);
  assert.match(instructions, /server name and URI returned by MCP.*discovery/i);
  assert.match(instructions, /Never invent an MCP server name such as file/i);
  assert.match(instructions, /unknown server or invalid URI.*do not repeat/is);
  assert.match(instructions, /Keep using read_mcp_resource for valid resources/i);
});

test("Grok file-tool overlay is available without replacing the catalog MCP overlay", () => {
  const model = MODEL_BY_SLUG.get("grok-oauth/grok-4.6");
  assert.equal(model?.instructionOverlay, "filesystem-mcp-discipline");
  const gated = applyInstructionOverlay("Base instructions.", "grok-file-tools");
  assert.match(gated, /search_replace/);
  assert.match(gated, /read_file/);
  assert.match(gated, /run_terminal_command is only for processes/i);
  assert.match(gated, /Do not dump minified node_modules/i);
  assert.doesNotMatch(gated, /Create files with write/);
  assert.doesNotMatch(gated, /write is create-only/);
  const withWrite = applyInstructionOverlay("Base instructions.", "grok-file-tools-write");
  assert.match(withWrite, /Create files with write/);
  assert.match(withWrite, /write is create-only/);
});

test("file-tool overlay only names the installed façade tools", () => {
  const linesOnly = grokFileToolsOverlayFor(new Set(["replace_lines"]));
  assert.match(linesOnly, /replace_lines.*complete old and new lines/);
  assert.doesNotMatch(linesOnly, /search_replace|run_terminal_command|read_file/);
  const searchOnly = grokFileToolsOverlayFor(new Set(["search_replace"]));
  assert.match(searchOnly, /search_replace/);
  assert.doesNotMatch(searchOnly, /read_file/);
  assert.doesNotMatch(searchOnly, /run_terminal_command/);
  const applied = applyGrokFileToolsOverlay("Base.", new Set(["search_replace", "write"]));
  assert.match(applied, /Create files with write/);
  assert.doesNotMatch(applied, /read_file/);
});

test("efficient-agentic-v2 keeps GLM execution discipline without duplicating the Sol base contract", () => {
  const legacy = applyInstructionOverlay("Base instructions.", "efficient-agentic");
  const v2 = applyInstructionOverlay("Base instructions.", "efficient-agentic-v2");

  assert.match(v2, /minimum sufficient tool output/i);
  assert.match(v2, /credentials|secrets|tokens/i);
  assert.match(v2, /behavioral RED suite/i);
  assert.match(v2, /invalidate that hypothesis/i);
  assert.match(v2, /On Windows/i);
  assert.match(v2, /wait timeout is a polling result/i);
  assert.match(v2, /Do not interrupt a running child solely because.*wait/i);
  assert.match(v2, /Do not spawn a replacement.*mutable task/i);

  assert.doesNotMatch(v2, /Continue through routine tool work/i);
  assert.doesNotMatch(v2, /Batch independent reads and checks/i);
  assert.doesNotMatch(v2, /After a tool result, continue execution/i);
  assert.doesNotMatch(v2, /Lead the final response/i);
  assert.ok(v2.length < legacy.length, "v2 should be smaller than the legacy overlay");
});
