# Model family prompts

Reviewed on 2026-11-17. The router publishes compact identity and behavioral
guidance for eight recognizable model families in Codex's catalog. These are
router-authored adaptations of public vendor material. They are not recovered
private instructions, complete vendor product prompts, or measured quality
improvements.

## Where the instructions come from

There are several distinct layers:

1. A vendor's chat application can supply its own product instructions.
   [Anthropic's published system prompts](https://platform.claude.com/docs/en/release-notes/system-prompts/overview)
   explicitly describe its chat products rather than the API.
   [xAI's prompt repository](https://github.com/xai-org/grok-prompts) also
   distinguishes product prompts from safety prefixes injected by its API.
2. An API caller supplies application instructions, as described in
   [Google's system instruction guide](https://ai.google.dev/gemini-api/docs/text-generation#system-instructions).
   Here, Codex supplies the coding harness, session permissions, tools, and
   task instructions.
3. The serving backend renders roles and tools using its model's chat template.
   [Qwen's function-calling guide](https://qwen.readthedocs.io/en/latest/framework/function_call.html)
   explains that translation. Tool delimiters and reasoning-history fields
   belong to that layer and the router's protocol adapters.

This change operates on the Codex catalog instruction layer. It retains the
selected native behavior template and existing overlays, rewrites the cloned
GPT identity, and appends a short family block to both `base_instructions` and
`model_messages.instructions_template`. The block explicitly stays within the
session's instructions, permissions, and response format.

## Family findings and adaptations

| Family | Primary evidence | Guidance applied here |
| --- | --- | --- |
| Claude | [Anthropic's prompting guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness) discusses excess abstractions and unrelated changes. [Sonnet 5.5 guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5#steer-initiative-and-scope) covers premature stopping and excessive scope. | Inspect relevant code, complete the requested work, and keep the solution small. No version-specific effort settings or blanket authorization. |
| Kimi | [Kimi-K2's usage guide](https://github.com/MoonshotAI/Kimi-K2#5-model-usage) publishes its minimal identity. [Moonshot's public CLI prompt](https://github.com/MoonshotAI/kimi-cli/blob/main/src/kimi_cli/agents/default/system.md) directs action through available tools and selection of the next action from their results. | Perform action requests through real tools and continue from observed results until completion or a concrete blocker. The CLI prompt is application guidance, not proof of Kimi web's private prompt. |
| Grok | [xAI's Grok Build prompt](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-agent/templates/prompt.md) distinguishes action requests from questions and reviews, requires scoped changes, and ties completion claims to tool evidence. | Act on authorized requests, preserve the intent of questions and reviews, and identify unverified claims. Its tool names, memory paths, noninteractive assumptions, and product persona are excluded. |
| Gemini | [Google's agentic workflow guidance](https://ai.google.dev/gemini-api/docs/prompting-strategies#agentic-workflows) covers prerequisite ordering, adapting to contradictory evidence, and persistence with recovery. | Check dependencies, revise assumptions after observations, bound transient retries, and diagnose other failures. The long example's mandatory exhaustive reasoning before every action is omitted. |
| Qwen | [Qwen's function-calling guide](https://qwen.readthedocs.io/en/latest/framework/function_call.html) separates structured calls from tool execution and warns against stopword-based ReAct templates for reasoning models. [Qwen2.5's template](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct/blob/main/tokenizer_config.json) provides the short identity reused here. | Use the supplied structured tool interface, exact tool schemas, and actual results. Do not simulate tool observations in prose. No Hermes/XML example, ReAct transcript, or thinking toggle is appended. |
| GLM | [Z.ai's coding-agent practices](https://docs.z.ai/devpack/resources/best-practice) emphasize goals, context, constraints, completion criteria, and planning for complex work. [Its thinking guide](https://docs.z.ai/guides/capabilities/thinking-mode) describes interpreting successive tool results and preserving reasoning blocks. | Track the task's criteria and revise next steps from evidence. Reasoning replay and `clear_thinking` are adapter concerns; no prompt claims to enable them. Identity is a router adaptation. |
| MiniMax | [MiniMax's agent-generalization article](https://platform.minimax.io/docs/guides/text-m2-agent-generalization) discusses adaptation across unfamiliar frameworks and tool errors. [Its M3 tool-use guide](https://platform.minimax.io/docs/guides/text-m3-function-call) specifies supplied tool descriptions and full assistant-history replay. | Adapt to the available environment and reassess after tool results or errors. No hardcoded framework tools, reasoning tags, or demand for visible thinking. Identity is a router adaptation without a fixed model version. |
| DeepSeek | [DeepSeek's current thinking guide](https://api-docs.deepseek.com/guides/thinking_mode/) describes alternating tool calls and results, separate answer content, and API-owned reasoning controls. [R1's recommendations](https://huggingface.co/deepseek-ai/DeepSeek-R1#usage-recommendations) advise avoiding a system prompt. | Use available tools and returned evidence, then give the result and its limitations. DeepSeek-R1 and DeepSeek-R1-Distill IDs receive no added family block. Their existing harness instructions remain. Identity and final-answer wording are router adaptations. |

These sources describe different products and model generations. Reusing a
small behavioral principle across a family is an engineering choice, not a
vendor guarantee that the same wording is optimal for every version. There is
no prompt-level change to reasoning effort, sampling, output budget, tool
availability, approvals, delegation policy, or response format.

In particular, this adaptation does not copy the Kimi CLI convention that
promotes tags in tool results to system directives. Retrieved text does not
gain instruction authority from this change.

## Matching and publication

Matching uses the upstream model ID, falling back to the final component of the
router slug when there is no upstream ID. Moonshot's dotted
`global.moonshotai.` namespace is recognized. Custom and reseller endpoints
therefore receive the same guidance for the same recognizable model.

An explicit opaque upstream ID is not inferred from a display name or endpoint
provider. Kimi Code's exact `k3` ID is recognized only on its built-in Kimi
providers. Unknown and other families keep the existing harness instructions.
Native catalog entries and other clients receive no new family block.
Applying an identical block twice does not duplicate it.

The identity rewrite recognizes numeric GPT generations and the known Codex,
Sol, Terra, Luna, and Astra suffixes in the template's identity phrase. Other
mentions of GPT models in the instructions are retained.

No prompt is downloaded during catalog publication or a model request.
These blocks are catalog metadata, not a runtime rewrite when failover changes
the upstream model. Source edits alone do not republish the installed catalog
or restart a service. Apply through the normal catalog refresh, then fully quit
and reopen Codex for a new session.

## Evidence limits

The regression cases cover family matching, the added behavioral text, both
instruction fields, preservation of existing overlays and personality
placeholders, duplicate prevention, R1 and unknown-ID exclusions, and newer
GPT identity templates. They do not measure model behavior or task success.
No comparative model evaluation or quota-consuming inference was performed
for this refinement.
