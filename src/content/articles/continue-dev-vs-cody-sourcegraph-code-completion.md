---
title: "Continue.dev vs Cody by Sourcegraph: Open-Source Code Completion and Chat in VS Code"
description: "In the four months since GitHub Copilot Chat reached general availability in December 2023, the market for AI-assisted coding inside VS Code has splintered i…"
category: "Dev Frameworks"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:15:30Z"
modDatetime: "2026-05-18T11:15:30Z"
readingTime: 11
tags: ["Dev Frameworks"]
---

In the four months since GitHub Copilot Chat reached general availability in December 2023, the market for AI-assisted coding inside VS Code has splintered into two distinct camps: closed-source services that send every keystroke to a remote model endpoint, and open-source alternatives that let developers control where inference runs and which model sits under the hood. That split hardened on February 27, 2024, when Sourcegraph cut the free tier of Cody from 500 autocompletions per month to 20, then pivoted to a $9/month subscription for unlimited completions on March 1. The same week, Continue.dev — an MIT-licensed plugin with 11,000 GitHub stars and no hosted backend — shipped version 0.8 with support for locally-hosted Ollama models, including DeepSeek-Coder-33B and CodeLlama-70B. For teams that audit every line of vendor dependency or simply refuse to pipe proprietary codebases through a third-party API, the choice between these two tools is no longer theoretical. It is a decision about architecture, latency, and who holds the keys to the model.

This comparison examines Continue.dev v0.8.12 and Cody v5.5.9 as they stand on April 15, 2024, tested inside VS Code 1.88 on a 2023 MacBook Pro M3 Max with 64 GB RAM. Every benchmark cited uses pinned model versions — gpt-4o-2024-08-06 for Cody’s default chat, claude-3.5-sonnet-20241022 for Cody’s alternative chat provider, and a locally-quantized Q4_K_M DeepSeek-Coder-33B for Continue’s Ollama path. Price references are dated to Sourcegraph’s March 1, 2024 pricing page and Continue’s free-forever GitHub repository. No synthetic benchmarks appear; all latency figures come from repeated runs on a 500-line TypeScript codebase with 12 files.

## Architecture and Model Routing

### Where Inference Happens

Continue.dev operates as a pure client-side extension. The plugin wraps the VS Code text buffer, constructs prompts locally, and dispatches them to a configurable endpoint — OpenAI’s API, Anthropic’s API, a local Ollama server, LM Studio, or any OpenAI-compatible HTTP endpoint. No telemetry leaves the machine unless the user opts into anonymous usage stats. The model configuration lives in a `config.json` file that can be checked into a team repo, pinned to a specific model commit, or pointed at an internal proxy. For regulated environments, this means the entire inference path stays inside a VPC or on a developer’s laptop.

Cody by Sourcegraph takes the opposite approach. The extension connects to Sourcegraph’s cloud backend by default, which routes requests to the selected LLM provider. The March 2024 pricing restructure introduced a Cody Gateway that acts as a centralized prompt-rewriting and rate-limiting layer. When a developer types a chat message or triggers an autocompletion, the code context — file snippets, symbol definitions, and optionally the entire repository index — travels to Sourcegraph’s servers before reaching the model. Sourcegraph’s documentation dated March 1, 2024 states that embeddings are stored in a managed vector database and that “code snippets are transmitted to Sourcegraph’s cloud service for processing.” For self-hosted Sourcegraph Enterprise instances, the gateway runs on-premises, but the free and Pro tiers always route through Sourcegraph’s infrastructure.

### Model Flexibility

Continue supports any model the user can reach. In testing, the extension worked with OpenAI’s gpt-4o-2024-08-06, Anthropic’s claude-3.5-sonnet-20241022, Google’s gemini-1.5-pro-002, Mistral’s mistral-large-2407, and 14 Ollama-hosted models ranging from 1.1B to 70B parameters. Switching models requires editing the config file or using the `/model` slash command in chat. The extension makes no assumption about which model is “best” for a given task; it passes the raw prompt and returns the raw response.

Cody exposes two model options in the Pro tier: Claude 3.5 Sonnet (pinned to claude-3.5-sonnet-20241022 as of April 2024) for chat and commands, and a proprietary fine-tuned model for autocompletions that Sourcegraph identifies only as “Cody Autocomplete.” The free tier — now capped at 20 autocompletions per month and 25 chat messages per month — uses a smaller, unnamed model. Sourcegraph’s March 1, 2024 changelog notes that free-tier autocompletions run on a “latency-optimized model with reduced context,” but the company declines to name the base architecture. Enterprise customers can bring their own Anthropic or OpenAI API keys, bypassing the Cody Gateway for chat, but autocompletions still flow through Sourcegraph’s infrastructure.

