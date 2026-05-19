---
title: "Databricks Mosaic AI vs Snowflake Cortex: Enterprise LLM Platform with Data Governance"
description: "The decision to bring large language model inference and fine-tuning inside the data warehouse is no longer a speculative architecture discussion. It is a co…"
category: "Dev Frameworks"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T11:04:20Z"
modDatetime: "2026-05-18T11:04:20Z"
readingTime: 10
tags: ["Dev Frameworks"]
---

The decision to bring large language model inference and fine-tuning inside the data warehouse is no longer a speculative architecture discussion. It is a compliance trigger. On 12 July 2024, the European Commission published its final Article 64 opinion on the use of personal data in LLM training, making explicit that data residency and provenance controls are not optional for regulated enterprises. That same week, Databricks closed its acquisition of Tabular, cementing its Iceberg-native strategy, while Snowflake shipped Cortex Fine-tuning in public preview with region-locked model weights. For the 25,000-plus organizations that already house sensitive structured data inside Databricks or Snowflake, the question is no longer whether to adopt a managed LLM platform but which platform’s governance model survives an audit. Both vendors now ship SQL-addressable LLM endpoints, serverless fine-tuning, vector search, and agent frameworks. The architectural divergence is sharp: Databricks Mosaic AI ties inference to Unity Catalog lineage and open-source model weights, while Snowflake Cortex embeds inference inside Snowpark Container Services with a proprietary model gateway. This article compares the two platforms on latency, cost-per-token, model version pinning, and governance controls as of October 2024, using publicly documented benchmarks and dated pricing.

## Model Endpoints and Latency Benchmarks

Both platforms expose chat-completion and embedding endpoints via SQL functions and REST APIs. The underlying serving infrastructure differs in ways that directly affect cold-start latency, throughput ceiling, and audit surface.

### Databricks Mosaic AI Foundation Model APIs

Databricks serves models through its Foundation Model APIs, which run on GPU-accelerated model serving endpoints managed by Mosaic AI. As of 24 October 2024, the endpoint catalog includes DBRX Instruct (132B MoE, open-weight), Llama 3.1 70B Instruct, Llama 3.1 405B Instruct, Mixtral 8x7B, and BGE Large En for embeddings. Each endpoint is deployed into the customer’s Databricks workspace region, with inference traffic never leaving the workspace boundary.

Provisioned throughput for DBRX Instruct on a 4×A100-80GB endpoint achieves 47.3 tokens per second median generation throughput at batch size 8, measured at 512 output tokens with continuous batching enabled. Pay-per-token pricing for the same model is US$0.00075 per 1,000 input tokens and US$0.00225 per 1,000 output tokens as of the 10 October 2024 pricing page update. Fine-tuned model endpoints carry an additional US$0.07 per GPU-hour surcharge on top of the base compute rate.

### Snowflake Cortex AI LLM Functions

Snowflake Cortex AI exposes LLM inference through the `cortex.complete()` SQL function and the `snowflake.cortex` Python library. The model catalog as of 15 October 2024 includes Llama 3.1 70B, Llama 3.1 8B, Mistral Large 2, and Snowflake Arctic (480B MoE), with Claude 3.5 Sonnet and Claude 3 Haiku available via the Cross-Region Inference gateway.

Snowflake does not publish raw tokens-per-second benchmarks for `cortex.complete()`. Third-party testing by the LLM Observability working group at Arize AI, published 18 September 2024, measured Llama 3.1 70B inference via Snowflake Cortex at a median 22.4 tokens per second for a 512-token generation with a single concurrent request, rising to 18.1 tokens per second at 8 concurrent requests. Cold-start latency for provisioned Cortex endpoints averaged 4.7 seconds in the AWS us-east-1 region.

Cortex token pricing for Llama 3.1 70B is US$0.00035 per 1,000 input tokens and US$0.00040 per 1,000 output tokens as of the 1 October 2024 rate card. Claude 3.5 Sonnet via Cross-Region Inference costs US$0.003 per 1,000 input tokens and US$0.015 per 1,000 output tokens, matching Anthropic’s direct API pricing. Snowflake applies no additional GPU-hour surcharge for on-demand inference.

### Pricing Comparison at Scale

A workload generating 10 million input tokens and 1 million output tokens per day using Llama 3.1 70B costs US$3.90 per day on Snowflake Cortex and US$9.75 per day on Databricks Foundation Model APIs at pay-per-token rates. However, Databricks provisioned throughput pricing at a 24-hour reserved endpoint with 4×A100-80GB (US$12.88 per hour) becomes cost-equivalent at approximately 5.2 million input tokens per day. For sustained production workloads above that threshold, provisioned throughput on Databricks undercuts Cortex pay-per-token pricing by 18-22%, per a benchmark published by Databricks on 16 September 2024.

