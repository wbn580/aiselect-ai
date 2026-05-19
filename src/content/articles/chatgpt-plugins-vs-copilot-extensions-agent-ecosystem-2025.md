---
title: "ChatGPT Plugins vs Microsoft Copilot Extensions: Agent Ecosystem and Monetization in 2025"
description: "When OpenAI launched ChatGPT Plugins in March 2023, the move was framed as the arrival of an app-store moment for large language models. The reality was more…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:46:30Z"
modDatetime: "2026-05-18T10:46:30Z"
readingTime: 10
tags: ["Agent Platforms"]
---

When OpenAI launched ChatGPT Plugins in March 2023, the move was framed as the arrival of an app-store moment for large language models. The reality was more constrained. By April 2024, OpenAI had stopped onboarding new plugin developers and shifted attention toward GPTs, signaling that the plugin architecture as originally designed would not carry forward. Then in November 2024, Microsoft made Copilot extensibility generally available with a unified manifest for Teams, Microsoft 365, and the Copilot pane itself, while introducing a publisher revenue share of 20% for Copilot extensions sold through the Microsoft commercial marketplace. The timing matters. Two platform owners, each with a dominant distribution channel, are now pursuing divergent monetization models and developer incentives. For teams building production agent workflows in early 2025, the choice between the OpenAI ecosystem and the Microsoft Copilot ecosystem is not a matter of API preference. It is a decision about where agent logic lives, how tool calls are authenticated, and whether the economics of a marketplace justify the integration overhead.

## Platform Architecture and Tool-Calling Mechanics

The two ecosystems share a common ancestor in function-calling design but diverge sharply in how tools are registered, invoked, and secured. Understanding those differences is prerequisite to any build-versus-buy decision for agent tooling.

### OpenAI’s Transition from Plugins to GPT Actions

OpenAI’s plugin system relied on an OpenAPI specification that the model consumed at invocation time. The plugin manifest declared endpoints, authentication schemes (OAuth, service-level API keys, or no auth), and a human-readable description that the model used to decide when and how to call an external service. Execution was server-side: the ChatGPT infrastructure acted as a proxy, sending requests to the third-party endpoint and returning structured results to the model for synthesis.

GPT Actions, introduced in November 2023 and made the forward path by mid-2024, preserve the OpenAPI contract but remove the plugin storefront. A GPT Action is configured inside a custom GPT and authenticated either at the user level (OAuth) or via an API key embedded in the GPT’s configuration. The critical architectural shift is that Actions are scoped to a single GPT instance rather than being globally discoverable. There is no centralized monetization layer. Developers who want to charge for access must implement their own paywalls outside the OpenAI ecosystem, typically by gating the API endpoint behind a subscription service and issuing API keys manually.

As of January 2025, OpenAI has not announced a replacement marketplace for GPT Actions. The GPT Store, which launched in January 2024, compensates GPT builders through a usage-based program tied to ChatGPT Plus and Team subscriptions, but that program applies to the GPT wrapper itself, not to the external APIs that Actions call. A developer whose GPT Action calls a paid third-party service receives no revenue share from OpenAI for that tool call. The economics are entirely external.

### Copilot Extensions and the Declarative Agent Manifest

Microsoft’s Copilot extension model uses a declarative agent manifest, a JSON document that defines the agent’s capabilities, the knowledge sources it can access (Microsoft Graph connectors, SharePoint indices, or external APIs via plugins), and the instructions that govern its behavior. The manifest is the same schema used for Copilot in Teams, Microsoft 365 Copilot, and the standalone Microsoft Copilot app, which means a single extension can surface across multiple surfaces without per-channel reconfiguration.

Tool calling in Copilot extensions follows a hybrid pattern. For Microsoft-hosted knowledge sources, retrieval is handled by the Copilot orchestration layer using semantic indexing and the tenant’s permission model. For external APIs, the extension includes an OpenAPI description that Copilot’s orchestrator reads at runtime to determine which endpoints match a user’s intent. Authentication is mediated by Microsoft Entra ID, with support for OAuth 2.0 delegated flows and single sign-on across the Microsoft identity boundary. The practical implication is that a Copilot extension calling a third-party API does not need to manage user credentials independently; it inherits the user’s Entra identity and the permissions the tenant admin has consented to.