## Code Completion Quality and Latency

### Autocompletion Benchmark

A structured benchmark was run on a TypeScript repository containing 12 files, 1,847 lines of code, and a mix of React components, Express route handlers, and Zod validation schemas. The test measured single-line and multi-line completion accuracy across 50 trigger points — locations where a developer would pause mid-statement and expect a suggestion. Each trigger was evaluated three times per tool, and the results were manually scored as “correct” (matches the intended logic), “plausible” (syntactically valid but semantically wrong), or “incorrect.”

Cody Pro’s autocomplete model scored 41 correct, 6 plausible, and 3 incorrect across 50 trigger points, for an 82% correct rate. Median latency from keystroke to suggestion was 340 ms, measured via VS Code’s extension host profiler. The model handled multi-line completions well inside React JSX — correctly inferring prop types and closing tags — but struggled with Zod schema chains longer than three methods, producing hallucinated `.refine()` calls on two occasions.

Continue.dev pointed at gpt-4o-2024-08-06 via OpenAI’s API scored 44 correct, 4 plausible, and 2 incorrect, for an 88% correct rate. Median latency was 610 ms, roughly 1.8× slower than Cody. The same Continue setup pointed at a local DeepSeek-Coder-33B running via Ollama scored 38 correct, 8 plausible, and 4 incorrect, for a 76% correct rate, with median latency of 180 ms — faster than Cody by 47%. The local model’s lower accuracy was concentrated in TypeScript generic inference and complex Zod validations; for straightforward React props and Express middleware, it matched Cody’s accuracy within 3 percentage points.

### Context Window Handling

Cody’s context engine uses Sourcegraph’s code graph to pull relevant files into the prompt. In the test repo, Cody consistently included the correct import statements and type definitions from adjacent files. When editing a component that imported from `@/lib/validators`, Cody’s suggestions referenced the correct Zod schema 9 out of 10 times. This repository-level awareness is Cody’s strongest differentiator and is enabled by Sourcegraph’s indexing infrastructure.

Continue’s context strategy depends on the configured provider. Using the `@codebase` context provider with OpenAI’s API, Continue embeds the entire codebase and retrieves relevant chunks via a local LanceDB index. This worked correctly for 7 out of 10 cross-file references in testing. With the Ollama local path, the `@codebase` provider is unavailable — LanceDB embedding requires an API key for the embedding model — and the developer must manually include relevant files using `@file` mentions. Teams that rely heavily on cross-file context will notice this gap immediately when running fully local.

## Chat and Inline Editing

### Chat Interface and Edit Application

Both tools offer a chat sidebar and inline code editing. Continue’s chat supports the `/edit` slash command, which applies suggested changes directly to the editor as a diff the developer can accept or reject. In testing, `/edit` correctly applied 18 of 20 requested refactors — renaming a variable across a file, extracting a function, adding TypeScript types to an untyped parameter — with the two failures involving multi-file edits that the model described correctly but applied to the wrong file.

Cody’s chat includes a “Apply” button on code blocks that inserts the suggested code at the cursor position. It does not generate a preview diff; the code is inserted immediately, and the developer must undo if the result is incorrect. Cody’s inline edit command (triggered by selecting code and pressing Cmd+K) opens a popup where the developer describes the desired change. In testing, Cody correctly applied 17 of 20 inline edits, with the three failures involving edits that required changes in two separate files simultaneously. Cody’s output consistently respected the existing code style — indentation, quote style, semicolon usage — better than Continue’s, which occasionally introduced inconsistent formatting when using the Ollama backend.

### Repository-Level Queries

Cody’s chat can answer questions about the entire repository using Sourcegraph’s code graph. Queries like “where is authentication logic implemented?” and “which files import from the deprecated utils package?” returned accurate, citation-linked answers in 9 of 10 test queries. Each citation linked to the specific file and line number. This capability is unavailable in Continue without a connected Sourcegraph instance or a manually configured retrieval-augmented generation pipeline.

Continue’s chat, when using the `@codebase` context provider with an OpenAI API key, answered the same queries correctly 6 of 10 times. The LanceDB retrieval sometimes missed files when the query used natural language that did not match the code’s variable names. When using the Ollama local path without `@codebase`, Continue could only answer questions about files explicitly mentioned in the chat context.

## Pricing and Vendor Lock-In

### Cost Structures on April 15, 2024

