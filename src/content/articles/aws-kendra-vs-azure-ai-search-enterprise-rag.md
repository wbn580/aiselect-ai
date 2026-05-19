---
title: "AWS Kendra vs Azure AI Search: Enterprise RAG Solution Comparison with GDPR Compliance"
description: "When the European Data Protection Board published its final guidelines on the interplay between the AI Act and GDPR in late 2024, enterprise architects acros…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:54:04Z"
modDatetime: "2026-05-18T10:54:04Z"
readingTime: 12
tags: ["Vector Databases"]
---

When the European Data Protection Board published its final guidelines on the interplay between the AI Act and GDPR in late 2024, enterprise architects across Frankfurt and Paris quietly shelved their US-centric RAG architectures. The guidelines made explicit what many had feared: retrieval-augmented generation pipelines handling employee or customer data would face joint scrutiny under both regulatory frameworks, with fines potentially stacking to 4% of global annual turnover under GDPR plus an additional €35 million under the AI Act. For teams running production RAG workloads, the choice of search backend stopped being a purely technical decision around latency and recall. It became a compliance posture.

AWS Kendra and Azure AI Search sit at the center of this recalibration. Both services now position themselves as enterprise-grade retrieval layers for generative AI, yet they approach the regulatory surface area differently. Kendra, launched in 2020 and substantially reworked through 2023, operates as a managed intelligent search service with native connectors to SharePoint, Confluence, ServiceNow, and S3. Azure AI Search, rebranded from Azure Cognitive Search in November 2023, functions as a vector-capable search platform that integrates directly with Azure OpenAI Service and Microsoft’s compliance infrastructure. The comparison matters because choosing one locks an organization into a specific data residency model, encryption key management regime, and audit trail architecture—all of which surface during a GDPR Article 35 Data Protection Impact Assessment.

This comparison evaluates both services as of February 2025, using publicly documented pricing, benchmark data from both vendors’ technical documentation, and the regulatory filings available through the EU AI Act portal. No synthetic benchmarks, no vendor-provided marketing numbers without provenance.

## Architecture and Retrieval Mechanics

The underlying retrieval architectures diverge in ways that directly affect latency profiles, cost predictability, and the complexity of maintaining relevance at scale.

### Indexing and Document Processing

AWS Kendra employs a proprietary deep-learning document understanding pipeline that extracts text, tables, and structured entities from 30+ document formats including PDF, HTML, XML, and Microsoft Office files. As of the Kendra Developer Guide update on 12 November 2024, the service supports incremental indexing with change detection via S3 event notifications, SharePoint webhooks, and database change data capture connectors. Document enrichment runs as a managed step—there is no customer-managed compute for text extraction.

Azure AI Search provides document cracking through built-in indexers that pull from Azure Blob Storage, Azure SQL Database, Cosmos DB, and—through a preview connector documented on 15 January 2025—SharePoint Online. The indexer architecture exposes skillsets: composable enrichment pipelines that can call Azure AI Services for OCR, entity recognition, and key phrase extraction. This modularity gives teams control over which enrichment steps run and at what cost, but it also means that a misconfigured skillset can silently degrade retrieval quality without surfacing obvious errors.

A practical difference emerges in table extraction. Kendra’s document understanding model explicitly targets table structures and preserves row-column relationships in its index, which matters for financial documents and regulatory filings. Azure AI Search relies on the skillset’s OCR and layout analysis components, which require explicit configuration to handle merged cells and multi-page tables correctly.

### Vector Search and Hybrid Retrieval

Both services now support vector search with hybrid retrieval combining keyword and semantic ranking. The implementation details matter for GDPR compliance because they determine what metadata travels with each query.

Kendra added vector support in August 2023 through its Semantic Search capability, which generates embeddings using Amazon Titan Embeddings G1 by default. Queries can specify `QueryResultTypeFilter` to return only semantic results, only keyword results, or a combined ranking. The embedding dimension is fixed at 1,536 for Titan G1. Kendra stores vectors alongside the managed index; customers do not provision separate vector database capacity.

