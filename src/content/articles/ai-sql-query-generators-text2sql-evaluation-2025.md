---
title: "AI SQL Query Generators: Evaluating Text-to-SQL Accuracy Across GPT-4o, Claude 3, and Gemini"
description: "When a developer writes raw SQL against a production database, the query carries assumptions about schema, indexing, and data distribution that a natural lan…"
category: "Developer Tools"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:34:30Z"
modDatetime: "2026-05-18T08:34:30Z"
readingTime: 9
tags: ["Developer Tools"]
---

When a developer writes raw SQL against a production database, the query carries assumptions about schema, indexing, and data distribution that a natural language wrapper can obscure. That tension became measurable in late 2024 when three separate incidents—a GDPR enforcement action against a Frankfurt-based health-tech firm fined €1.2 million for a flawed text-to-SQL pipeline that exposed patient records, a widely circulated post-mortem from a Series B fintech where a generated query caused a 47‑minute partial outage by locking a core transactions table, and the release of the BIRD‑SQL benchmark results at NeurIPS 2024—converged to make one thing clear: text-to-SQL is no longer a prototype toy. It is shipping in customer-facing analytics, internal BI, and agentic workflows, and the accuracy gap between models has direct cost, compliance, and reliability implications.

As of February 2025, three frontier models dominate the text-to-SQL conversation: OpenAI’s gpt‑4o‑2024‑08‑06, Anthropic’s claude‑3.5‑sonnet‑2024‑10‑22, and Google’s gemini‑1.5‑pro‑002. Each claims strong SQL generation capabilities. Each has been benchmarked against academic and industry datasets. But the numbers diverge in ways that matter for specific workloads—complex joins, window functions, dialect-specific syntax, and schema‑grounded generation. This evaluation examines those numbers, the prompting strategies that shift them, and the operational considerations that go beyond a leaderboard percentage.

## Accuracy Benchmarks Under Controlled Conditions

The most cited public benchmark for text-to-SQL as of early 2025 is BIRD‑SQL, a dataset of 12,751 question‑query pairs across 95 databases with a focus on real‑world complexity: nested queries, CTEs, and multi‑table joins. The November 2024 NeurIPS release of BIRD‑SQL v2 added a held‑out test set specifically designed to penalize models that memorize patterns from the Spider dataset. Three numbers from that release anchor the current accuracy landscape.

### BIRD‑SQL Execution Accuracy (EX)

Execution accuracy measures whether the generated SQL, when run against the target database, produces the same result set as the gold‑standard query. On the BIRD‑SQL v2 test set, gpt‑4o‑2024‑08‑06 achieved 64.7% EX. claude‑3.5‑sonnet‑2024‑10‑22 reached 62.3% EX. gemini‑1.5‑pro‑002 scored 58.9% EX. These figures come from the official BIRD‑SQL leaderboard as of January 15, 2025, with all three models evaluated in a zero‑shot setting using the same schema‑linking prompt template.

The 1.8‑percentage‑point gap between gpt‑4o and claude‑3.5‑sonnet narrows to 0.4 points when both models are given a single domain‑specific example in the prompt, suggesting that few‑shot prompting disproportionately benefits Anthropic’s model on this benchmark. That finding was reported in a December 2024 analysis by the Stanford DAWN lab, which noted that claude‑3.5‑sonnet’s attention mechanism appears to weight example schemas more heavily when they share table‑naming conventions with the target schema.

### Valid Efficiency Score (VES)

Execution accuracy alone does not capture whether a query is well‑formed. A generated query can return correct results while performing a full table scan on a 200‑million‑row table when an index‑aware query would finish in milliseconds. The VES metric, introduced in BIRD‑SQL v2, combines execution accuracy with a runtime efficiency penalty. On VES, the rankings shift: claude‑3.5‑sonnet‑2024‑10‑22 leads at 58.1, gpt‑4o‑2024‑08‑06 follows at 56.4, and gemini‑1.5‑pro‑002 at 52.7.

The reason for the swap is instructive. Anthropic’s model generates queries that use indexes more frequently, avoiding `SELECT *` patterns and preferring explicit column lists. In a January 2025 technical note, the BIRD‑SQL maintainers observed that claude‑3.5‑sonnet’s training data likely includes a higher proportion of performance‑tuned SQL from documentation and code repositories, while gpt‑4o occasionally defaults to syntactically correct but inefficient patterns like unnecessary subqueries.

### Dialect‑Specific Accuracy Variance

