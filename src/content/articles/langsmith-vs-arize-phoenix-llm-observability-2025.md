---
title: "LangSmith vs Arize Phoenix: LLM Observability and Tracing for Production Agents"
description: "As of late 2024 and into early 2025, the conversation around AI agents has shifted from speculative architecture diagrams to the messy reality of production…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:29:42Z"
modDatetime: "2026-05-18T08:29:42Z"
readingTime: 10
tags: ["Agent Platforms"]
---

As of late 2024 and into early 2025, the conversation around AI agents has shifted from speculative architecture diagrams to the messy reality of production debugging. Teams that deployed LangChain or LlamaIndex agents in 2023 and early 2024 are now staring down the barrel of multi-step reasoning chains that fail silently on step four, hallucinated tool calls that cost real money, and latency regressions that only appear under specific prompt concurrency. The core of the problem is not capability, but visibility. A traditional APM stack — Datadog, Grafana, Sentry — can tell you a function errored. It cannot tell you that the agent selected the wrong retrieval tool because the embedding model returned contextually adjacent but factually incorrect chunks. LLM observability, specifically tracing and evaluation at the span level, has become the hard requirement for any team running agents in production. Two platforms have emerged as the de facto choices for teams that need more than a log line: LangSmith, built by LangChain and launched in general availability in July 2023, and Arize Phoenix, an open-source project from Arize AI that saw its 1.0 release in September 2024. The decision between them is not about features on a landing page — it is about architectural philosophy, the cost of instrumentation, and what happens when an agent call tree hits 50 spans and you need to find the one that hallucinated.

## Tracing Architecture and Instrumentation

The first axis of comparison is how traces are generated and what the instrumentation overhead looks like in a real codebase. Both platforms operate on the OpenTelemetry conceptual model of spans and traces, but their ingestion paths and default instrumentation differ materially.

### LangSmith’s SDK-First Approach

LangSmith tracing is tightly coupled to the LangChain ecosystem. As of January 2025, the primary instrumentation path is the `langsmith` Python SDK (v0.1.77) or TypeScript SDK, which wraps LangChain’s run tree. When a developer uses `langchain.chains` or the `langgraph` library, trace collection is effectively automatic — the SDK hooks into the LangChain callback system and emits spans for every LLM call, tool invocation, retriever fetch, and parser output. For non-LangChain code, manual instrumentation is possible via the `@traceable` decorator or the `RunTree` API, but the documentation as of December 2024 acknowledges this path as secondary.

The practical implication is that a team already committed to LangGraph for agent orchestration gets traces with near-zero setup. A team using a custom Python agent loop with raw OpenAI SDK calls will need to wrap every significant function, which adds 15-30 lines of instrumentation code per traced operation. The trace schema is opinionated: LangSmith expects a `run_type` enum (`llm`, `chain`, `tool`, `retriever`, `embedding`) and structures metadata accordingly. This creates consistency across the LangChain ecosystem but can feel rigid when modeling custom agent topologies that do not map cleanly to these categories.

### Arize Phoenix’s OTLP-Native Ingestion

Arize Phoenix takes the opposite approach. As of its 1.0 release in September 2024, Phoenix ingests traces via the OpenTelemetry Protocol (OTLP) over gRPC or HTTP. The project ships with a set of instrumentors — `openinference-instrumentation-openai`, `openinference-instrumentation-llama-index`, `openinference-instrumentation-langchain` — that auto-instrument common frameworks by patching their internals. Critically, these instrumentors emit spans conforming to the OpenInference specification, a vendor-neutral semantic convention for LLM traces that Arize open-sourced in early 2024. A span from an OpenAI chat completion call will have attributes like `llm.input_messages`, `llm.output_messages`, `llm.model_name`, and `llm.token_count.prompt` regardless of whether the calling code uses LangChain, LlamaIndex, or raw HTTP requests.

This OTLP-native design means Phoenix can ingest traces from any language or framework that speaks OpenTelemetry, and teams can export the same trace data to other OTLP-compatible backends — Honeycomb, Jaeger, or their own ClickHouse instance. The cost is that setup requires running the Phoenix collector (a Python process or Docker container) and configuring OTLP exporters, which is 20-40 minutes of infrastructure work compared to LangSmith’s 5-minute API key setup. For teams running Kubernetes, the Phoenix Helm chart (v0.3.0 as of November 2024) simplifies this, but the operational footprint is non-zero.

