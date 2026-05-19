---
title: "Smythos vs Decision AI: Agent Platform for Enterprise with SOC 2 and Role-Based Access"
description: "In the past twelve months, enterprise procurement teams have rewritten their AI vendor checklists. The trigger was not a single regulatory event but a cascad…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:08:08Z"
modDatetime: "2026-05-18T11:08:08Z"
readingTime: 9
tags: ["Agent Platforms"]
---

In the past twelve months, enterprise procurement teams have rewritten their AI vendor checklists. The trigger was not a single regulatory event but a cascade: the EU AI Act’s passage in March 2024, the SEC’s July 2024 clarification that AI-generated financial outputs fall under existing recordkeeping rules, and a wave of SOC 2 Type II requirements trickling down from Fortune 500 RFPs to Series B startup due diligence questionnaires. For engineering leads evaluating agent platforms, the question shifted from “Can this orchestrate LLM calls?” to “Can this orchestrate LLM calls while keeping our compliance officer and CISO in the room?” Two platforms that surfaced repeatedly in late-2024 enterprise bake-offs are Smythos and Decision AI. Both ship role-based access control (RBAC) and SOC 2 attestations. Both pitch themselves as the agent layer that legal and infosec will actually approve. The divergence lies in what they optimize for beyond the compliance checkbox — and that divergence carries real cost and latency implications once an agent moves from pilot to production.

---

## Architecture and Execution Model

### Smythos: Visual Graph with Human-in-the-Loop Checkpoints

Smythos structures agent logic as a directed acyclic graph (DAG) rendered in a drag-and-drop canvas. Each node is a typed operation: an LLM call, a webhook, a data transform, or a “human review” gate. The human review node is the platform’s architectural signature. When an agent hits that node, execution pauses, a notification routes to a designated reviewer via Slack or email, and the agent resumes only after approval. This is not a bolt-on — it is a first-class execution state, which means the platform maintains a full audit log of who approved what, with timestamps and session IDs, across every pause-resume cycle.

Under the hood, Smythos runs on a proprietary orchestration runtime that statefully manages conversation threads. As of December 2024, the platform defaults to gpt-4o-2024-08-06 for reasoning nodes and gpt-4o-mini-2024-07-18 for lighter classification tasks, though models are configurable per node. The runtime caches LLM responses with a configurable TTL (default 3,600 seconds) to reduce duplicate API spend. Execution latency for a three-node agent — classify, reason, human review — averaged 4.7 seconds end-to-end in a benchmark run on December 12, 2024, excluding the human wait time. The same benchmark measured 2.1 seconds for the classify-reason segment before the review gate.

### Decision AI: Policy Engine with Declarative Guardrails

Decision AI takes a different approach. Instead of a visual graph, agents are defined in a YAML-based policy language that declares intents, constraints, and escalation paths. The platform’s core is a rules engine — internally called the Decision Kernel — that evaluates every agent action against a set of organizational policies before execution. A policy might state: “Agents in the finance domain may not generate text that includes a dollar amount above $50,000 without director-level approval.” The Kernel intercepts the LLM output, runs a structured extraction pass, checks the value against the policy threshold, and either allows, blocks, or escalates the response.

Decision AI’s runtime is stateless by design. Each agent turn is evaluated independently, with context passed explicitly in a JSON payload. This statelessness simplifies horizontal scaling but places a heavier burden on the developer to manage conversation history externally. As of January 2025, Decision AI defaults to claude-3.5-sonnet-2024-10-22 for policy-sensitive workloads, citing Anthropic’s constitutional AI training as a better fit for constrained generation. The platform also supports gpt-4o-2024-11-20 as an alternative. In a comparable three-step workflow — classify, reason, policy check — Decision AI clocked 3.9 seconds end-to-end on December 18, 2024, with the policy evaluation step consuming 1.1 seconds of that total.

---

## Compliance and Access Control

### Smythos: RBAC with Field-Level Audit Trails

