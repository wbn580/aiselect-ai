---
title: "LangGraph vs Semantic Kernel: Agent Orchestration and State Management in Production"
description: "In late 2024, the agent orchestration landscape shifted underfoot. OpenAI shipped real-time voice in the Realtime API, Anthropic introduced computer-use capa…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:46:32Z"
modDatetime: "2026-05-18T10:46:32Z"
readingTime: 14
tags: ["Agent Platforms"]
---

In late 2024, the agent orchestration landscape shifted underfoot. OpenAI shipped real-time voice in the Realtime API, Anthropic introduced computer-use capabilities in Claude 3.5 Sonnet (October 2024), and Microsoft rolled Semantic Kernel’s multi-agent experimental support into its .NET and Python SDKs. The question for a team evaluating agent frameworks is no longer “can we build agents” but “which framework handles production state, retries, and multi-model routing without collapsing under its own abstraction weight.”

Two frameworks have emerged as reference points for developers building compound AI systems: LangGraph (LangChain’s state-machine agent framework, v0.2.x as of November 2024) and Semantic Kernel (Microsoft’s open-source AI orchestration SDK, v1.15 as of December 2024). Both claim to solve agent orchestration. They approach it from opposite architectural philosophies. LangGraph treats agent logic as a directed cyclic graph with explicit state channels. Semantic Kernel embeds agent behavior inside a kernel that invokes plugins and planners, now extended with agent group chat patterns in its experimental Agent Framework.

The choice between them has material consequences: cold-start latency under 200ms for a tool-calling loop, the debuggability of a 12-step agent run that failed on step 9, and whether a team of three developers can ship a multi-agent customer support system in four weeks without accruing technical debt that requires a rewrite at month six. This piece evaluates both frameworks against concrete criteria—state management, model routing, observability, and production hardening—using dated benchmarks and published API pricing as of December 2024.

## State management and execution model

The fundamental difference between LangGraph and Semantic Kernel lies in how they model agent execution. LangGraph externalizes state as a first-class object that flows through a compiled graph. Semantic Kernel internalizes state within the kernel, plugins, and chat history objects, exposing it through context variables and function arguments.

### LangGraph: explicit state channels and checkpointing

LangGraph represents an agent as a state graph where nodes are computation steps (LLM calls, tool executions, conditional edges) and edges carry state between them. State is a developer-defined TypedDict or Pydantic model. The graph runtime manages state transitions through reducer functions—by default, channels are overwritten, but developers can specify append-only semantics for message lists or merge strategies for nested objects.

As of langgraph v0.2.34 (November 2024), the framework supports built-in checkpointing via a `checkpointer` interface. When a graph is compiled with a checkpointer, every state transition is persisted. This enables resumption from any node after a failure, human-in-the-loop approval flows, and time-travel debugging where an operator can replay an agent run from step 7 with modified state. The default SQLite checkpointer works for local development; production deployments typically use the Postgres checkpointer (langgraph-checkpoint-postgres v0.1.0, October 2024).

The execution model is synchronous at the graph level—nodes run sequentially within a single “superstep”—but supports asynchronous node functions and parallel fan-out via `Send` API calls. A typical ReAct agent graph comprises three nodes (agent call, tool execution, conditional routing) and cycles until a stopping condition is met.

LangGraph’s state model imposes upfront design cost: developers must define state shape before writing node logic. This constraint pays off when debugging. A failed 15-step agent run leaves a complete state trace where each step’s inputs and outputs are inspectable. In practice, teams at Elastic and LinkedIn (both cited as LangGraph users in LangChain’s October 2024 case studies) report that state transparency reduces mean time to resolution for agent errors by making failure modes legible without log reconstruction.

### Semantic Kernel: kernel as orchestrator with chat history

Semantic Kernel’s execution model centers on the `Kernel` object, which mediates between AI services (model connectors), plugins (wrapped functions), and planners (strategies for selecting and ordering function calls). State lives in the `KernelArguments`, `ChatHistory` object, and plugin-level context. The kernel invokes functions by matching user intent to available plugins, resolving parameters through the kernel’s service container and context bag.

In the experimental Agent Framework (Microsoft.SemanticKernel.Agents.Abstractions v1.15.0-alpha, December 2024), multi-agent orchestration uses `AgentChat` and `AgentGroupChat` classes. An `AgentGroupChat` manages a collection of agents—each backed by a chat completion service or a plugin set—and coordinates turn-taking via a selection strategy (round-robin, LLM-determined, or custom). Chat history is the shared state substrate. Each agent receives the full conversation context and appends its response.

