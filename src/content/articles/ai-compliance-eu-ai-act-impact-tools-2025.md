---
title: "AI Compliance and the EU AI Act: Impact on Tooling and Practices in 2025"
description: "Developers and founders selecting AI tooling in mid-2025 face a compliance landscape that shifted from theoretical to operational on 2 February 2025. That da…"
category: "Regulation & Ethics"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:39:54Z"
modDatetime: "2026-05-18T08:39:54Z"
readingTime: 14
tags: ["Regulation & Ethics"]
---

Developers and founders selecting AI tooling in mid-2025 face a compliance landscape that shifted from theoretical to operational on 2 February 2025. That date marks the end of the phased transition period under the EU AI Act, when Chapter III (high-risk AI systems), Chapter V (general-purpose AI models), and the corresponding obligations in Chapter XII (penalties) became enforceable. For teams building with model APIs, agent frameworks, or retrieval-augmented generation pipelines, the Act is no longer a policy document circulating in Brussels—it is a live regulatory framework with fines reaching €35 million or 7% of global annual turnover, whichever is higher. The practical question is not whether the Act applies, but which specific provisions attach to a given stack component and what evidence of compliance a buyer must retain. Tooling vendors have responded unevenly: some now ship audit-logging endpoints and conformity documentation as standard, while others treat compliance as a customer-side problem. This article examines the concrete impact on model APIs, development frameworks, agent platforms, and vector databases as of June 2025, with dated pricing and version references where they affect procurement decisions.

## The Regulatory Boundary: What Changed on 2 February 2025

The EU AI Act (Regulation 2024/1689) entered into force on 1 August 2024, but its obligations rolled out in stages. The 2 February 2025 deadline activated the core compliance machinery for high-risk systems and general-purpose AI models. Understanding which category a tool falls into determines whether a team is buying regulated infrastructure or unregulated components.

### High-Risk Classification and the Tooling Supply Chain

Article 6 and Annex III of the Act define high-risk AI systems by reference to two conditions: the system is a safety component of a product covered by existing EU harmonisation legislation, or it appears in a list of eight specified areas including biometrics, critical infrastructure, education, employment, access to essential services, law enforcement, migration, and democratic processes. A model API or agent framework is not inherently high-risk—risk attaches to the *use case* deployed. However, a provider that supplies a general-purpose AI model which is later integrated into a high-risk system acquires downstream obligations under Article 28, including cooperation with deployers and documentation sufficient for the deployer to meet its own conformity assessment requirements.

For tooling buyers, this creates a documentation dependency chain. If a startup uses OpenAI’s GPT-4o (gpt-4o-2024-08-06) via API to score job applicants against a rubric, the system likely qualifies as high-risk under the employment category. The deployer must then obtain from OpenAI the technical documentation specified in Annex IV and Annex XI—model architecture, training data provenance, known limitations, and performance metrics on relevant benchmarks. As of June 2025, OpenAI provides a Model Spec and system card dated November 2024, but does not yet offer a self-contained Annex IV compliance pack downloadable from the API dashboard. Buyers must request documentation through enterprise support channels, typically with a 5–10 business day turnaround. Anthropic ships Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) with a publicly posted model card that maps more directly to Annex IV categories, including detailed evaluations on bias benchmarks and a stated policy on prohibited use cases. For teams that need auditable compliance evidence without enterprise negotiation, this difference is material.

### General-Purpose AI Model Obligations

Chapter V (Articles 51–56) imposes a tiered regime on general-purpose AI (GPAI) models. All GPAI model providers must prepare and keep up-to-date technical documentation, publish a summary of training content, and implement a policy to respect EU copyright law. Providers of GPAI models classified as presenting “systemic risk”—those trained with cumulative compute exceeding 10^25 FLOPs—face additional obligations including model evaluation, adversarial testing, and incident reporting to the AI Office.

The compute threshold captures current frontier models. GPT-4o and Claude 3.5 Sonnet both exceed 10^25 FLOPs by public estimates. Google’s Gemini 1.5 Pro (gemini-1.5-pro-002, released September 2024) also crosses the threshold. Smaller or older models—Mistral Large 2 (mistral-large-2407, July 2024), Meta’s Llama 3.1 70B—fall below it and face only the baseline obligations. For a founder choosing between API providers, the systemic-risk designation means the provider must offer free model evaluation access to the AI Office and report serious incidents. It does not impose direct obligations on the downstream deployer, but it does affect the availability of evaluation data. Providers subject to systemic-risk rules produce more public evaluation artifacts, which in turn simplify a deployer’s own conformity documentation. This creates a practical advantage for regulated deployers: selecting a systemic-risk-classified model may reduce the compliance evidence burden because the provider has already generated and published the relevant safety and performance data.