Smythos implements a role-based access model with four default tiers: Viewer, Developer, Approver, and Admin. Permissions cascade down to individual agent nodes. An Approver can be scoped to a specific human review gate within a specific agent, preventing lateral access to other workflows. The platform achieved SOC 2 Type II certification on September 14, 2024, as confirmed by Smythos’s public trust page updated that same date. The audit trail captures field-level changes: every node configuration edit, every prompt modification, and every human review decision is logged with the actor’s identity and a SHA-256 hash of the change payload.

Data residency is handled at the organization level during tenant provisioning. As of January 2025, Smythos offers hosting regions in us-east-1 (AWS Virginia), eu-west-1 (AWS Ireland), and ap-southeast-1 (AWS Singapore). The platform encrypts agent state at rest using AES-256-GCM and enforces TLS 1.3 for all API traffic. For enterprises requiring on-premise deployment, Smythos offers a Kubernetes Helm chart with a minimum cluster specification of 3 nodes, 16 vCPUs each, and 64 GB RAM per node. That option became generally available on November 1, 2024, priced at $45,000 per year for up to 50 agent seats.

### Decision AI: Attribute-Based Access with Policy-as-Code

Decision AI uses attribute-based access control (ABAC) rather than traditional RBAC. Permissions are expressed as policies that evaluate user attributes (department, clearance level, geography), resource attributes (agent domain, data classification), and environmental attributes (time of day, network zone). A policy might read: “Users with clearance_level >= 3 AND department = ‘legal’ may approve agent outputs classified as PII.” This granularity appeals to organizations that have already adopted policy-as-code for infrastructure and want to extend it to the agent layer.

Decision AI’s SOC 2 Type II report was issued on October 3, 2024, covering the platform’s US and EU hosting regions. The platform’s audit model is decision-centric rather than field-centric: every policy evaluation — allow, deny, escalate — is logged with the full set of attribute values that informed the decision. This produces a more compact audit trail but requires the auditor to understand the policy language to reconstruct what happened. Data residency spans us-west-2 (AWS Oregon), eu-central-1 (AWS Frankfurt), and a forthcoming ap-northeast-1 (AWS Tokyo) region slated for Q2 2025. On-premise deployment is available via a Docker Compose stack for single-node evaluation or a Kubernetes operator for production, with the operator licensed at $38,000 per year for unlimited agents within a single Kubernetes cluster as of January 2025 pricing.

---

## Integration Surface and Developer Experience

### Smythos: Broad Connectors, Node-Level Hooks

Smythos ships with 47 pre-built connectors as of its December 2024 platform update. The list covers Salesforce (API version 58.0), ServiceNow (Tokyo release), Zendesk, Jira, Slack, Microsoft Teams, and 12 SQL and NoSQL databases including PostgreSQL 16, MySQL 8.0, and MongoDB 7.0. Each connector exposes typed inputs and outputs within the visual graph, so a developer can drag a Salesforce node, map its output to an LLM reasoning node, and route the result to a Slack notification node without writing glue code.

For custom integrations, Smythos supports Node.js 20 and Python 3.12 runtime environments within sandboxed execution containers. A developer can write a custom transform node in TypeScript, package its dependencies in a package.json, and deploy it alongside the agent graph. Cold start for a custom node container averaged 800 milliseconds in testing on December 12, 2024. The platform also exposes a REST API and a WebSocket endpoint for external triggering, with API keys scoped to individual agents. Rate limits are enforced per agent: 600 requests per minute on the Pro tier ($1,200 per month for 10 agents) and 3,000 requests per minute on the Enterprise tier ($4,500 per month for unlimited agents as of January 2025).

### Decision AI: Policy-First SDK, Narrower Connector Set