This design reduces boilerplate for simple multi-agent patterns: a group chat where a “researcher” agent retrieves documents and a “writer” agent synthesizes summaries can be implemented in under 60 lines of C# or Python. The trade-off is that state outside chat history—transactional state, intermediate computation results, approval flags—must be managed through plugin code or external stores. Semantic Kernel does not provide a built-in checkpointing mechanism equivalent to LangGraph’s. Recovery from a mid-run failure requires reconstructing state from chat history and re-invoking the agent group, which may re-execute side effects unless plugins are explicitly idempotent.

### Production implications

For a customer-facing agent that processes 50,000 conversations per day with a p99 latency target of 2 seconds, state management architecture determines reliability under load. LangGraph’s checkpointing enables exactly-once execution semantics for each node—if a tool call to a payment API fails, the graph resumes from the point of failure without re-running prior steps. Semantic Kernel’s chat-history-based approach requires that every plugin be designed for at-least-once semantics, shifting the burden to the developer.

A team at a mid-market fintech evaluated both frameworks in November 2024 for a dispute resolution agent. They measured the recovery time for a failed agent run that had completed 8 of 12 steps. LangGraph with Postgres checkpointing resumed in 340ms (time to load state and re-enter the graph at step 9). Semantic Kernel required re-executing the full agent group chat, averaging 2.1 seconds and re-triggering two idempotent-but-costly external API calls. The LangGraph implementation added approximately 200 lines of state definition and checkpointing configuration. The Semantic Kernel implementation added approximately 80 lines of plugin idempotency logic. The choice hinged on whether the team valued infrastructure-level guarantees or developer-managed resilience.

## Model routing and multi-model architecture

Production agents rarely call a single model. A typical compound system routes between a fast model for intent classification (GPT-4o-mini, $0.15/1M input tokens as of December 2024), a capable model for reasoning (Claude 3.5 Sonnet, $3/1M input tokens), and specialized models for structured extraction or tool selection. How each framework handles model routing affects cost, latency, and fallback behavior.

### LangGraph: model-agnostic nodes with configurable bindings

LangGraph does not ship with a built-in model abstraction. Nodes contain arbitrary Python or TypeScript code; the developer is responsible for instantiating model clients (OpenAI, Anthropic, Bedrock, local vLLM endpoints) and passing them into node functions. The recommended pattern as of langgraph v0.2.x is to define a `configurable` model binding using LangChain’s `ChatModel` interface or direct SDK calls, then thread model instances through graph state or runtime configuration.

This agnosticism means LangGraph imposes no constraints on model selection per node. A graph can route a classification step to GPT-4o-mini, a reasoning step to Claude 3.5 Sonnet, and a structured extraction step to a fine-tuned Llama-3.1-8B running on Fireworks (priced at $0.20/1M tokens as of December 2024). Model fallback logic is implemented in node code: a try/except block that catches rate limits or timeouts and retries with a secondary model.

The cost is that model routing code is explicit and repetitive. A team running 15 agent graphs in production will write similar model instantiation and retry logic across multiple nodes unless they extract shared utilities. LangChain’s `init_chat_model` helper (langchain-core v0.3.x, October 2024) reduces boilerplate by accepting a model string like `"openai:gpt-4o"` and returning a configured client, but it remains an opt-in convenience layer.

### Semantic Kernel: kernel-level service registration

Semantic Kernel registers AI services at the kernel level. A single kernel can hold multiple service registrations—for example, an OpenAI chat completion service for GPT-4o, an Azure OpenAI service for GPT-4o-mini in a private VNet, and a HuggingFace connector for local models. Services are selected by model ID or by service type when creating an `IChatCompletionService`. The kernel’s service selector pattern (introduced in Semantic Kernel v1.10, September 2024) allows specifying a default service and per-invocation overrides via `KernelArguments`.

For multi-agent scenarios, each agent within an `AgentGroupChat` can be bound to a different kernel service. A researcher agent uses GPT-4o with a retrieval plugin; a validator agent uses Claude 3.5 Sonnet via the Anthropic connector (available in Semantic Kernel v1.14, November 2024). The kernel handles service resolution transparently once configured.

The advantage is centralized model configuration. API keys, deployment names, and retry policies are defined once per service registration and inherited by all agents that use that service. The limitation is that service selection is static at agent creation time—an agent cannot dynamically switch models mid-turn unless the developer implements a custom service selector that inspects chat history or kernel arguments. LangGraph’s per-node flexibility makes dynamic routing simpler; Semantic Kernel’s kernel-level registration makes static routing safer and less error-prone for teams with well-defined model topologies.

### Cost observability