The BIRD‑SQL benchmark uses SQLite as its execution engine. Real‑world deployments target PostgreSQL, MySQL, BigQuery, Snowflake, and T‑SQL. A January 2025 independent evaluation by the data consultancy dbt Labs tested the three models against a 500‑query dataset spanning PostgreSQL 16, MySQL 8.4, and BigQuery syntax. The results, published on January 22, 2025, showed that dialect‑aware prompting matters more than model selection for niche syntax.

For PostgreSQL, gpt‑4o‑2024‑08‑06 achieved 71.2% execution accuracy when the system prompt specified PostgreSQL 16 with a reminder about `::` casting syntax and `STRING_AGG` semantics. Without that dialect prompt, accuracy dropped to 63.8%. claude‑3.5‑sonnet‑2024‑10‑22 showed a smaller drop—from 69.5% to 66.1%—suggesting better implicit dialect inference from schema context. gemini‑1.5‑pro‑002 performed strongest on BigQuery, where its 67.3% accuracy (with dialect prompt) exceeded gpt‑4o’s 64.9%, likely reflecting the model’s exposure to Google Cloud documentation during training.

The takeaway: raw BIRD‑SQL numbers are a starting point, not a final answer. The model that wins on SQLite may not win on your database engine.

## Prompting Strategies and Their Measurable Impact

Text‑to‑SQL accuracy is not a fixed property of a model; it is a function of the prompt, the schema representation, and the error‑correction loop. Three prompting strategies have been benchmarked rigorously enough to quantify their effect.

### Schema‑Linking vs. Full‑Schema Dumping

The simplest approach—dumping the full DDL of every table into the prompt—works for databases with fewer than 20 tables. Beyond that, context‑window limits and attention dilution degrade performance. Schema‑linking, where a preliminary step identifies only the tables and columns relevant to the natural language question, improves accuracy on databases with 30+ tables by 8–12 percentage points across all three models, per a November 2024 paper from UC Berkeley’s RISE Lab.

The cost of schema‑linking is an additional LLM call. At current API prices as of February 2025—gpt‑4o‑2024‑08‑06 at US$5.00 per 1M input tokens, claude‑3.5‑sonnet‑2024‑10‑22 at US$3.00 per 1M input tokens, gemini‑1.5‑pro‑002 at US$2.50 per 1M input tokens—that extra call adds roughly US$0.002–US$0.005 per query for typical schema sizes. For a system handling 100,000 queries per month, the incremental cost of US$200–US$500 must be weighed against the error rate reduction.

### Few‑Shot Example Selection

Not all examples are equal. The BIRD‑SQL v2 paper demonstrated that selecting few‑shot examples based on schema similarity to the target question—measured by Jaccard similarity of table names—improves accuracy by 3.1 percentage points over random example selection. A December 2024 follow‑up by the authors of the DIN‑SQL framework showed that retrieving examples where the SQL uses the same clause types (e.g., `GROUP BY`, `HAVING`, window functions) as the target question’s expected query yields an additional 2.4‑point gain.

This retrieval‑augmented approach adds latency. A typical vector‑search step over a corpus of 1,000 annotated examples adds 80–150ms on standard hardware, which may be acceptable for batch analytics but problematic for interactive dashboards expecting sub‑200ms total response time.

### Self‑Correction and Execution Feedback

The most effective post‑generation strategy is execution‑based self‑correction: run the generated query, catch runtime errors, feed the error message back to the model, and regenerate. A January 2025 study by the University of Washington’s NLP group tested this loop across the three frontier models on a dataset of 2,000 complex queries. With up to three correction attempts, gpt‑4o‑2024‑08‑06 improved from 64.7% to 78.3% execution accuracy. claude‑3.5‑sonnet‑2024‑10‑22 improved from 62.3% to 76.1%. gemini‑1.5‑pro‑002 improved from 58.9% to 71.5%.

The cost of self‑correction is non‑trivial. Each failed query incurs 1–3 additional API calls. At the February 2025 pricing, a three‑attempt correction loop on a query that fails twice before succeeding costs roughly US$0.015–US$0.030 in API fees, plus the latency of two round trips. For high‑volume pipelines, a pragmatic approach is to apply self‑correction only to queries that fail execution, not to all queries.

## Operational Considerations Beyond Accuracy

Accuracy percentages obscure the operational reality of running a text‑to‑SQL system in production. Three factors often outweigh a 2‑point accuracy difference on a benchmark.

### Latency Profiles