Decision AI’s integration philosophy centers on its Python and TypeScript SDKs, which expose the Decision Kernel as an importable module. A developer writes agent logic in their own codebase, calls the SDK’s `evaluate()` function at decision points, and receives a structured verdict: `allow`, `deny`, or `escalate` with a required approver role. This SDK-first approach means Decision AI does not aim to replace the developer’s existing orchestration layer (LangChain, LlamaIndex, or custom code) but to sit alongside it as a policy enforcement point.

The platform ships with 22 native connectors as of January 2025, focused on enterprise systems: SAP S/4HANA, Oracle EBS, Workday, and Microsoft Dynamics 365, plus the standard Slack and Teams integrations. Database connectors are limited to PostgreSQL 16 and Microsoft SQL Server 2022. This narrower surface reflects Decision AI’s focus on regulated industries where those systems dominate. The SDK itself is versioned at 2.1.0 as of January 6, 2025, with breaking changes documented in a migration guide covering the 2.0 to 2.1 transition. The REST API enforces rate limits of 1,200 evaluations per minute on the Business tier ($1,800 per month for 25 agents) and 6,000 evaluations per minute on Enterprise ($5,200 per month for unlimited agents).

---

## Pricing and Total Cost of Ownership

Smythos pricing as of January 2025 follows a per-agent model with tiered feature access. The Starter tier is $300 per month for 3 agents, with SOC 2 compliance and RBAC reserved for Pro ($1,200 per month, 10 agents) and Enterprise ($4,500 per month, unlimited agents). Human review nodes are available only on Pro and above. LLM API costs are passed through at cost plus a 7% platform fee, billed separately. A typical 10-agent deployment with moderate LLM usage — approximately 50,000 gpt-4o-mini calls and 8,000 gpt-4o calls per month — runs roughly $2,100 per month all-in, based on December 2024 Azure OpenAI pricing.

Decision AI prices by evaluation volume, not agent count. The Starter tier is $600 per month for 15,000 policy evaluations, with SOC 2 and ABAC on Business ($1,800 per month, 60,000 evaluations) and Enterprise ($5,200 per month, 250,000 evaluations). LLM costs are not passed through because Decision AI does not host the LLM calls — the developer’s own infrastructure makes those calls, and Decision AI only evaluates the inputs and outputs. This shifts LLM spend out of the platform bill but adds the operational cost of running and scaling the LLM integration layer. For a deployment handling 60,000 agent turns per month, with LLM calls managed on AWS Bedrock using claude-3.5-sonnet-2024-10-22 at on-demand pricing, total monthly cost lands around $2,800, of which $1,800 is the Decision AI license and roughly $1,000 is Bedrock inference.

---

## What to Do Next

1. **Map your approval topology before evaluating either platform.** If your workflows require synchronous human sign-off mid-execution — a compliance officer approving a generated contract clause before it reaches the client — Smythos’s first-class human review nodes will reduce the engineering effort to implement that pattern. If your approvals are primarily automated policy checks on outputs, Decision AI’s policy engine will be a more natural fit.

2. **Audit your existing LLM hosting arrangement.** Decision AI’s architecture assumes you already run and pay for your own model inference. If you are deep into AWS Bedrock or Azure OpenAI with committed spend, that model keeps your LLM costs consolidated. If you want the platform to abstract model routing and billing, Smythos’s pass-through model simplifies vendor management at the cost of a 7% premium.

3. **Test the audit trail output with your compliance team before committing.** Smythos produces verbose, field-level logs that map cleanly to SOC 2 evidence requests. Decision AI produces policy-decision logs that require the auditor to read the policy language. One style will match your auditor’s expectations; the other will generate friction. Run a one-week trial with both platforms and have your compliance lead review the exported logs.

4. **Calculate total cost on your actual agent call volume, not seat count.** Smythos’s per-agent pricing looks cheaper at small scale but the 7% LLM passthrough fee scales with usage. Decision AI’s evaluation-based pricing front-loads the platform cost but decouples it from model spend. At 250,000 agent turns per month, the crossover point where Decision AI becomes cheaper depends on your average tokens per turn. Run the numbers with your own prompt lengths.