Model routing decisions directly impact inference cost. A single misrouted call that sends a simple classification to Claude 3.5 Sonnet instead of GPT-4o-mini costs roughly 20x more per token. LangGraph exposes per-node model usage through LangSmith tracing (priced at $39/month for the Developer plan as of December 2024), which logs token counts and model identifiers per graph step. Semantic Kernel integrates with Azure Monitor and Application Insights for token-level telemetry, with the `semantic-kernel` Azure SDK package emitting metrics to App Insights when configured with an instrumentation key. Both frameworks require explicit setup to achieve per-model cost attribution; neither provides it out of the box without observability infrastructure.

## Observability and debugging

Agent systems fail in ways that single-call LLM applications do not. A 10-step agent loop that succeeds on 99% of runs still produces 1-in-100 failures that are difficult to reproduce without step-level traces. The observability story of each framework determines how quickly an on-call engineer can diagnose a production incident at 3 AM.

### LangGraph: LangSmith integration and local debugging

LangGraph’s primary observability surface is LangSmith, LangChain’s hosted tracing platform. When a graph is invoked with LangSmith tracing enabled (via environment variables or a `langsmith` context manager), every node execution, state transition, and tool call is recorded as a trace span. The trace UI shows the graph topology, the state at each node, and the latency breakdown by step. As of LangSmith v0.9 (November 2024), traces support “playground” replay where a developer can re-run a specific node with modified state to test fixes.

For local debugging, LangGraph provides a `stream` method that yields state updates as the graph executes. A developer can iterate over `graph.stream(input, config)` and inspect state after each node. The `astream_events` method (added in langgraph v0.2.20, October 2024) emits granular events—`on_chat_model_start`, `on_tool_start`, `on_chain_end`—for building custom debug UIs or logging pipelines.

The LangSmith dependency is a cost consideration. Self-hosted tracing is possible via the LangSmith SDK’s local export mode, but the polished trace UI and replay features require a LangSmith account. Teams running air-gapped deployments or with strict data residency requirements may find the SaaS dependency limiting. An open-source alternative, LangFuse, offers LangGraph integration via a callback handler (langfuse-langchain v2.30, December 2024) but lacks the graph-aware visualization of LangSmith.

### Semantic Kernel: .NET diagnostics and OpenTelemetry

Semantic Kernel’s observability leverages the .NET diagnostics ecosystem for C# deployments and standard Python logging for Python deployments. The .NET SDK emits `ActivitySource` spans for kernel function invocations, AI service calls, and plugin executions. These spans integrate with OpenTelemetry exporters to Jaeger, Zipkin, or Azure Monitor. A team already instrumented with OpenTelemetry can add Semantic Kernel tracing by configuring the `Microsoft.SemanticKernel` activity source in their existing collector.

The Python SDK (semantic-kernel v1.15.0, December 2024) provides a `KernelLogger` that hooks into Python’s logging module. Setting the log level to DEBUG produces verbose output including prompt contents, function selection decisions, and service responses. This is adequate for development debugging but less structured than LangGraph’s step-level state traces. For production, the recommended path is to export logs to a centralized platform (Datadog, Grafana, Azure Monitor) and build dashboards that track agent completion rates, step latencies, and model token consumption.

A practical difference emerges in multi-agent debugging. When an `AgentGroupChat` produces an incorrect answer, the developer must inspect the full chat history and determine which agent made a faulty decision. Semantic Kernel’s logs show each agent’s turn and the messages exchanged, but the absence of explicit state snapshots means the developer reconstructs agent mental state from conversation context. LangGraph’s state-per-node traces make the agent’s internal state at each decision point directly inspectable.

## Production hardening and operational maturity

The gap between a demo agent and a production agent is measured in edge cases: rate limiting, model unavailability, partial failures, schema changes, and deployment rollbacks. Framework maturity in these dimensions determines whether a team spends sprint cycles on product logic or infrastructure resilience.

### LangGraph: deployment patterns and scaling

LangGraph graphs are compiled into a `Runnable` that can be served via LangServe (a FastAPI-based deployment tool) or embedded in any Python web application. LangGraph Cloud (launched in beta October 2024, generally available pricing not yet published) provides managed deployment with auto-scaling, checkpointing persistence, and a built-in tracing dashboard. For self-hosted deployments, the recommended pattern is to run LangGraph graphs inside a FastAPI or Flask application with a Redis-backed queue (Celery or RQ) for long-running agent invocations and a Postgres checkpointer for state persistence.

Horizontal scaling requires stateless graph execution with externalized state. LangGraph’s checkpointing design supports this: any worker can resume a graph from a checkpointer, so requests can be routed to any available instance. The limiting factor is the checkpointer database—Postgres with connection pooling handles approximately 2,000 concurrent checkpoint reads per second on a db.r6g.xlarge instance (benchmark from LangChain’s deployment guide, November 2024).

