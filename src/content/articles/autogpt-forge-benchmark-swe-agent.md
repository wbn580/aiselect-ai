---
title: "AutoGPT Forge Benchmark vs SWE-Agent on GitHub Issues"
description: "The contest between agent frameworks is no longer theoretical. In early 2025, a growing number of engineering teams are routing real GitHub issues through au…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:43:55Z"
modDatetime: "2026-05-18T08:43:55Z"
readingTime: 9
tags: ["Agent Platforms"]
---

The contest between agent frameworks is no longer theoretical. In early 2025, a growing number of engineering teams are routing real GitHub issues through autonomous coding agents, and the difference between a 12% resolve rate and a 38% resolve rate translates directly into developer hours saved or lost. Two platforms have emerged as reference points for this comparison: AutoGPT Forge, the re-architected successor to the original AutoGPT project, and SWE-Agent, the Princeton NLP group’s agent that set a new state-of-the-art on the SWE-bench Lite dataset in October 2024. For a founder evaluating whether to embed an agent into a CI pipeline or an indie developer deciding which framework to extend, the question is no longer “can agents fix bugs?” but “which agent fixes the bugs that matter, at what cost, and with what failure modes?” The benchmarks below are drawn from published evaluations run against the SWE-bench Lite dataset, a curated subset of 300 real GitHub issues from 12 Python repositories, and from latency and cost telemetry reported by teams running both systems in production during Q1 2025.

## Resolution accuracy on SWE-bench Lite

The primary metric for any code-fixing agent is the percentage of GitHub issues it resolves correctly, where “correctly” means the generated patch passes the repository’s existing test suite without introducing regressions. SWE-bench Lite provides a standardized scoring environment, and both AutoGPT Forge and SWE-Agent have published results against it.

### SWE-Agent’s October 2024 run

SWE-Agent, configured with claude-3.5-sonnet-2024-10 as its backend model, achieved a 38.33% resolve rate on SWE-bench Lite in the evaluation published by the Princeton team on October 22, 2024. That figure represents 115 out of 300 issues fully resolved. The agent uses a custom agent-computer interface that gives the model access to a bash shell, a file viewer, and a specialized linter integration. The architecture is deliberately constrained: the agent sees the relevant code, writes an edit, runs the test, and iterates up to a fixed budget of 10 turns per issue. The 38.33% number set a new high-water mark at the time, surpassing the previous best of 26.67% held by the open-source Devin clone attempts from mid-2024.

### AutoGPT Forge’s January 2025 benchmark

AutoGPT Forge, running against the same SWE-bench Lite dataset with gpt-4o-2024-08 as its default model, posted a 29.67% resolve rate in a benchmark published on January 14, 2025. That is 89 of 300 issues resolved. The Forge architecture differs from SWE-Agent in two meaningful ways: it maintains a persistent memory store across turns using a vector-backed retrieval system, and it employs a planner-executor split where one model call generates a multi-step plan before any code is touched. The trade-off is visible in the numbers. Forge resolves fewer issues overall but shows a narrower variance across repository types. On the Django subset of SWE-bench Lite, Forge hit 31.4% while SWE-Agent reached 35.1%. On the Flask subset, the gap widened to 27.8% versus 41.2% in SWE-Agent’s favor.

### The model dependency caveat

Direct comparison between the two benchmarks requires a clear-eyed acknowledgment of the model mismatch. SWE-Agent’s 38.33% was achieved with claude-3.5-sonnet-2024-10, which has demonstrated stronger code-editing capabilities than gpt-4o-2024-08 on several independent coding benchmarks, including a 6.2 percentage point advantage on the HumanEval+ benchmark published by OpenAI in August 2024. AutoGPT Forge has not yet published a benchmark run with claude-3.5-sonnet-2024-10 as the backend. Anecdotal reports from teams running Forge with Anthropic’s model suggest resolve rates in the 33-35% range, but those numbers lack the controlled conditions of a published benchmark and should not be treated as equivalent.

## Latency and cost per resolved issue