## Evaluation and Experiment Tracking

Tracing answers “what happened.” Evaluation answers “was it good.” Both platforms offer evaluation frameworks, but their models for running evals and integrating results into development workflows differ sharply.

### LangSmith’s Dataset-Centric Evaluation

LangSmith’s evaluation system, stable since Q1 2024, is built around the concept of datasets — collections of example inputs with optional reference outputs. A developer creates a dataset (manually via the UI, from production traces, or programmatically via the SDK), then runs an evaluation job that executes the target chain or agent against each example and scores the outputs. LangSmith ships with a set of built-in evaluators: correctness (exact match or LLM-as-judge), embedding similarity, string distance, and custom criteria. As of the December 2024 release, LangSmith supports online evaluation — scoring production traces in real-time against user-defined criteria — and offline evaluation against curated test suites.

The workflow is designed to fit a CI/CD pipeline: a pull request triggers an evaluation run, the results appear in the LangSmith UI with per-example scores, and the team can block merges on regressions. LangSmith’s pricing for evaluations is usage-based. As of January 2025, the developer plan includes 5,000 free trace evaluations per month; beyond that, evaluations consume trace credits at the standard rate of $0.005 per trace (first 10,000 traces free on the developer tier). For a team running 50,000 evaluations per month, the cost is approximately $200, plus any LLM inference costs for LLM-as-judge evaluators.

### Arize Phoenix’s Span-Level Evaluation with Phoenix Evals

Phoenix’s evaluation model, released as `phoenix.evals` in August 2024 and stabilized in the 1.0 release, operates at the span level rather than the dataset level. A developer defines a template — a classification or scoring prompt — and Phoenix runs it against retrieved spans, attaching evaluation labels directly to the trace data. The library includes pre-built templates for hallucination detection, QA correctness, summarization quality, and code generation correctness, each backed by a specific model (gpt-4o-2024-08-06 by default, configurable to claude-3.5-sonnet-2024-10-22 or open-source models via LiteLLM).

The key architectural difference is that Phoenix evaluations are not a separate job execution system. They run as part of the same OTLP pipeline: a span is ingested, an evaluator is triggered (synchronously or asynchronously), and the evaluation result is written back as span attributes. This means evaluations can run continuously on production traffic without a separate batch process. The trade-off is that Phoenix does not have LangSmith’s dataset management and experiment comparison UI. A team wanting to compare the performance of two prompt variants across a fixed test set will need to manage that workflow externally — tagging spans with experiment IDs and querying them in the Phoenix UI or via the Python client.

## Cost, Deployment, and Data Residency

The total cost of ownership for an observability platform includes not just the sticker price but the operational burden and where the data lives. The two platforms diverge significantly here.

### LangSmith: Managed SaaS with Per-Trace Pricing

LangSmith is a managed SaaS product. All trace data is stored in LangChain’s infrastructure (AWS us-east-1 as of January 2025, with a European region in private beta). Pricing is strictly per-trace: the free tier includes 10,000 traces per month, the developer tier is $0.005 per additional trace, and enterprise plans with SSO, RBAC, and data retention SLAs start at $1,500 per month with negotiated per-trace rates. A team generating 1 million traces per month — typical for a production agent handling 30,000 requests per day with an average of 33 spans per request — will pay approximately $4,950 per month on the developer tier, or less on an enterprise contract.

The managed model eliminates operational overhead: no infrastructure to maintain, automatic scaling, and a 99.9% uptime SLA on enterprise plans. The downside is data residency. For teams in regulated industries or those with strict data sovereignty requirements, sending trace data — which includes full prompt contents, chain-of-thought reasoning, and tool outputs — to a US-based SaaS is a non-starter. LangSmith’s documentation as of December 2024 indicates that self-hosted deployment is “available for enterprise customers with specific security requirements,” but no public pricing or architecture details exist.

### Arize Phoenix: Open-Source Core with Optional Cloud

Phoenix’s core tracing and evaluation engine is open-source under the Apache 2.0 license. A team can deploy Phoenix on their own infrastructure — a single Docker container on an EC2 instance, a Kubernetes pod, or a local development machine — and retain full control over trace data. The open-source version includes the trace UI, span search, embedding visualization, and the `phoenix.evals` library. It does not include user authentication, role-based access control, or persistent storage management; those are left to the operator.