LangGraph does not provide built-in rate limiting or circuit breaking for model API calls. Teams must implement these at the node level using libraries like `tenacity` for retries with exponential backoff and `pybreaker` for circuit breaking. This is consistent with LangGraph’s philosophy of giving developers full control over node logic but increases the implementation burden for production hardening.

### Semantic Kernel: Azure-native production surface

Semantic Kernel’s production story is tightly coupled to the Azure ecosystem. The .NET SDK integrates with Azure Container Apps for deployment, Azure Key Vault for secret management, and Azure Monitor for observability. The kernel’s HTTP client factory pattern allows configuring retry policies, circuit breakers, and timeout per registered AI service via standard .NET `IHttpClientFactory` configuration—no additional libraries required.

For Python deployments, Semantic Kernel can be hosted on any ASGI server (Uvicorn, Gunicorn) or deployed to Azure App Service. The Python SDK’s retry support is less mature than .NET’s; as of v1.15.0 (December 2024), retries for transient failures are configured via `HttpX` transport options rather than a built-in policy abstraction.

Semantic Kernel’s plugin architecture enforces a boundary between AI orchestration and business logic. Plugins are decorated functions with typed parameters and return values. This makes them testable in isolation—a retrieval plugin can be unit-tested with mock embeddings before integration into an agent loop. LangGraph nodes are similarly testable as Python functions, but the framework does not enforce a plugin contract, so testing discipline depends on team conventions.

### API stability and versioning

LangGraph is pre-1.0 (v0.2.x as of December 2024) with an explicit stability policy: minor version bumps may include breaking changes to experimental APIs, while patch versions are safe. The core graph API (StateGraph, add_node, add_edge, compile) has been stable since v0.1.0 (January 2024), but the checkpointing and streaming APIs are evolving.

Semantic Kernel is also pre-1.0 for its agent features (the Agent Framework is experimental in v1.15.0-alpha), but the kernel, plugin, and service connector APIs are stable and covered by Microsoft’s standard .NET support policy. The C# SDK is v1.15.0; the Python SDK is v1.15.0. Microsoft has committed to backward compatibility for the kernel API within major versions, consistent with the .NET ecosystem’s versioning norms.

For a production deployment planned in Q1 2025, both frameworks carry API stability risk. LangGraph’s core is stable but its surrounding tooling (LangGraph Cloud, advanced streaming) is in active development. Semantic Kernel’s agent features are explicitly experimental and may change before stabilization, though the underlying kernel is production-grade.

## What to choose and when

The decision between LangGraph and Semantic Kernel reduces to three factors: the complexity of agent state, the team’s infrastructure preferences, and the acceptable level of framework abstraction.

**Choose LangGraph when agent state is the central concern.** If the agent must pause for human approval, resume from checkpoints after deployment restarts, or maintain transactional consistency across a 10-step workflow, LangGraph’s explicit state channels and built-in checkpointing provide infrastructure-level guarantees that Semantic Kernel’s chat-history model does not. The cost is approximately 200-400 additional lines of state definition and checkpointing configuration per agent graph, plus the operational overhead of running a Postgres checkpointer.

**Choose Semantic Kernel when the team is on the Microsoft stack or values plugin reusability.** For .NET shops already using Azure services, Semantic Kernel’s integration with Azure Container Apps, Key Vault, and Application Insights reduces the time to production deployment. The plugin model enforces a clean separation between AI orchestration and business logic that simplifies testing and reuse across agents. The trade-off is less granular control over agent state and recovery behavior.

**Consider running both if the system has heterogeneous agent requirements.** A common pattern observed in production deployments in late 2024: Semantic Kernel handles the customer-facing agent layer where Azure integration and .NET reliability matter, while LangGraph handles internal workflow agents that require complex state management and human-in-the-loop approval. The two frameworks can coexist within a service boundary, calling each other via HTTP or message queues.

**Invest in observability before shipping.** Regardless of framework, allocate at least one sprint to building dashboards that show per-agent completion rates, step-level latencies, model token consumption by model type, and failure reason categorization. The difference between a manageable production incident and a multi-hour outage is often whether the on-call engineer can see which step failed and why within 30 seconds of receiving the alert.

**Lock model versions and benchmark before upgrading.** Both frameworks abstract model calls, but model behavior changes between versions. Pin model deployments (gpt-4o-2024-08-06, claude-3.5-sonnet-2024-10-22) in configuration and run a standardized agent evaluation suite before rolling out a model upgrade. A 5% improvement on a public benchmark does not guarantee improvement on a domain-specific agent task—regressions in tool selection accuracy or instruction following are common and detectable only with evals that mirror production usage patterns.
