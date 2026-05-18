---
title: "Claude 3.5 Opus Code Generation Accuracy on SWE-bench Verified"
description: "When Anthropic shipped Claude 3.5 Sonnet in June 2024, the model’s performance on coding benchmarks reset expectations for what a mid-tier frontier model cou…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:37:52Z"
modDatetime: "2026-05-18T08:37:52Z"
readingTime: 9
tags: ["Model APIs"]
---

When Anthropic shipped Claude 3.5 Sonnet in June 2024, the model’s performance on coding benchmarks reset expectations for what a mid-tier frontier model could deliver. Sonnet posted 49.0% on SWE-bench Verified, a benchmark built from real GitHub issues with unit-test validation, hand-filtered to remove underspecified or broken tasks. That number eclipsed GPT-4o’s 33.2% and put pressure on every lab shipping a coding-focused model. Then, on October 22, 2024, Anthropic released Claude 3.5 Opus — a model that had been teased for months, delayed through multiple internal safety rounds, and finally launched alongside a new computer-use API. The coding number that landed: 53.3% on SWE-bench Verified, measured with a custom scaffolded harness. The raw pass@1 figure without scaffolding sits lower, but the scaffolded result matters because it reflects how developers actually use these models: inside agentic loops with file search, test execution, and multi-step patching. For teams deciding between gpt-4o-2024-08, claude-3.5-sonnet-2024-10, and the newly available claude-3.5-opus-2024-10, the benchmark delta is small enough to raise a practical question — does the Opus premium buy meaningful reliability in production code generation, or is Sonnet the better value per token?

## SWE-bench Verified as a Coding Signal

SWE-bench Verified is a curated subset of 500 tasks drawn from the original SWE-bench dataset, which itself pulls real-world GitHub issues from 12 popular Python repositories including Django, Flask, scikit-learn, and SymPy. Each task provides a repository snapshot, a natural-language issue description, and a test suite that must pass for the task to count as resolved. The Verified split, released in August 2024 by researchers at Princeton and Carnegie Mellon, removes tasks with ambiguous specifications, missing test coverage, or environment inconsistencies that made the original benchmark noisy. This curation matters because it shifts the benchmark from a research curiosity toward a reproducible engineering signal.

The evaluation protocol for Claude 3.5 Opus used a scaffolded harness. In this setup, the model does not simply emit a patch in a single turn. It receives the issue text, searches the codebase with a retrieval tool, proposes file edits, and iterates based on test output. Anthropic disclosed the scaffolded figure of 53.3% in their October 22, 2024 launch post, while noting that the raw unassisted pass@1 figure is lower. This distinction is critical for buyers: if your internal coding agent already wraps model calls with retrieval-augmented generation and test-loop feedback, the scaffolded number is the relevant one. If you call the raw API without tool-use scaffolding, expect lower accuracy.

### How Opus Compares to Sonnet and GPT-4o

The October 2024 SWE-bench Verified leaderboard provides a clear ordering. Claude 3.5 Opus (scaffolded) reaches 53.3%. Claude 3.5 Sonnet, updated to claude-3.5-sonnet-2024-10, scores 49.0% under the same scaffolded protocol. GPT-4o-2024-08, tested with comparable agent scaffolding by independent evaluators, lands at 33.2%. OpenAI’s o1-preview, which uses chain-of-thought reasoning at inference time, reaches approximately 41.3% with scaffolding, though direct comparisons are complicated by the model’s internal reasoning budget.

The 4.3-percentage-point gap between Opus and Sonnet represents roughly one additional correct patch per 23 tasks. For a team processing hundreds of issues per sprint, that delta compounds. But it comes at a cost. As of October 2024, Opus API pricing is US$15 per million input tokens and US$75 per million output tokens. Sonnet costs US$3 per million input and US$15 per million output. Opus is 5× more expensive on input and 5× more on output. The cost-per-correct-patch calculation depends heavily on token consumption per task, which varies by repository complexity. Early community benchmarks from the Latent Space SWE-bench harness suggest Opus tasks average 120,000 input tokens and 8,000 output tokens per run, yielding a per-task cost of roughly US$2.40 at list prices. Sonnet runs the same tasks for approximately US$0.48. The incremental cost to capture one additional correct patch is therefore substantial — on the order of US$44 per marginal success.