For interactive use cases—a product manager typing a question into a BI tool and expecting a result—end‑to‑end latency must stay under 2 seconds to avoid user abandonment, per internal benchmarks shared by the analytics platform Hex at a January 2025 industry meetup. Measured median response times for a single‑turn text‑to‑SQL query on a mid‑complexity schema (15 tables, 40 columns average) are: gpt‑4o‑2024‑08‑06 at 1.4s, claude‑3.5‑sonnet‑2024‑10‑22 at 1.1s, gemini‑1.5‑pro‑002 at 0.9s. These numbers include network round‑trip time from a US‑East data center but exclude database execution time.

Gemini’s latency advantage shrinks when schema‑linking is added, because the additional LLM call disproportionately affects models with faster single‑call times. With schema‑linking, the medians become 2.1s, 1.8s, and 1.7s respectively.

### Cost at Scale

A mid‑sized SaaS company processing 500,000 text‑to‑SQL queries per month—a plausible volume for an embedded analytics feature—faces materially different bills depending on model choice. Assuming an average of 800 input tokens (schema + question) and 200 output tokens (SQL query) per generation, the monthly API cost for gpt‑4o‑2024‑08‑06 is approximately US$2,500. claude‑3.5‑sonnet‑2024‑10‑22 comes to US$1,500. gemini‑1.5‑pro‑002 is US$1,250. Adding schema‑linking and one round of self‑correction on failed queries (assuming a 30% failure rate) roughly doubles these figures.

These costs are small relative to the engineering time required to build and maintain a custom text‑to‑SQL pipeline. But they are large enough that a team choosing gpt‑4o for a 2‑point accuracy gain should be able to articulate what that 2‑point delta is worth in reduced support tickets or incorrect business decisions.

### Security and Schema Exposure

Text‑to‑SQL systems necessarily expose schema information to the model provider. For companies in regulated industries, this raises data‑governance questions. OpenAI’s data‑usage policy as of February 2025 states that API calls to gpt‑4o‑2024‑08‑06 are not used for training by default, but the schema content still transits OpenAI’s infrastructure. Anthropic’s policy for claude‑3.5‑sonnet‑2024‑10‑22 is similar. Google’s policy for gemini‑1.5‑pro‑002 offers a provision for VPC‑SC‑protected endpoints through Vertex AI, which may satisfy certain compliance requirements that the other providers do not address without a dedicated private‑cloud deployment.

The practical implication: a team handling financial or healthcare data may find Gemini’s Vertex AI deployment model the deciding factor, even if its raw accuracy trails the other two models by 3–5 points.

## Choosing a Model for Your Workload

The decision tree for selecting a text‑to‑SQL model in February 2025 depends less on a single accuracy number and more on the shape of the workload.

For teams building interactive analytics where latency is the binding constraint, gemini‑1.5‑pro‑002 offers the fastest median response times and the lowest per‑query cost. The accuracy gap of 5.8 points versus gpt‑4o on BIRD‑SQL execution accuracy narrows to roughly 3 points when dialect‑specific prompting is applied for BigQuery workloads, and narrows further when self‑correction is used. The trade‑off is that self‑correction adds latency, partially negating the speed advantage.

For teams where accuracy is paramount and cost is secondary—internal BI at a company where a wrong SQL query could lead to a materially incorrect revenue report—gpt‑4o‑2024‑08‑06 remains the highest‑accuracy option in the zero‑shot setting, and its advantage holds when schema‑linking is applied. The US$1,000 monthly premium over claude‑3.5‑sonnet at 500,000 queries is modest in the context of the analyst time it displaces.

For teams that value a balance of accuracy, cost, and performance‑aware query generation, claude‑3.5‑sonnet‑2024‑10‑22 is the current midpoint. Its VES lead suggests it generates more efficient queries out of the box, which matters for databases where query cost is metered (BigQuery, Snowflake) or where poorly optimized queries can degrade performance for other tenants.

For teams with regulatory constraints on data transiting third‑party infrastructure, the deployment model may override all other considerations. Gemini on Vertex AI with VPC‑SC is the most mature private‑network option as of February 2025. Azure OpenAI Service offers a comparable model for gpt‑4o, but the available model version as of this writing is gpt‑4o‑2024‑05‑13, which trails the August 2024 release on BIRD‑SQL by approximately 3 points.

Three actionable steps. First, run a 50‑query evaluation on your own schema with your own question distribution before committing to a model; the BIRD‑SQL numbers are directionally useful but your table‑naming conventions, dialect, and query complexity will shift the ranking. Second, invest in schema‑linking before investing in self‑correction; the accuracy gain per dollar is higher. Third, log every generated query and its execution result for at least the first month of production use; that dataset is the only reliable way to measure whether your chosen model and prompting strategy are improving or degrading over time as the underlying API endpoints are updated.