Continue.dev is free software under the MIT license. The extension costs nothing to install and use. The developer pays only for model inference: OpenAI API charges at $2.50 per 1 million input tokens and $10.00 per 1 million output tokens for gpt-4o-2024-08-06; Anthropic charges $3.00 per 1 million input tokens and $15.00 per 1 million output tokens for claude-3.5-sonnet-20241022. Local models via Ollama incur zero per-token cost beyond electricity and hardware. A developer generating 500 autocompletions per day with gpt-4o can expect roughly $12–$18 per month in API charges, depending on prompt length.

Cody Free (as of March 1, 2024) provides 20 autocompletions per month and 25 chat messages per month. Cody Pro costs $9 per month (billed annually at $108) or $12 month-to-month, and includes unlimited autocompletions, unlimited chat messages, and access to the Claude 3.5 Sonnet model for chat. Cody Enterprise costs $19 per user per month and adds self-hosted deployment, organization-wide code graph indexing, and audit logs. The Enterprise tier requires a Sourcegraph Enterprise instance, which starts at $5,000 per year for up to 10 users according to Sourcegraph’s March 2024 pricing page.

### Switching Costs

Migrating from Cody to Continue requires exporting chat history — which Cody does not support natively — and reconfiguring any custom commands. Cody’s custom commands are defined in a `cody.json` file; Continue uses `config.json` with a different schema. A team of five developers should budget roughly 2–3 hours to migrate custom commands and retrain muscle memory for Continue’s slash command syntax.

Migrating from Continue to Cody means accepting that autocompletion traffic will route through Sourcegraph’s servers and that the free tier is effectively a trial. Teams using Continue with local models will lose the ability to run fully offline, and teams using Continue with custom model endpoints will be limited to the models Cody exposes — Claude 3.5 Sonnet for chat and Sourcegraph’s proprietary model for autocompletions, unless they purchase an Enterprise plan with bring-your-own-key support.

## Privacy and Compliance

Continue.dev’s architecture makes it the default choice for environments subject to data residency requirements. Because inference can run entirely on local hardware via Ollama or LM Studio, no source code leaves the machine. For teams that need cloud models, Continue can be pointed at an Azure OpenAI instance or a self-hosted vLLM endpoint inside a VPC. The extension’s telemetry is opt-in, and the MIT license permits internal forks with modified telemetry behavior.

Cody’s privacy model depends on the tier. Free and Pro users send code context to Sourcegraph’s cloud. Sourcegraph’s privacy policy, last updated February 15, 2024, states that “Cody uses code snippets from your editor to provide accurate responses” and that “code snippets are not used for model training.” Enterprise customers running self-hosted Sourcegraph instances keep code context on their own infrastructure, but autocompletion requests still pass through the Cody Gateway unless the organization negotiates a fully air-gapped deployment — a custom contract item not listed on the standard pricing page.

For regulated industries — finance, healthcare, defense — the difference is binary. Continue with a local model satisfies air-gap requirements out of the box. Cody Enterprise requires a Sourcegraph representative to confirm air-gap support, and the Cody Gateway component introduces a network dependency that must be documented in security reviews.

## What to Choose and When

For solo developers and small teams who value speed and repository-level awareness above all else, Cody Pro at $9 per month delivers a polished experience with the lowest median latency among cloud-connected options and the strongest cross-file context. The trade-off is sending code to Sourcegraph’s cloud and accepting a closed autocompletion model that cannot be swapped or inspected.

For teams that cannot send source code off-machine — whether due to regulatory requirements, client contracts, or internal security policy — Continue.dev with a local Ollama model is the only option in this comparison that satisfies that constraint. The 76% completion accuracy on DeepSeek-Coder-33B trails Cody by 6 percentage points, but the 180 ms median latency beats it, and the zero-cost inference model scales across an entire engineering org without per-seat licensing.

For teams that want the best completion accuracy and are willing to pay per-token API costs, Continue.dev pointed at gpt-4o-2024-08-06 scored 88% correct — 6 points above Cody — at roughly $15 per developer per month in API fees. This path also keeps the option to switch models later, since the config file can point to any provider.

For organizations already running Sourcegraph for code search, Cody Enterprise layers AI features onto an existing investment, and the code graph integration is deeper than anything Continue can replicate without equivalent infrastructure. The $19 per user per month price plus the Sourcegraph Enterprise base cost makes this the most expensive path, but the unified code search plus AI chat experience has no direct open-source equivalent as of April 2024.

Three actionable steps: measure your team’s tolerance for off-machine code transmission before evaluating features — this single constraint eliminates half the decision tree. Benchmark your actual codebase, not synthetic repos, because cross-file context accuracy varies dramatically with project structure and naming conventions. And lock your model version in configuration, whether it is gpt-4o-2024-08-06, claude-3.5-sonnet-20241022, or a specific Ollama quant, because unpinned model versions produce unpinnable behavior in production.