Arize offers a managed cloud version, Arize AX, which launched in October 2024. AX provides the Phoenix UI with managed infrastructure, SSO, and data retention guarantees. Pricing as of January 2025 is based on trace volume and data retention: the free tier includes 50 GB of trace storage (approximately 2-5 million traces depending on span complexity), the pro tier starts at $300 per month for 100 GB, and enterprise plans are custom. For a team generating 1 million traces per month, the open-source self-hosted path costs only the infrastructure — roughly $200-500 per month for a modest EC2 instance with attached storage — while the managed AX path costs approximately $300-600 per month depending on retention needs.

## Integration Depth and Ecosystem Lock-In

The final dimension is how deeply each platform integrates with the broader AI development toolchain and whether adoption creates switching costs.

### LangSmith’s LangChain Ecosystem Integration

LangSmith’s integration with LangChain is not just deep — it is architectural. LangGraph’s state management, LangChain’s hub-based prompt management (LangChain Hub, launched in beta in March 2024), and LangSmith’s tracing share a common data model. A prompt versioned in LangChain Hub is automatically tagged in LangSmith traces, allowing a developer to click from a trace span directly to the exact prompt template version that produced it. The hub integration also enables A/B testing of prompts: a developer can deploy two prompt versions to a LangServe endpoint, and LangSmith traces will be annotated with the prompt version, making it straightforward to compare latency, token usage, and evaluation scores across variants.

The risk is ecosystem lock-in. If a team builds their agent architecture on LangGraph, instruments with LangSmith, and manages prompts in LangChain Hub, migrating away from any one of these components requires significant rework. The LangChain team has stated publicly that LangSmith will support non-LangChain frameworks — the `@traceable` decorator is a step in this direction — but as of January 2025, the platform’s value proposition is strongest when used within the LangChain ecosystem.

### Arize Phoenix’s Framework-Agnostic Stance

Phoenix’s OpenInference specification is explicitly designed to be framework-agnostic. The same trace format represents a LangChain agent, a LlamaIndex pipeline, a custom Python agent, or a TypeScript agent running on Vercel’s AI SDK. The instrumentors are maintained as separate packages, and the core Phoenix server has no dependency on any LLM framework. This means a team can switch from LangChain to LlamaIndex (or vice versa) without changing their observability stack, and they can correlate traces across services written in different languages.

The trade-off is that Phoenix does not offer the same level of framework-specific integrations. There is no Phoenix equivalent of LangChain Hub for prompt management, no native integration with LangServe for deployment, and no built-in A/B testing framework. Teams that want these capabilities will need to integrate separate tools — for example, managing prompts in a Git repository and using custom span attributes to track versions — which adds operational complexity.

## Recommendations for Production Teams

The choice between LangSmith and Arize Phoenix in early 2025 hinges on three factors: the team’s commitment to the LangChain ecosystem, their data residency requirements, and their tolerance for operational overhead.

Teams already using LangGraph or LangChain for agent orchestration and comfortable with SaaS data storage should default to LangSmith. The zero-instrumentation tracing, integrated prompt management, and dataset-centric evaluation workflow reduce the time from agent development to production debugging. The cost at scale — roughly $0.005 per trace — is predictable, and the enterprise plan provides the compliance certifications (SOC 2 Type II as of Q3 2024) that many organizations require.

Teams that need data residency control, operate multi-framework codebases, or have existing OpenTelemetry infrastructure should deploy Arize Phoenix. The open-source core eliminates vendor lock-in for trace storage, and the OTLP-native ingestion means traces can be re-routed to other backends if needed. The operational cost of self-hosting Phoenix is 10-20% of LangSmith’s per-trace pricing at scale, but the team must budget engineering time for deployment, monitoring, and storage management — roughly 5-10 hours per month for a production deployment handling 1 million traces.

For teams evaluating both, a practical path is to run Phoenix locally for development tracing (the open-source Docker image starts in under a minute) while evaluating LangSmith’s free tier for its evaluation and dataset features. The two platforms are not mutually exclusive at the instrumentation layer — a LangChain agent can emit traces to both backends using the LangSmith callback and the OpenInference instrumentor simultaneously — though this doubles the trace volume and should only be used during evaluation periods. The decision should be made within 30 days of evaluation, as maintaining dual instrumentation in production creates confusion in incident response and unnecessary compute costs.
