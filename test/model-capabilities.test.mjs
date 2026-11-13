import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONSERVATIVE_MODEL_DEFAULTS,
  mergeModelMetadata,
  mergeDiscoveredModels,
  modelMetadataFromPreset,
  modelMetadataFromProviderRecord,
  normalizeModelMetadata,
} from "../src/model-capabilities.mjs";
const { discoverProviderModels } = await import("../src/model-discovery.mjs");

test("model metadata accepts canonical records and ignores null pricing", () => {
  assert.deepEqual(
    modelMetadataFromProviderRecord({
      upstreamId: "local/qwen",
      displayName: "Local Qwen",
      pricing: null,
      supportsTools: true,
    }),
    {
      upstreamId: "local/qwen",
      displayName: "Local Qwen",
      supportsTools: true,
    },
  );
});

test("untrusted provider metadata cannot select a router request profile", () => {
  assert.equal(
    modelMetadataFromProviderRecord({ id: "provider/model", requestProfile: "glm-thinking" }).requestProfile,
    undefined,
  );
  assert.equal(
    modelMetadataFromProviderRecord({ id: "provider/model", requestProfile: "glm-thinking" }, { trusted: true }).requestProfile,
    "glm-thinking",
  );
});

test("trusted metadata still cannot mint an unknown router request profile", () => {
  assert.throws(
    () => modelMetadataFromProviderRecord(
      { id: "provider/model", requestProfile: "provider-invented" },
      { trusted: true },
    ),
    /supported router profile/,
  );
});

test("metadata precedence is user, verified, live, then conservative defaults", () => {
  const merged = mergeModelMetadata({
    providerId: "example",
    upstreamId: "example/model",
    live: { upstreamId: "example/model", displayName: "Live", supportsVision: true },
    verifiedPreset: { upstreamId: "example/model", displayName: "Verified", contextWindow: 262_144 },
    userOverride: { upstreamId: "example/model", displayName: "Chosen", supportsVision: false },
  });
  assert.equal(merged.displayName, "Chosen");
  assert.equal(merged.contextWindow, 262_144);
  assert.equal(merged.supportsVision, false);
  assert.equal(merged.supportsTools, CONSERVATIVE_MODEL_DEFAULTS.supportsTools);
});

test("provider reasoning aliases normalize into the ordered picker ladder", () => {
  const reasoningLevels = ["low", "medium", "high"].map((effort) => ({ effort, description: effort }));
  for (const field of ["thinking_levels", "supported_reasoning_efforts", "supported_reasoning_levels"]) {
    const metadata = modelMetadataFromProviderRecord({
      id: "vendor/reasoner",
      [field]: field === "supported_reasoning_levels" ? reasoningLevels : [" HIGH ", "low", "medium", "low"],
    });
    assert.deepEqual(metadata.reasoningLevels, reasoningLevels);
    assert.equal(metadata.supportsReasoning, true);
    assert.deepEqual(
      mergeDiscoveredModels({ live: [metadata] })[0].reasoningLevels,
      reasoningLevels,
      "canonical metadata must survive the discovery merge",
    );
  }
  assert.deepEqual(modelMetadataFromProviderRecord({
    id: "vendor/reasoner",
    thinking_levels: ["low", "medium", "high"],
    supported_reasoning_efforts: ["low", "high"],
    supported_reasoning_levels: [{ effort: "high", description: "Deep thought" }],
  }).reasoningLevels, [{ effort: "high", description: "Deep thought" }]);
});

test("reasoning metadata preserves user and preset precedence over live levels", () => {
  const preset = modelMetadataFromPreset({
    upstreamModel: "vendor/reasoner",
    reasoningLevels: [{ effort: "medium", description: "Verified medium" }],
  });
  const user = modelMetadataFromPreset({
    upstreamModel: "vendor/reasoner",
    reasoningLevels: [{ effort: "low", description: "My choice" }],
  });
  const [merged] = mergeDiscoveredModels({
    live: [{ id: "vendor/reasoner", thinking_levels: ["high"] }],
    verifiedPresets: [preset],
    userOverrides: [user],
  });
  assert.deepEqual(merged.reasoningLevels, user.reasoningLevels);
  assert.deepEqual(mergeDiscoveredModels({
    live: [{ id: "vendor/reasoner", thinking_levels: ["high"] }],
    verifiedPresets: [preset],
  })[0].reasoningLevels, preset.reasoningLevels);
});