Azure AI Search introduced vector search in general availability on 18 October 2023, with support for any embedding model that produces vectors up to 2,048 dimensions. The service stores vectors in a specialized vector index within the search service, with cosine similarity, Euclidean distance, and dot product as configurable distance metrics. Hybrid search runs through Reciprocal Rank Fusion, combining BM25 keyword scores with vector similarity scores at query time. The November 2024 update to API version 2024-11-01 added vector quantization for reduced storage costs, compressing float32 vectors to int8 with documented recall loss of less than 0.5% on the MTEB retrieval benchmark.

For teams evaluating GDPR exposure, the vector storage architecture carries implications. Kendra’s opaque vector store means embeddings exist only within the managed service boundary. Azure AI Search stores vectors in customer-provisioned indexes, which means vectors fall within the customer’s data residency configuration and are subject to the same encryption key management as the rest of the index.

### Query Processing and Relevance Tuning

Kendra exposes relevance tuning through query suggestions, custom synonyms via a thesaurus file uploaded per index, and user context filtering based on access control lists ingested from source systems. The ACL-aware filtering enforces document-level security by matching user tokens against indexed permissions—a feature that maps directly to GDPR’s data minimization requirement because it prevents a query from surfacing documents the requesting user lacks authorization to see.

Azure AI Search provides semantic ranking through a deep-learning model hosted by Microsoft, invoked via the `semanticConfiguration` parameter. As documented in the 2024-12-01 REST API reference, semantic ranking re-ranks the top 50 BM25 or vector results using a transformer model that scores semantic relevance. The service also supports scoring profiles that weight specific fields (recency, document type, authoritativeness) using functions like `freshness`, `magnitude`, and `tag`. For regulated environments, Azure’s session-level diagnostic logging captures every query, its ranked results, and the semantic score for audit purposes—logs that can stream to Azure Monitor and retain for the duration specified in a GDPR retention policy.

## Pricing and Total Cost of Ownership

Both services use consumption-based pricing with dimensions that make direct comparison non-trivial. The following figures reflect published pricing as of February 2025 in the EU (Frankfurt) region.

### AWS Kendra Pricing Structure

Kendra pricing has two tiers. The Developer Edition costs $1.125 per hour ($810 per month) with a limit of 4,000 queries per day and 10,000 documents. The Enterprise Edition costs $1.40 per hour ($1,008 per month) for the base infrastructure, which supports up to 100,000 documents. Beyond that, document storage costs $0.35 per 1,000 documents per month. Queries incur a separate charge: $0.025 per 1,000 queries for the first 100,000 queries per day, dropping to $0.015 per 1,000 queries above that threshold. Connector usage adds $0.35 per 1,000 documents synced per connector run.

For a production RAG deployment indexing 500,000 documents and handling 200,000 queries per day, the monthly cost calculates to: $1,008 base + ($0.35 × 400) = $140 for documents + (200 × $0.025 × 30) = $150 for queries, totaling approximately $1,298 per month. This excludes data transfer costs and any S3 storage for source documents.

### Azure AI Search Pricing Structure

Azure AI Search uses search units (SUs) as the capacity metric. A Standard S2 instance provides 200 SUs at $972.32 per month in the West Europe region, supporting approximately 120 queries per second at typical vector search latency. Storage costs $0.085 per GB per month for the index storage. Semantic ranking, invoked per query, costs $0.003 per semantic query for the first 1 million queries monthly, then $0.0025 beyond that. AI enrichment through skillsets incurs separate Azure AI Services charges, typically $0.001 per text extraction and $0.0025 per entity recognition call.

For an equivalent workload—500,000 documents averaging 50 KB each (25 GB of index storage) and 200,000 queries per day with semantic ranking enabled on 30% of queries—the monthly cost calculates to: $972.32 for S2 + ($0.085 × 25) = $2.13 for storage + (60,000 × $0.003 × 30) = $5,400 for semantic ranking, totaling approximately $6,374 per month. The semantic ranking cost dominates at high query volumes. Disabling semantic ranking and relying on pure vector or BM25 retrieval drops the total to roughly $974 per month, making Azure the lower-cost option for basic retrieval but significantly more expensive when semantic re-ranking is active.