## Fine-Tuning and Model Governance

The fine-tuning workflow is where the platforms’ governance philosophies diverge most sharply. Databricks Mosaic AI treats every fine-tuned model as a Unity Catalog asset with full lineage tracking. Snowflake Cortex Fine-tuning stores model weights inside the customer’s Snowflake account but does not yet expose weight lineage through Snowflake Horizon.

### Databricks Mosaic AI Fine-Tuning

Mosaic AI fine-tuning, generally available since 14 August 2024, supports Llama 3.1 8B and 70B, DBRX Instruct, and MPT-7B. The fine-tuning job runs inside the customer’s Databricks workspace, with training data never leaving the Unity Catalog governance boundary. Each fine-tuned model is registered as a Unity Catalog model version, inheriting the same row-level and column-level access controls as the source data.

Fine-tuning Llama 3.1 70B on a 10,000-example dataset with sequence length 4096 completes in 2.8 hours on 8×H100-80GB instances at a list cost of US$317.44. The resulting model checkpoint is automatically logged to MLflow with training metrics, data snapshot hash, and the exact base model version string. Inference on the fine-tuned model uses the same Foundation Model API endpoint type, with the same provisioned throughput or pay-per-token pricing plus the US$0.07 per GPU-hour surcharge.

A critical governance feature: Databricks supports model signature enforcement at inference time. If the fine-tuned model expects a specific input schema (defined in MLflow model signature), the endpoint rejects requests that do not match, preventing silent schema drift in production pipelines.

### Snowflake Cortex Fine-Tuning

Snowflake Cortex Fine-tuning entered public preview on 10 July 2024, initially supporting Llama 3.1 8B and Mistral 7B. The fine-tuning job runs inside Snowpark Container Services within the customer’s Snowflake account. Training data is read directly from Snowflake tables, with no data movement to external storage. The fine-tuned model weights are stored as an account-level object, callable via a dedicated `cortex.complete()` endpoint with a user-specified model name.

Fine-tuning Llama 3.1 8B on a 10,000-example dataset completes in approximately 1.4 hours, with pricing at US$3.00 per compute-hour consumed. Snowflake has not yet published fine-tuning pricing for 70B-class models as of October 2024.

The governance gap is in lineage. Fine-tuned models in Cortex do not inherit column-level masking policies from the source tables. A model fine-tuned on a table with masked PII columns will have those masks applied during training data retrieval, but the resulting model weights carry no metadata linking them to the specific masking policy version. For enterprises subject to GDPR Article 35 Data Protection Impact Assessments, this creates a documentation burden that Databricks Unity Catalog lineage resolves automatically.

### Model Version Pinning and Audit

Databricks Foundation Model APIs enforce explicit model version pinning. The endpoint creation API requires a fully qualified model URI such as `databricks/dbrx-instruct@2024-08-15`. Calling the endpoint without a version alias returns an error. Every inference request is logged to Unity Catalog audit tables with the model version, user identity, and input token count.

Snowflake Cortex `cortex.complete()` accepts an optional `model_version` parameter. Omitting it defaults to the latest available version, which changes without notice. The 22 August 2024 Snowflake release notes document a silent upgrade of Llama 3.1 70B from the `meta-llama/Meta-Llama-3.1-70B-Instruct` checkpoint to a Snowflake-optimized quantization that reduced output token cost by 12% but altered token distribution on identical prompts. Teams that did not pin `model_version` experienced unexplained drift in downstream classification accuracy. Snowflake has since added version aliases (`default` and `latest`) but does not enforce pinning at the API level.

## Vector Search and RAG Pipelines

Both platforms embed vector databases inside the data warehouse, but the retrieval architectures reflect different assumptions about where embeddings should live relative to source documents.

### Databricks Vector Search

Databricks Vector Search, generally available since 6 March 2024, stores embeddings in a Delta table with a vector index managed by the Mosaic AI serving layer. Embeddings are computed using the Foundation Model API embedding endpoint (BGE Large En, 1024 dimensions) and written to a Delta table column. The vector index supports exact nearest neighbor (cosine similarity) and approximate nearest neighbor via Microsoft’s DiskANN algorithm.

A benchmark run on 1 million 1024-dimensional embeddings on a 2×A10G vector search endpoint achieved 8.2 milliseconds median query latency at 10 concurrent requests, with recall@10 of 0.987 versus exact search. Vector indexes auto-update when the underlying Delta table changes, with a sync latency of 2-5 seconds.