The orchestrator itself, as of the generally available release in November 2024, uses a combination of GPT-4o (gpt-4o-2024-08-06) for intent classification and tool selection, with retrieval-augmented generation grounded against the tenant’s Microsoft 365 data. Microsoft has not disclosed the exact model routing logic, but the system prompt and tool-selection layer are managed by Microsoft, not by the extension developer. This contrasts with OpenAI’s GPT Actions, where the developer writes the system prompt and the model selects tools based on the prompt and the OpenAPI description alone.

## Monetization Structures and Developer Economics

Monetization is where the two ecosystems diverge most dramatically, and the differences have direct implications for how teams fund agent development.

### OpenAI’s External-Only Revenue Model

OpenAI does not operate a transaction marketplace for third-party tool calls. The GPT Store revenue program, detailed in OpenAI’s January 2024 announcement, distributes a portion of ChatGPT Plus and Team subscription revenue to qualifying GPT builders based on usage metrics that OpenAI does not publicly disclose in detail. The program is limited to GPTs themselves; it does not cover external APIs called through Actions. A developer who builds a GPT Action that connects to a paid SaaS product must collect payment independently. OpenAI provides no billing infrastructure, no usage metering for external calls, and no revenue-share mechanism for tool usage.

The result is that the developer bears the full cost of API inference for external calls plus any model token costs incurred by the GPT’s conversation, while monetizing through a separate channel. For a small team shipping a GPT Action in early 2025, the operational overhead includes maintaining a subscription management system, handling authentication token lifecycle, and absorbing the latency and failure modes of a two-hop architecture where OpenAI’s servers call the developer’s servers before returning results to the user.

### Microsoft’s 20% Revenue Share and Commercial Marketplace Integration

Microsoft’s Copilot extension monetization, announced at Ignite 2024 and effective November 2024, takes a different approach. Extensions that are sold through the Microsoft commercial marketplace (AppSource or the Azure Marketplace) are eligible for a revenue share where the publisher retains 80% of the transaction price and Microsoft retains 20%. This applies to extensions with a flat-fee or per-user-per-month pricing model. Usage-based metering for Copilot extensions is not yet generally available as of January 2025, though Microsoft has indicated it is on the roadmap.

The marketplace integration means that billing, subscription management, and license enforcement are handled by Microsoft’s existing commerce infrastructure. For enterprise buyers, Copilot extensions can be procured against an existing Microsoft Azure Consumption Commitment (MACC), which reduces procurement friction. For developers, the tradeoff is the 20% revenue share in exchange for access to the Microsoft 365 install base and a billing system that handles tax, compliance, and renewal workflows across multiple geographies.

The effective economics depend on scale. A developer selling a Copilot extension at US$10 per user per month keeps US$8.00 after Microsoft’s share. If the same developer were to distribute a comparable tool through a GPT Action with a US$10 subscription managed independently, the gross revenue is US$10, but the developer must subtract payment processing fees (typically 2.9% plus US$0.30 per transaction), subscription management platform costs, and the engineering time required to maintain the billing and auth stack. At small scale, the independent route can yield higher net revenue. At enterprise scale with multi-geography tax compliance and procurement requirements, the Microsoft marketplace’s 20% cut may be cheaper than the operational burden of self-service billing.

## Developer Experience and Integration Overhead

Beyond architecture and monetization, the day-to-day experience of building, testing, and debugging agent extensions differs materially between the two platforms.

### Authentication and Identity Management

OpenAI’s GPT Actions support three authentication modes: none, API key, and OAuth 2.0. The OAuth flow requires the developer to register a client with their own authorization server and configure the redirect URI to point to OpenAI’s callback endpoint (`https://auth.chatgpt.com/oauth/callback`). The developer is responsible for token refresh, scope management, and handling authorization errors. For a multi-tenant SaaS product, this means maintaining an OAuth provider that can issue tokens scoped to individual ChatGPT users, which is nontrivial infrastructure.

Microsoft Copilot extensions authenticate through Microsoft Entra ID by default. The extension manifest declares the required OAuth scopes, and the Copilot orchestrator handles token acquisition and refresh using the signed-in user’s Entra identity. For extensions that call external APIs outside the Microsoft ecosystem, the developer configures an Entra application registration with delegated permissions to the external service, and Copilot presents the consent screen to the user or tenant admin at first use. The developer does not manage token lifecycle directly. The cost is that the extension is tightly coupled to the Microsoft identity stack; users without an Entra ID (or a guest identity in an Entra tenant) cannot use the extension.