### Territorial Scope and Non-EU Tooling Providers

Article 2 establishes that the Act applies to providers placing AI systems on the EU market regardless of where they are established, and to deployers located in the EU. It also applies to providers and deployers outside the EU where the output of the system is used in the EU. For a Singapore-based startup using OpenAI’s US-hosted API to serve EU customers, the Act applies. For a US-based developer using a vector database hosted in AWS eu-west-1 to support an EU-facing RAG application, the Act applies to the deployer and may impose obligations on the vector database provider if the database is considered part of an AI system placed on the EU market.

The practical effect on tooling procurement is that EU-based or EU-serving teams now require Data Processing Agreements (DPAs) that reference the AI Act alongside GDPR, and many are adding AI Act compliance representations to vendor due diligence questionnaires. Vendors that cannot produce a written policy addressing GPAI obligations or high-risk system documentation are being deselected in regulated procurement processes. This trend accelerated in Q2 2025, particularly in financial services and HR tech, where internal compliance teams have begun enforcing AI Act readiness as a vendor gate.

## Model API Providers: Compliance Posture and Pricing Impact

The three largest commercial API providers—OpenAI, Anthropic, and Google DeepMind—have adopted different approaches to AI Act compliance, with measurable effects on documentation availability, API features, and pricing.

### OpenAI: Enterprise Documentation and Audit Logging

OpenAI’s GPT-4o API (gpt-4o-2024-08-06) pricing remains $2.50 per 1M input tokens and $10.00 per 1M output tokens as of June 2025, unchanged since launch. The company has not introduced an AI Act compliance surcharge or a dedicated compliance tier. Instead, it has expanded the audit logging available through the API dashboard and added a “Compliance Exports” feature in beta for enterprise-tier accounts ($60,000 annual commit minimum). This feature generates timestamped logs of model version, prompt, completion, and safety filter activations in a format designed to support conformity assessment documentation under Annex IV.

OpenAI published a regulatory white paper in February 2025 outlining its interpretation of GPAI obligations, but has not released the full training data summary required by Article 53(1)(d). The company’s position, stated in an 18 February 2025 blog post, is that the training data summary obligation is subject to trade secret protections and that the AI Office has not yet issued final guidance on the required level of detail. For deployers of high-risk systems, this creates a gap: the deployer needs sufficient information about training data to assess bias and performance limitations, but the provider has not yet furnished it in a standardised format. Until the AI Office publishes the Code of Practice for GPAI models—expected Q3 2025—this gap persists.

### Anthropic: Model Card as Compliance Artifact

Anthropic’s approach with Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) is to treat its public model card as the primary compliance artifact. The model card, updated 22 October 2024, includes quantitative evaluations on bias benchmarks (BBQ, WinoGender), truthfulness (TruthfulQA), and harmfulness (HarmBench), along with stated limitations and recommended mitigation measures. For a deployer assembling an Annex IV technical documentation package, the Anthropic model card covers more of the required elements than OpenAI’s current public documentation.

Claude 3.5 Sonnet API pricing is $3.00 per 1M input tokens and $15.00 per 1M output tokens as of June 2025. Anthropic has not introduced compliance-specific pricing. The company offers a “Trust & Safety” API endpoint in beta that returns safety classification metadata for a given prompt-completion pair, which deployers can log as evidence of runtime monitoring—a requirement under Article 29 for high-risk system deployers. Access to this endpoint requires an enterprise agreement with a $30,000 annual commit.

### Google DeepMind: Vertex AI Compliance Controls

Google’s Gemini 1.5 Pro (gemini-1.5-pro-002) is available through Vertex AI with pricing of $1.25 per 1M input tokens (up to 128K context) and $5.00 per 1M output tokens (up to 128K context) as of June 2025. Vertex AI includes several features that map directly to AI Act obligations: data residency controls that allow deployers to restrict processing to EU data centers (eu-west1, eu-west4), customer-managed encryption keys for training data at rest, and an audit log export to Cloud Logging that captures model version, input/output tokens, and safety filter decisions with timestamps.

Google published a GPAI compliance paper on 10 January 2025 detailing its approach to the systemic-risk obligations, including model evaluation results against internal safety benchmarks and a description of its incident reporting process. For deployers, the Vertex AI compliance controls reduce the engineering effort required to implement Article 29’s requirement for automatic recording of events during the system’s operation. The trade-off is vendor lock-in: the audit log format is specific to Google Cloud Logging, and migrating logs to another provider’s format requires custom ETL pipelines.