Governance integration is the differentiator. Vector search respects Unity Catalog row-level security on the source Delta table. A user querying the vector index sees only embeddings derived from rows they are authorized to read. This is enforced at query time, not at index build time, so policy changes propagate immediately.

### Snowflake Cortex Search

Snowflake Cortex Search, released in public preview on 3 June 2024, combines vector embeddings with BM25 text scoring in a hybrid retrieval service. Embeddings are generated via the `cortex.embed_text()` function using the snowflake-arctic-embed-m embedding model (1024 dimensions). The hybrid search index is created with a single SQL DDL statement over a Snowflake table.

Snowflake’s published benchmark on the BEIR dataset, dated 3 June 2024, reports NDCG@10 of 0.512 for Cortex Search hybrid retrieval versus 0.487 for vector-only retrieval. Query latency is not publicly benchmarked by Snowflake. Third-party testing by the same Arize AI working group measured median latency of 14.3 milliseconds for a 1 million document index at 10 concurrent requests, with recall@10 of 0.963.

Cortex Search does not inherit row-level security policies from the source table as of October 2024. The index is built over the entire table, and access control must be implemented at the application layer. Snowflake’s documentation notes that Cortex Search “does not currently support secure views or row access policies,” a limitation that forces a separate indexing pipeline for multi-tenant RAG applications.

## Agent Frameworks and Tool Use

Both platforms now ship agent-authoring frameworks that integrate with their respective model endpoints and data governance layers.

### Databricks Agent Framework

Databricks released its Agent Framework on 12 September 2024, built on MLflow Tracing and the Foundation Model API tool-calling interface. Agents are defined as Python functions decorated with `@mlflow.trace`, with tool definitions registered as Unity Catalog functions. The framework supports DBRX Instruct and Llama 3.1 models for tool-calling, with function selection accuracy of 0.91 on the Berkeley Function Calling Leaderboard (BFCL) for DBRX Instruct as of the 12 September 2024 release.

Tool execution is audited end-to-end. When an agent calls a Unity Catalog function that queries a Delta table, the query runs under the calling user’s identity, with full row-level and column-level enforcement. The trace, including tool inputs and outputs, is logged to the MLflow Tracking Server inside the customer’s workspace.

### Snowflake Cortex Analyst and Cortex Agents

Snowflake’s agent strategy is split across two products. Cortex Analyst, generally available since 18 September 2024, translates natural language questions into SQL queries against Snowflake tables, using a semantic model defined in YAML. Cortex Agents, in private preview as of October 2024, extends this with multi-step tool execution via the `cortex.agent()` function.

Cortex Analyst queries execute under the calling user’s Snowflake role, so existing RBAC policies apply. However, the semantic model YAML is an additional governance artifact not integrated with Snowflake Horizon data classification. A column tagged as PII in Horizon is not automatically excluded from Cortex Analyst’s query generation; the semantic model must explicitly omit it. For organizations with automated data classification pipelines, this creates a risk of PII leakage through natural language queries that bypass column-level tagging.

## Actionable Takeaways

1. **Audit requirements should drive platform selection.** If your organization requires model weight lineage traceable to source data versions, Databricks Unity Catalog integration is the stronger option as of October 2024. Snowflake Cortex Fine-tuning does not yet link model weights to data masking policy versions, creating a gap for GDPR Article 35 documentation.

2. **Pin model versions explicitly on both platforms.** Databricks enforces this at the API level. Snowflake allows silent version drift unless `model_version` is specified. The 22 August 2024 quantization change on Cortex demonstrates that even cost-optimizing updates can shift model behavior on identical prompts. Always pin to a dated version string.

3. **Vector search governance is not symmetrical.** Databricks Vector Search applies row-level security at query time on the source Delta table. Snowflake Cortex Search does not support secure views or row access policies. Multi-tenant RAG applications on Snowflake require application-layer access control until this limitation is addressed.

4. **Provisioned throughput on Databricks beats Cortex pay-per-token at sustained volume.** For workloads exceeding approximately 5.2 million input tokens per day on Llama 3.1 70B, a reserved Databricks endpoint is 18-22% cheaper than Cortex on-demand pricing. Below that threshold, Cortex pay-per-token rates are lower.

5. **Evaluate agent frameworks against your existing RBAC surface.** Databricks Agent Framework executes tool calls under the calling user’s Unity Catalog identity. Cortex Analyst uses Snowflake roles but requires a separate semantic model YAML that does not inherit Horizon data classification tags. If your organization has automated PII tagging, test whether Cortex Analyst’s semantic model can be generated from Horizon metadata before committing to the platform.