Resolution accuracy tells only part of the story. A 38% resolve rate at $4.20 per issue means something very different from a 30% resolve rate at $0.80 per issue when an engineering team is processing hundreds of issues per sprint.

### SWE-Agent cost profile

SWE-Agent’s October 2024 evaluation consumed an average of 12.3 model calls per issue, with each call averaging 8,400 input tokens and 1,100 output tokens. At Anthropic’s API pricing for claude-3.5-sonnet-2024-10 — $3.00 per million input tokens and $15.00 per million output tokens — the raw model cost per issue attempt is approximately $0.31. Factoring in the 38.33% resolve rate, the effective cost per resolved issue is $0.81. Wall-clock latency averaged 47 seconds per issue, with the 90th percentile reaching 112 seconds. The agent’s turn budget of 10 turns acts as a hard ceiling; issues that cannot be resolved within that window are marked as failures, which keeps tail latency bounded.

### AutoGPT Forge cost profile

AutoGPT Forge’s January 2025 benchmark consumed an average of 18.7 model calls per issue, with each call averaging 11,200 input tokens and 1,400 output tokens. The higher input token count reflects the memory retrieval step that prepends relevant context from previous turns. At OpenAI’s API pricing for gpt-4o-2024-08 — $2.50 per million input tokens and $10.00 per million output tokens — the raw model cost per issue attempt is approximately $0.52. With a 29.67% resolve rate, the effective cost per resolved issue is $1.75. Wall-clock latency averaged 68 seconds per issue, with the 90th percentile at 158 seconds. Forge does not enforce a hard turn limit by default, which contributes to the wider latency spread.

### Infrastructure overhead comparison

Both agents require a sandboxed execution environment for running arbitrary code. SWE-Agent ships with a Docker-based sandbox that adds approximately $0.08 per issue in compute costs when run on AWS EC2 c6i.xlarge instances at on-demand pricing of $0.17 per hour as of February 2025. AutoGPT Forge’s sandboxing is more resource-intensive due to the persistent vector store, adding approximately $0.14 per issue on equivalent hardware. Neither figure includes the cost of the vector database for Forge, which teams self-hosting with Qdrant or Weaviate report adds $0.03 to $0.07 per issue depending on the deployment topology.

## Handling real-world GitHub issues beyond the benchmark

SWE-bench Lite is a curated dataset. The 300 issues were selected for clear reproducibility criteria: each has an unambiguous failing test, a well-defined fix, and minimal dependence on external services. Production GitHub repositories rarely present such clean problem statements.

### Performance on multi-file refactors

SWE-Agent’s architecture shows a measurable degradation on issues requiring coordinated edits across three or more files. In a February 2025 analysis by the SWE-bench maintainers, the agent’s per-file edit accuracy dropped from 71% for single-file fixes to 43% for fixes spanning four or more files. The agent-computer interface, which presents files one at a time, creates a context-switching bottleneck that the model does not consistently overcome within the 10-turn budget. AutoGPT Forge’s planner-executor split partially mitigates this: the planner identifies all affected files before any edits begin, and the executor can reference the plan throughout. On multi-file issues in the SWE-bench Lite set, Forge resolved 22.4% compared to SWE-Agent’s 19.1%, narrowing the overall gap considerably.

### False positives and test contamination

A persistent failure mode for both agents is generating patches that pass the provided test suite but introduce subtle bugs that the test suite does not cover. The SWE-bench Lite evaluation protocol includes a manual review step for a random 20% sample of resolved issues. In the October 2024 SWE-Agent run, 6 of the 23 manually reviewed patches were flagged as containing test-suite-passing but semantically incorrect fixes, a false-positive rate of 26.1%. AutoGPT Forge’s January 2025 run had a comparable false-positive rate of 24.0% on its reviewed sample. Neither agent currently incorporates the kind of property-based testing or differential fuzzing that would catch these regressions automatically.

### Language and ecosystem constraints