### What the Raw Numbers Obscure

Aggregate benchmark scores hide variance across repository types. SWE-bench Verified tasks span Django ORM issues, Flask routing bugs, matplotlib rendering edge cases, and SymPy symbolic math fixes. Early third-party analysis of the Opus scaffolded runs, published by independent benchmark maintainers on October 25, 2024, shows Opus outperforming Sonnet most clearly on tasks requiring multi-file refactors — patches that touch three or more source files and require understanding cross-module dependencies. On single-file bug fixes, the two models perform near parity. This suggests the Opus premium may be justified specifically for codebases with high coupling, where Sonnet’s context handling occasionally misses indirect dependencies.

## The Scaffolding Factor

The gap between raw and scaffolded performance is not academic. When a model is asked to fix a bug in a single prompt without tool access, it must hold the entire relevant codebase context in its context window and reason about file locations, function signatures, and test expectations from memory. Scaffolding offloads those tasks to deterministic tools: a file-search step retrieves relevant source, a test runner provides ground-truth pass/fail signals, and a planner agent decomposes the issue into sub-tasks. Anthropic’s harness for Opus includes all three components, and the 53.3% figure reflects end-to-end performance of the full system.

### Building Your Own Harness

For teams evaluating Opus for production, the key decision is whether to build a comparable scaffold or rely on the raw API. Anthropic open-sourced a reference SWE-bench harness on GitHub on October 22, 2024, providing a starting point for replication. The harness uses the model’s tool-use API to issue search queries, read files, and apply diffs. Running it requires a Dockerized environment matching the benchmark’s repository snapshots, plus a test-execution sandbox. The engineering investment is non-trivial — expect two to three weeks of integration work for a team familiar with containerized CI — but the accuracy lift is material. Community reports from teams replicating the harness on internal codebases suggest scaffolded setups improve pass rates by 15 to 25 percentage points over single-prompt baselines, depending on codebase size and test coverage quality.

### Cost Implications of Agentic Loops

Agentic loops multiply token consumption. Each search call, file read, and test execution round-trip adds input tokens. In the SWE-bench harness, Opus tasks averaged 4.2 tool-call rounds per issue, with each round consuming input tokens for the full conversation history plus retrieved context. The 120,000 input-token average cited earlier reflects this accumulation. Teams budgeting for Opus should model token consumption at 3× to 5× their single-prompt estimates if they plan to implement full scaffolding. At US$15/M input tokens, a 100-task-per-day pipeline would burn approximately US$180 daily on input alone, before output token costs. Sonnet at US$3/M input drops that to US$36 daily. Over a 250-working-day year, the difference is US$36,000 versus US$7,200 — enough to fund a mid-level engineer for a quarter in most markets.

## Latency and Throughput Trade-offs

Benchmark accuracy is one axis; wall-clock performance is another. Opus generates tokens at roughly half the speed of Sonnet under comparable load, based on Anthropic’s published throughput tiers. As of October 2024, Opus users on Tier 4 API access report sustained output of approximately 40 tokens per second for a single stream. Sonnet on the same tier delivers 80 tokens per second. For the SWE-bench harness, where each task involves multiple sequential tool calls, this latency compounds. A single Opus task run averages 90 to 120 seconds end-to-end. Sonnet completes the same task in 45 to 60 seconds.

### Batching and Concurrency Limits

Anthropic’s rate limits for Opus are more restrictive than for Sonnet at launch. Tier 4 accounts are capped at 2,000 requests per minute for Sonnet and 1,000 requests per minute for Opus. For high-volume CI pipelines that trigger model calls on every pull request, this difference shapes queue depth and P99 latency. Teams running continuous agentic coding workflows should benchmark their specific concurrency profiles rather than relying on single-stream latency numbers. A 50-developer team generating 20 PRs per day, each triggering three model-call rounds, produces 3,000 requests daily — well within limits for both models but with noticeably different tail latencies under load.

### When Latency Dictates Model Choice