### Cost Predictability and Compliance Overhead

Kendra’s pricing includes document understanding and enrichment in the base cost. Azure AI Search unbundles enrichment, which provides cost transparency but creates variability when document volumes fluctuate. For GDPR-governed deployments where every document processing step must be logged and attributable, the unbundled model simplifies demonstrating that only necessary processing occurred—a requirement under the data minimization principle.

## GDPR Compliance and Data Residency

This section examines the specific compliance capabilities that surface during a Data Protection Impact Assessment, drawing from both vendors’ documentation and the EDPB guidelines published 17 December 2024.

### Data Residency and Regional Deployment

AWS Kendra is available in 10 AWS regions as of February 2025, including EU (Frankfurt, Ireland, London) and Asia Pacific (Singapore, Sydney, Tokyo). When deployed in eu-central-1, all document processing, index storage, and query handling remain within the Frankfurt data center. AWS’s Data Processing Addendum, last updated 15 August 2024, includes Standard Contractual Clauses for data transfers. Kendra supports AWS Key Management Service with customer-managed keys for index encryption, allowing organizations to maintain control over encryption key rotation and revocation—a capability that directly addresses GDPR Article 32 security requirements.

Azure AI Search is available in 35+ regions, including all Azure European regions (West Europe, North Europe, France Central, Germany West Central, Switzerland North). The November 2024 service update added availability in the Azure EU Sovereign Cloud for government customers. Azure’s compliance documentation lists over 100 compliance certifications, including ISO 27001, SOC 2, and the EU Model Clauses. Customer-managed encryption keys through Azure Key Vault are supported, with double encryption (infrastructure-level plus application-level) available on premium tiers.

### Audit Logging and Right to Access

GDPR Article 15 grants data subjects the right to access personal data and information about processing activities. For RAG systems, this translates to the ability to trace which documents contributed to a given generated response and to produce logs showing who accessed what data.

Kendra provides query logging through AWS CloudTrail, which captures API calls including `Query`, `SubmitFeedback`, and `BatchGetDocument`. The `QueryResultItem` response includes a `DocumentURI` field that identifies the source document. Combined with CloudTrail’s user identity tracking, this creates an audit trail linking a specific authenticated user to specific retrieved documents at a specific timestamp. Kendra does not natively log the generated LLM response—that logging falls to the application layer calling Amazon Bedrock or SageMaker.

Azure AI Search provides diagnostic logging that captures every search request with its full query text, the returned document keys, the relevance scores, and the semantic ranking metadata. When integrated with Azure OpenAI Service, the `apim-request-id` header links the retrieval step to the generation step in Application Insights, creating end-to-end traceability from user prompt to generated response to source documents. This end-to-end trace is documented in Microsoft’s “Monitoring Azure OpenAI Service” guidance, updated 5 December 2024.

### Data Subject Rights and Deletion

Both services support document deletion from the index, but the deletion propagation time matters for GDPR’s requirement to erase personal data “without undue delay.”

Kendra’s `BatchDeleteDocument` API removes documents from the index within 1-2 seconds for the search results, with the underlying storage reclamation completing within 24 hours. The data source sync process respects deletions at the source; removing a document from the source S3 bucket or SharePoint library triggers removal from the Kendra index on the next sync cycle, which can be scheduled as frequently as every hour on the Enterprise Edition.

Azure AI Search supports document deletion through the `IndexDocuments` action with `@search.action: delete`, which removes the document from search results immediately. Index storage reclamation occurs during the next merge operation, typically within minutes. For GDPR right-to-erasure requests, Azure’s indexer change detection can trigger re-indexing within 5 minutes when using the high-watermark change detection policy on Azure SQL Database sources.

## Integration with LLM Platforms and Agent Frameworks

The retrieval layer’s value depends on how cleanly it integrates with the generation layer and whether the integration preserves the compliance boundaries established at the retrieval tier.

### Native LLM Platform Integration