test("missing and invalid reasoning levels never invent picker options", () => {
  assert.equal(modelMetadataFromProviderRecord({ id: "vendor/plain" }).reasoningLevels, undefined);
  const empty = modelMetadataFromProviderRecord({ id: "vendor/plain", supported_reasoning_levels: [] });
  assert.deepEqual(empty.reasoningLevels, []);
  assert.equal(empty.supportsReasoning, false);
  assert.deepEqual(modelMetadataFromProviderRecord({
    id: "vendor/reasoner", thinking_levels: ["none", "low", "medium", "high", "turbo"],
  }).reasoningLevels, ["low", "medium", "high"].map((effort) => ({ effort, description: effort })));
  for (const levels of ["high", [null], [{ effort: 1 }], ["turbo"], [{ effort: "low", description: "x".repeat(241) }]]) {
    assert.throws(
      () => normalizeModelMetadata({ upstreamId: "vendor/invalid", reasoningLevels: levels }),
      /reasoningLevels/,
    );
  }
});

test("invalid live metadata is rejected without weakening valid records", () => {
  assert.throws(
    () => modelMetadataFromProviderRecord({ id: "example/invalid", input_modalities: [] }),
    /input_modalities must be a non-empty array/,
  );
  const models = mergeDiscoveredModels({
    providerId: "example",
    live: [{ id: "example/valid", supports_tools: true }],
  });
  assert.equal(models[0].upstreamId, "example/valid");
});

test("discovery keeps model ids when one live capability record is malformed", async () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "codex-router-capability-discovery-"));
  const fixture = path.join(fixtureRoot, "models.json");
  const previousArgv = process.argv.slice();
  writeFileSync(fixture, JSON.stringify({
    data: [
      { id: "provider/valid", supports_tools: true, context_length: 65536 },
      { id: "provider/invalid", input_modalities: [] },
    ],
  }));
  process.argv.push("--fixture", fixture);
  try {
    const result = await discoverProviderModels("commandcode", { cache: false });
    assert.deepEqual(result.discovered, ["provider/invalid", "provider/valid"]);
    assert.deepEqual(
      result.modelMetadata.find((entry) => entry.upstreamId === "provider/valid"),
      {
        upstreamId: "provider/valid",
        displayName: "provider/valid",
        contextWindow: 65536,
        inputModalities: ["text"],
        outputModalities: ["text"],
        supportsTools: true,
        supportsReasoning: false,
        supportsVision: false,
        supportsSearch: false,
        userDefined: false,
      },
    );
    assert.equal(
      result.modelMetadata.some((entry) => entry.upstreamId === "provider/invalid"),
      false,
      "invalid optional metadata must not be promoted into the capability catalog",
    );
  } finally {
    process.argv.splice(0, process.argv.length, ...previousArgv);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("generic metadata uses the same smallest serving scope as built-in discovery", async () => {
  const { modelContextLengths } = await import("../src/model-discovery.mjs");
  const { PROVIDERS } = await import("../src/model-registry.mjs");
  const record = { id: "vendor/model", context_length: 1000000, top_provider: { context_length: 65536 } };
  assert.equal(modelMetadataFromProviderRecord(record).contextWindow, 65536);
  assert.equal(modelContextLengths({ data: [record] }, PROVIDERS.get("openrouter"))[record.id], 65536);
  assert.equal(modelMetadataFromProviderRecord({ ...record, top_provider: { context_length: 1000000 } }).contextWindow, 1000000);
  assert.equal(modelMetadataFromProviderRecord({ id: "vendor/model", context_window: "65536" }).contextWindow, 65536);
});