## Development Frameworks and the Compliance Engineering Burden

AI development frameworks—LangChain, LlamaIndex, Haystack, and the major cloud AI SDKs—are not directly regulated as AI systems under the Act. They are general-purpose software libraries. However, the systems built with them can be high-risk, and the framework’s design choices affect how easily a team can produce compliance evidence.

### LangChain and LangSmith: Tracing as Audit Trail

LangChain (langchain 0.3.x, current stable as of June 2025) and its observability platform LangSmith provide tracing capabilities that capture the full chain of model calls, tool invocations, and retrieval steps for each inference. LangSmith traces include timestamps, model version identifiers, token counts, and latency measurements. For a deployer implementing Article 29’s logging requirement, LangSmith traces can serve as the automatic recording mechanism if the trace data is exported to a durable, tamper-evident store.

LangSmith pricing as of June 2025 is $39 per seat per month for the Plus tier, which includes 30-day trace retention. The Enterprise tier ($89 per seat per month) adds SSO, RBAC, and 365-day retention. Neither tier includes compliance-specific features like immutability guarantees or cryptographic trace signing. Teams building high-risk systems typically export LangSmith traces to an external immutable store—AWS S3 with Object Lock, or GCP Cloud Storage with bucket lock—at an additional cost of approximately $0.02–$0.05 per GB per month depending on the cloud provider and region. This architecture satisfies the logging requirement but requires custom integration work estimated at 2–3 engineering weeks for a production-grade pipeline.

### LlamaIndex and Haystack: Documentation Gaps

LlamaIndex (v0.11.x) and Haystack (2.x) provide fewer built-in observability primitives than LangChain+LangSmith. Both frameworks can integrate with third-party observability tools—Arize, Weights & Biases, MLflow—but the integration is not pre-configured for AI Act compliance logging. A team using LlamaIndex to build a high-risk RAG system must design the logging architecture from scratch, capturing not only model inputs and outputs but also the retrieved documents, their provenance, and any re-ranking decisions. This increases the compliance engineering burden relative to using a framework with integrated tracing.

The practical implication for framework selection in mid-2025 is that LangChain+LangSmith reduces the time-to-compliance-evidence for high-risk systems by an estimated 40–60% compared to LlamaIndex or Haystack, based on conversations with three engineering teams who have gone through AI Act conformity assessment preparation. The trade-off is cost: a 10-person engineering team using LangSmith Enterprise pays $890 per month for observability, plus cloud storage costs for exported traces. Teams using LlamaIndex with a self-managed MLflow instance pay only infrastructure costs but invest more engineering time in compliance plumbing.

## Agent Platforms: Autonomy and the High-Risk Boundary

Agent platforms—AutoGPT, CrewAI, Microsoft’s AutoGen, and the newly released OpenAI Agents SDK—raise a specific compliance question: at what point does an agent’s autonomy make the system high-risk under the Act?

### The Autonomy-Risk Gradient

The Act does not define a specific autonomy threshold. Recital 27 notes that AI systems vary in their “levels of autonomy,” and the high-risk classification depends on the system’s intended purpose and the significance of its outputs for human decision-making. An agent that autonomously schedules meetings based on email content is unlikely to be high-risk. An agent that autonomously approves loan applications or triages patient symptoms likely is.

For platform selection, the relevant factor is whether the platform provides controls to limit autonomy in ways that keep the system below the high-risk threshold or, if the system is high-risk, to implement the required human oversight mechanisms under Article 14. CrewAI (v0.30.x, June 2025) includes a “human-in-the-loop” mode that requires explicit approval before an agent executes a tool call classified as high-impact. This mode generates an approval log that can serve as evidence of human oversight. AutoGPT (v0.5.x) provides similar functionality through a “consent” mechanism but does not generate structured audit logs by default. Microsoft’s AutoGen (v0.4.x) leaves human-in-the-loop implementation to the developer, providing building blocks but no pre-built oversight logging.

### OpenAI Agents SDK: Compliance-Aware Design

OpenAI released the Agents SDK (openai-agents 0.1.0) on 11 March 2025. The SDK includes a `RunConfig` object with a `trace_metadata` field that automatically captures agent steps, tool calls, model invocations, and guardrail activations. It also includes a `GuardrailOutput` object that records safety checks applied to agent outputs. For deployers of high-risk agent systems, these primitives reduce the engineering effort to implement Article 29 logging and Article 14 human oversight.