### Testing and Debugging Workflows

As of January 2025, OpenAI provides a GPT builder interface with a preview pane that shows tool call requests and responses in a structured log. The developer can inspect the JSON payload that the model sends to the external API and the response that comes back, but there is no step-through debugger, no breakpoint support, and no way to replay a specific tool call with modified parameters without starting a new conversation. Error messages from the external API are surfaced in the preview pane, but the developer must correlate them with server-side logs manually.

Microsoft’s tooling for Copilot extensions centers on the Teams Toolkit for Visual Studio Code and the Copilot extension validation tool. The Teams Toolkit includes a local debugging environment that runs the extension manifest and the API endpoint on a developer’s machine, with the Copilot orchestrator routing tool calls through a tunneling service (either Dev Tunnels or ngrok) to the local endpoint. Developers can set breakpoints in the API code, inspect the full request context including the user’s Entra identity claims, and step through the tool-call resolution logic. The validation tool checks the manifest for schema compliance and the OpenAPI description for endpoint reachability before submission to the marketplace. The debugging experience is closer to standard web-API development than OpenAI’s conversation-scoped preview.

## Distribution and Discovery

How users find and install agent extensions affects adoption and retention, and the two platforms have taken opposite approaches to discoverability.

OpenAI’s GPT Store, accessible within the ChatGPT interface, allows users to browse and search for GPTs by category. GPT Actions are not independently listed; a user discovers an Action by installing the GPT that contains it. There is no mechanism for a user to search for “a tool that connects to my CRM” and find a standalone Action. The GPT is the unit of distribution, and the Action is subordinate to it. This bundling means that a developer who wants to offer a tool-calling capability must also build and maintain the GPT wrapper, including its system prompt, conversation starters, and knowledge files. The Action cannot be distributed independently.

Microsoft’s Copilot extension model treats the extension as the primary distributable unit. An extension can contain multiple capabilities (API plugins, knowledge sources, prompt instructions) but is listed as a single item in the Microsoft commercial marketplace and in the Copilot extension catalog within Teams and Microsoft 365 Copilot. Users and tenant admins can install extensions without navigating through a conversational wrapper. For enterprise deployments, admins can pre-install extensions for specific users or groups and manage them through the Microsoft 365 admin center, including the ability to block extensions that do not meet data-residency or compliance requirements. This admin-plane control is absent from OpenAI’s consumer-oriented GPT Store, which offers no centralized governance for organizations beyond the ChatGPT Team workspace.

## Closing Takeaways

1. **Choose Copilot extensions if enterprise distribution and identity matter.** The Microsoft ecosystem provides Entra ID-based authentication, tenant-level admin controls, and a marketplace with 20% revenue share and MACC eligibility. The tradeoff is platform lock-in and a development workflow that assumes the Microsoft identity boundary.

2. **Choose GPT Actions if you need to reach consumers or non-Microsoft identity users.** OpenAI’s architecture allows any OAuth provider and does not require an Entra ID. The cost is that monetization, billing, and auth lifecycle management are entirely the developer’s responsibility, with no marketplace support.

3. **Budget for the hidden operational costs of GPT Actions.** A self-managed billing and auth stack for a GPT Action calling a paid API will consume engineering time that scales with user count. At fewer than 500 paid users, the overhead may be manageable. Above that threshold, the Microsoft marketplace’s 20% cut begins to look like a reasonable price for outsourced commerce infrastructure.

4. **Plan for the agent orchestrator, not just the tool call.** In both ecosystems, the platform owner controls the model that decides when and how to invoke a tool. Developers who need deterministic tool-selection logic or custom routing should evaluate whether the platform’s orchestrator can be configured to meet those requirements, or whether a self-hosted agent framework with direct model access is a better fit.

5. **Monitor the GPT Store revenue program for changes.** OpenAI has not announced a tool-call marketplace, but the company’s trajectory from plugins to GPTs to Actions suggests that monetization infrastructure is still in motion. A revenue-share program for Actions, if launched, would change the calculus for developers currently building independent billing systems.