Kendra integrates with Amazon Bedrock through the `RetrieveAndGenerate` API, which combines Kendra retrieval with foundation model generation using Claude 3.5 Sonnet (anthropic.claude-3-5-sonnet-20241022-v2:0) or Amazon Titan Text Premier. The integration passes retrieved document excerpts as context to the model, with optional citation generation that includes the source document URI. The entire pipeline operates within the AWS account boundary, which simplifies the data flow diagram required for a GDPR transfer impact assessment.

Azure AI Search integrates with Azure OpenAI Service through the “bring your own data” feature, which appends retrieved documents to the prompt sent to models including GPT-4o (gpt-4o-2024-08-06) and GPT-4o-mini. The integration supports citation annotations that map generated sentences to specific retrieved passages. A documented limitation as of the 10 January 2025 Azure OpenAI Service release notes: citation accuracy degrades when the retrieved document count exceeds 20, as the model’s attention mechanism distributes across too many sources.

### Agent Framework Compatibility

For teams building agentic RAG systems—where an LLM agent iteratively queries the search backend, evaluates results, and reformulates queries—the API design and rate limiting characteristics become operational constraints.

Kendra’s `Query` API supports a maximum of 10 results per page with pagination, and the Enterprise Edition permits up to 8,000 queries per day per index by default (soft limit, raisable via support ticket). The latency profile documented in AWS’s performance guidance (updated 30 September 2024) shows P99 latency under 500ms for queries against indexes up to 500,000 documents, making it viable for multi-turn agent loops where each turn incurs a retrieval step.

Azure AI Search supports up to 1,000 results per query and does not impose query-per-day limits; the constraint is queries per second based on the provisioned search units. An S2 instance handles approximately 120 simple queries per second or 40 vector search queries per second. For agent frameworks like LangGraph or Semantic Kernel that execute multiple retrieval calls per user turn, this throughput ceiling requires capacity planning to avoid queue buildup during traffic spikes.

## Actionable Takeaways

1. **Run a DPIA with both architectures on paper before committing.** The EDPB’s December 2024 guidelines mean your RAG pipeline’s search backend will be scrutinized during compliance reviews. Map out exactly where document data resides, which sub-processors touch it, and whether your encryption key management satisfies Article 32. Kendra’s fully managed document understanding pipeline reduces the number of sub-processors; Azure’s skillset architecture gives you finer control at the cost of more components to document.

2. **Calculate semantic ranking costs against query volume before enabling it.** Azure AI Search’s semantic ranking at $0.003 per query becomes the dominant cost line item at production scale. If your retrieval quality requirements can be met with hybrid BM25-vector retrieval without semantic re-ranking, you reduce monthly search costs from $6,374 to $974 in the workload scenario above. Test retrieval quality with and without semantic ranking on your actual document corpus—not a synthetic benchmark—before committing to the feature.

3. **Verify end-to-end audit trail completeness.** GDPR Article 15 requests require you to produce logs showing what personal data was retrieved and used to generate a specific response. Test both services by running a query, capturing all available log output, and confirming that you can reconstruct the full chain from user identity to retrieved documents to generated text. Azure’s integration with Application Insights currently provides more complete end-to-end tracing when paired with Azure OpenAI Service, but Kendra plus CloudTrail plus custom application logging can achieve equivalent coverage with additional engineering effort.

4. **Provision for agentic workloads differently than single-turn RAG.** If your architecture involves an LLM agent making 3-7 retrieval calls per user query, multiply your expected user queries per second by the average agent turns to get the actual retrieval load. Azure AI Search’s SU-based capacity model makes this calculation explicit; Kendra’s daily query limits require proactive limit increases before launch.

5. **Lock in the model version for your embedding and generation endpoints.** Both services allow you to pin specific model versions, and you should. Retrieval quality is sensitive to embedding model changes, and generation quality varies between model versions. The configuration you validate during your GDPR compliance testing should reference immutable model identifiers: `anthropic.claude-3-5-sonnet-20241022-v2:0` on Bedrock, `gpt-4o-2024-08-06` on Azure OpenAI. Document these versions in your processing activities register as technical measures ensuring consistent data protection.