The Agents SDK is free to use; costs are driven by the underlying model API calls. For a deployment using GPT-4o with an agent that makes an average of 5 model calls per user interaction, the per-interaction cost is approximately $0.05–$0.10 in API fees. The compliance benefit is that the SDK’s trace format is designed to map to the AI Act’s logging requirements, reducing the custom engineering needed to produce auditable records.

## Vector Databases and Retrieval-Augmented Generation

Vector databases underpin most RAG systems, which are increasingly deployed in high-risk contexts—legal research, medical literature retrieval, financial document analysis. The Act does not regulate databases directly, but the retrieval component of a high-risk AI system falls within the system’s scope, and the data governance requirements of Article 10 apply to the training, validation, and testing data, which in a RAG context includes the documents stored in the vector database.

### Data Governance and Provenance

Article 10 requires that training, validation, and testing data be subject to appropriate data governance, including examination for biases and gaps. For a RAG system, the vector database is not training data in the traditional sense, but the documents it contains directly influence system outputs. The emerging best practice, reflected in guidance published by the European Commission’s AI Office on 15 March 2025, is to treat the document corpus as subject to data governance requirements analogous to those for training data. This means deployers must document the provenance of documents in the vector store, assess them for biases, and maintain versioned snapshots for audit purposes.

Pinecone (serverless, as of June 2025) provides collection versioning through its `create_collection` API, which snapshots an index at a point in time. Pricing for serverless indexes is $0.33 per GB per month for storage and $0.025 per 1M read units. Weaviate (v1.26.x) offers multi-tenancy with per-tenant data isolation and backup to cloud object storage, with cloud pricing starting at $0.50 per GB per month for storage. Qdrant (v1.10.x) provides snapshot-based backup and point-in-time recovery, with cloud pricing at $0.40 per GB per month. For compliance purposes, the key feature is the ability to produce a timestamped, versioned snapshot of the exact document corpus that was in use at the time of a given inference—this is what an auditor will request. All three databases support this, but the workflow for associating a snapshot ID with a specific inference trace must be built by the deployer.

### Embedding Model Transparency

The embedding model used to vectorize documents is part of the AI system and its choice affects compliance. If the embedding model is a general-purpose AI model, the deployer needs documentation about its training data and limitations. OpenAI’s text-embedding-3-large (released January 2024, $0.00013 per 1K tokens) ships with a model card that describes the training data at a high level but does not provide the detailed provenance information that a high-risk system deployer might need. Cohere’s embed-multilingual-v3.0 ($0.00010 per 1K tokens) provides a more detailed data statement. Voyage AI’s voyage-large-2 ($0.00012 per 1K tokens) includes a training data audit document on request for enterprise customers.

For teams building high-risk RAG systems, the embedding model choice now includes a compliance dimension: can the provider supply sufficient documentation about training data to satisfy Article 10? If not, the deployer may need to use an open-weight embedding model where training data is documented—such as intfloat/multilingual-e5-large—or commission an independent audit of the embedding model’s bias characteristics, at a cost of $15,000–$50,000 depending on scope.

## What Tooling Buyers Should Do Now

The AI Act is enforceable, and procurement decisions made in mid-2025 will determine compliance posture for the next 12–24 months. Five specific actions for tooling buyers:

First, classify your use case before selecting tools. If the system falls under Annex III high-risk categories or is a safety component of a regulated product, the documentation requirements cascade through every component in the stack. Select API providers and frameworks that can produce Annex IV-compatible documentation without enterprise-negotiation friction.

Second, prefer model providers that publish detailed model cards mapped to regulatory categories. As of June 2025, Anthropic’s Claude 3.5 Sonnet model card and Google’s Vertex AI compliance paper are the most complete publicly available artifacts. OpenAI’s documentation is improving but still requires enterprise-channel requests for full compliance packs.

Third, budget for compliance engineering. Implementing Article 29 logging and Article 14 human oversight for a high-risk system typically adds 4–8 engineering weeks to a project timeline, based on teams that have completed the process. Frameworks with integrated tracing (LangChain+LangSmith, OpenAI Agents SDK) reduce this by roughly half.

Fourth, treat your vector database document corpus as governed data. Implement versioned snapshots, document provenance tracking, and bias assessment procedures. The AI Office’s March 2025 guidance makes clear that RAG document stores are in scope for data governance.

Fifth, monitor the GPAI Code of Practice expected in Q3 2025. The Code will clarify the level of detail required in training data summaries and may shift the compliance posture of major API providers. Procurement contracts signed now should include clauses requiring the provider to update documentation to meet the final Code of Practice within 90 days of its publication.