For interactive use cases — IDE copilots, chat-based coding assistants, real-time code review — Sonnet’s lower latency and higher throughput make it the pragmatic default. The 4.3-point accuracy gap on SWE-bench Verified is unlikely to be perceptible to a developer waiting for a single completion. For batch pipelines that run overnight — automated bug fixing across a monorepo, dependency upgrade PRs, test-generation sweeps — Opus’s accuracy edge can be captured without the latency penalty mattering. Several teams in the Latent Space community have adopted a hybrid pattern: Sonnet for interactive completions, Opus for batched agentic tasks where correctness dominates cost and speed concerns.

## Pricing Architecture and Lock-in Risks

Claude 3.5 Opus launched at US$15/US$75 per million input/output tokens, matching the pricing of the original Claude 3 Opus from March 2024. This positions it above GPT-4o (US$2.50/US$10) and Sonnet (US$3/US$15), and below o1-preview (US$15/US$60) on input but higher on output. The pricing table as of October 28, 2024:

| Model | Input (US$/1M tokens) | Output (US$/1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Opus | 15.00 | 75.00 |
| Claude 3.5 Sonnet | 3.00 | 15.00 |
| GPT-4o | 2.50 | 10.00 |
| o1-preview | 15.00 | 60.00 |

### Prompt Caching Economics

Anthropic’s prompt caching feature, available for both Opus and Sonnet, changes the cost calculus for SWE-bench-style workloads. Cached input tokens cost 10% of the base input price — US$1.50/M for Opus, US$0.30/M for Sonnet. In a scaffolded harness, the repository snapshot and issue description are identical across multiple runs for the same task, making them cacheable. Early adopters report cache hit rates of 60% to 80% on SWE-bench workloads, reducing effective input costs by roughly half. Even with caching, Opus remains 5× more expensive than Sonnet on a per-task basis.

### Model Deprecation Windows

Anthropic’s model deprecation policy, updated in October 2024, commits to 12 months of API availability after a successor model launches. Claude 3.5 Sonnet and Opus are both current-generation models with no announced deprecation date. Teams building tooling around a specific model version should pin to the dated identifier (claude-3.5-opus-2024-10) rather than the rolling alias, as behavior can shift subtly across point releases. OpenAI’s equivalent policy provides 90 days of notice for deprecations, a tighter window that has caused production incidents for teams relying on specific GPT-4 versions.

## What to Do Now

The SWE-bench Verified numbers for Claude 3.5 Opus are strong but not transformative relative to Sonnet. The decision tree for teams shipping code-generation pipelines in Q4 2024 comes down to three factors: accuracy sensitivity, latency tolerance, and budget.

First, if your codebase has high cross-module coupling and your current Sonnet-based pipeline produces patches that fail because of missed indirect dependencies, the Opus upgrade is worth testing on a representative sample of historical issues. Run a side-by-side evaluation on 50 closed issues with known fixes. If Opus resolves at least three more than Sonnet, the accuracy delta is real for your domain.

Second, do not deploy Opus without a scaffolded harness. The raw single-prompt performance gap is too narrow to justify the cost multiplier. Invest the engineering time to build tool-use loops with file search, test execution, and diff application. The open-source SWE-bench harness from Anthropic provides a reference architecture. Budget two to three weeks for integration and another week for tuning prompt templates to your codebase conventions.

Third, adopt a tiered routing strategy. Route interactive, latency-sensitive requests to Sonnet. Route batched, correctness-critical tasks to Opus. Monitor per-task cost and accuracy metrics separately for each tier, and set a monthly review cadence to reassess whether the Opus premium continues to pay for itself as both models receive point updates.

Fourth, pin your model versions. Use claude-3.5-opus-2024-10 and claude-3.5-sonnet-2024-10 in production configurations. Avoid the claude-3.5-opus and claude-3.5-sonnet aliases, which will silently point to future releases with potentially different performance characteristics. Build model-version regression tests into your CI pipeline — a minimal suite of 10 to 20 representative coding tasks that run on every model update to catch behavioral regressions before they reach production.

Finally, factor caching into your cost model from day one. The 10% cached-input price reduces the effective cost of repeated SWE-bench-style runs by roughly half. Design your harness to maximize cache hits by structuring prompts with stable prefixes — repository context, coding conventions, and system instructions should precede the variable issue description.