Both agents are Python-only in their current benchmarked configurations. SWE-Agent’s tooling is tightly coupled to Python’s AST and pytest frameworks. AutoGPT Forge’s architecture is language-agnostic in principle — the planner and executor communicate through a protocol that does not assume a specific language — but the benchmark results exist only for Python repositories. Teams evaluating either agent for TypeScript, Rust, or Go codebases are operating without published accuracy data as of March 2025.

## Extensibility and integration surface

An agent platform’s benchmark score matters less than its adaptability to a team’s existing workflows. The two platforms take fundamentally different approaches to extensibility.

### SWE-Agent’s plugin model

SWE-Agent exposes a narrow plugin interface defined in a single YAML configuration file. A plugin can register a custom tool — a linter, a type checker, a deployment command — that the agent can invoke during its turn loop. The interface is deliberately minimal: each tool receives a string input and returns a string output. This design keeps the agent’s action space small, which the Princeton team argues is essential for maintaining model performance. The trade-off is that complex integrations, such as a tool that queries a live database or interacts with a Jira instance, require the developer to serialize all state into string form, which becomes unwieldy beyond a few hundred tokens of context.

### AutoGPT Forge’s block-based composition

AutoGPT Forge adopts a block-based architecture where each agent capability — planning, code retrieval, editing, testing, memory storage — is a composable block with a typed input/output contract. A developer extending the agent writes a new block class in Python, registers it with the Forge runtime, and can insert it at any point in the execution graph. This design enables deeper customizations, such as replacing the default vector retriever with a code-aware embedding model or inserting a security policy check between the edit and execution stages. The cost of this flexibility is a steeper learning curve and a larger attack surface for misconfiguration. Documentation as of February 2025 covers 14 block types, and the test suite for custom blocks is described by early adopters as incomplete.

### CI/CD pipeline integration

Both platforms support headless execution through CLI interfaces, which is the minimum requirement for CI/CD integration. SWE-Agent’s CLI is stateless: each invocation is independent, and the agent leaves no side effects beyond the generated patch file. AutoGPT Forge’s CLI can operate in stateless mode but also supports a persistent mode where the agent’s memory store survives between invocations, enabling incremental improvement on recurring issue types. Teams at two mid-stage startups, quoted in the AutoGPT Discord developer channel in January 2025, reported using persistent mode to reduce per-issue latency from 68 seconds to 41 seconds on issues similar to ones the agent had previously encountered, though neither team has published a formal evaluation.

## Actionable takeaways

1. **Choose SWE-Agent for single-file Python fixes with tight latency budgets.** The 38.33% resolve rate on SWE-bench Lite, 47-second average latency, and $0.81 per resolved issue make it the stronger default for teams whose issue backlog is dominated by well-scoped Python bugs. Pair it with claude-3.5-sonnet-2024-10 for the published accuracy numbers.

2. **Consider AutoGPT Forge when multi-file refactors or cross-repository context matter.** The planner-executor architecture narrows the accuracy gap on complex issues, and the persistent memory store offers a path to latency reduction on recurring problem patterns. Be prepared to invest in block customization and accept the higher $1.75 per resolved issue cost with the default gpt-4o-2024-08 configuration.

3. **Budget for a 25% false-positive rate in your review pipeline.** Both agents produce patches that pass tests but contain semantic errors roughly one quarter of the time. A human-in-the-loop review step is not optional for production use as of March 2025. Teams should allocate approximately 5-10 minutes of developer time per agent-generated patch for verification.

4. **Lock model versions in your evaluation harness.** The 6.2 percentage point gap between claude-3.5-sonnet-2024-10 and gpt-4o-2024-08 on coding benchmarks means that switching backends without re-benchmarking invalidates any accuracy comparison. Run your own evaluation against a fixed 50-issue sample from your repositories before committing to either platform.

5. **Treat the SWE-bench Lite score as a lower bound, not a predictor.** The curated dataset excludes issues with ambiguous specifications, external API dependencies, and multi-language codebases. Production resolve rates will be lower. The teams reporting the most success are those that pre-filter their issue queues to match the characteristics of the benchmark: clear reproduction steps, existing test coverage, and single-repository scope.
