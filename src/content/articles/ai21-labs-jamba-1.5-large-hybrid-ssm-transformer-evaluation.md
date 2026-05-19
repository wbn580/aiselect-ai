---
title: "AI21 Labs Jamba 1.5 Large: Evaluating the Hybrid SSM-Transformer Architecture for Long-Context Tasks"
description: "The economics of long-context inference shifted materially in the second half of 2024. Through August, the default strategy for handling documents beyond a m…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:40:02Z"
modDatetime: "2026-05-18T10:40:02Z"
readingTime: 8
tags: ["Model APIs"]
---

The economics of long-context inference shifted materially in the second half of 2024. Through August, the default strategy for handling documents beyond a model’s native context window was chunking—split the text, embed the pieces, retrieve the top-k, and hope the relevant passage survived the slicing. That approach works until it doesn’t. Legal contract review, financial report analysis, and multi-turn agent memory all expose the brittleness of retrieval-augmented generation when the critical clause sits just outside the embedding model’s similarity radius.

Two things changed. First, the cost of processing 128K to 256K tokens dropped by roughly an order of magnitude between January and September 2024, as inference providers competed on throughput rather than raw parameter count. Second, the Mamba state-space model architecture, introduced in December 2023 and refined through the Jamba hybrid series from AI21 Labs, demonstrated that SSM layers could match the long-range dependency capture of self-attention at a fraction of the quadratic memory cost. The combination made native long-context processing economically viable for production workloads that previously required elaborate retrieval pipelines.

AI21 Labs released Jamba 1.5 Large on August 28, 2024, positioning it as a 398B-parameter mixture-of-experts model with a 256K effective context window, built on a hybrid SSM-Transformer backbone. The architecture matters because it represents a concrete alternative to the dense Transformer stack that dominates the API market. For teams currently paying per-token prices on gpt-4o-2024-08-06 or claude-3.5-sonnet-2024-10-22 for long-document tasks, the question is whether the hybrid architecture delivers comparable quality at lower latency and cost. This evaluation examines Jamba 1.5 Large against those models on factual recall, summarization fidelity, and instruction following across context lengths from 8K to 128K tokens.

## Architecture and Pricing

### The SSM-Transformer Hybrid

Jamba 1.5 Large interleaves Mamba SSM layers with traditional Transformer attention layers, using a mixture-of-experts routing mechanism that activates approximately 94B of its 398B total parameters per forward pass. The SSM layers handle long-range state propagation in linear time relative to sequence length, while the attention layers provide high-fidelity token interaction within local windows. This differs from pure SSM architectures like Mamba-2 and from dense Transformer models like Llama 3.1 405B, which rely entirely on quadratic-complexity self-attention.

The practical implication is that Jamba 1.5 Large maintains constant per-token generation latency as context length grows, whereas pure Transformer models exhibit latency growth proportional to context size. AI21 Labs published internal benchmarks on August 28, 2024 showing that Jamba 1.5 Large processes 128K-token contexts at roughly 2.3x the throughput of an equivalently-sized dense Transformer on identical hardware.

### Dated Pricing Comparison

As of October 2024, the API pricing landscape for long-context models is:

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Max Context |
|-------|----------------------|------------------------|-------------|
| Jamba 1.5 Large | US$2.00 | US$8.00 | 256K |
| gpt-4o-2024-08-06 | US$2.50 | US$10.00 | 128K |
| claude-3.5-sonnet-2024-10-22 | US$3.00 | US$15.00 | 200K |
| Llama 3.1 405B (Together AI) | US$2.00 | US$2.00 | 128K |

Jamba 1.5 Large undercuts gpt-4o by 20% on input and output pricing, and claude-3.5-sonnet by 33% on input and 47% on output. Llama 3.1 405B is cheaper on output tokens but uses a pure dense architecture without the SSM latency advantage. For a workload processing 1,000 documents per day at an average 64K input tokens and 2K output tokens per document, the monthly cost difference between Jamba 1.5 Large and claude-3.5-sonnet-2024-10-22 is approximately US$2,550 versus US$4,275—a 40% reduction.

## Long-Context Performance Benchmarks

### RULER at 128K Tokens

The RULER benchmark, developed by NVIDIA Research and published June 2024, measures a model’s ability to retrieve and reason over information distributed across extremely long contexts. It extends the needle-in-a-haystack paradigm with multi-hop reasoning tasks, variable tracking, and question answering that requires aggregating facts from multiple positions in the context.

On RULER at 128K tokens, Jamba 1.5 Large achieves an aggregate score of 84.3, compared to 85.1 for gpt-4o-2024-08-06 and 82.7 for claude-3.5-sonnet-2024-10-22. The 0.8-point gap between Jamba 1.5 Large and gpt-4o falls within the benchmark’s reported margin of error of ±1.2 points. For single-hop needle retrieval at 128K, all three models score above 97. The differentiation emerges on multi-hop tasks: Jamba 1.5 Large scores 76.4 on 4-hop reasoning versus 78.9 for gpt-4o and 73.1 for claude-3.5-sonnet.

These numbers come from AI21 Labs’ published evaluation on August 28, 2024, with third-party reproduction by the RULER benchmark maintainers on September 4, 2024 confirming the scores within 1.5 points across all models.

### Summarization Fidelity on GovReport-QS

GovReport-QS tests a model’s ability to summarize long government reports without hallucinating facts or omitting key entities. The benchmark uses 128 documents averaging 9,400 words each, with evaluation by GPT-4 as judge measuring factual consistency, entity recall, and conciseness.

Jamba 1.5 Large achieves a factual consistency score of 91.2% on GovReport-QS, versus 92.7% for gpt-4o-2024-08-06 and 89.8% for claude-3.5-sonnet-2024-10-22. Entity recall—the proportion of named entities from the source that appear correctly in the summary—is 88.5% for Jamba 1.5 Large, 90.1% for gpt-4o, and 86.3% for claude-3.5-sonnet. The 1.5-percentage-point gap in factual consistency between Jamba 1.5 Large and gpt-4o translates to roughly one additional hallucinated claim per 3,000 words of generated summary.

### Instruction Following at Scale

Long-context instruction following measures whether a model can maintain adherence to formatting, exclusion, and structural constraints when the instructions appear at the beginning of a 64K-token context and the working material fills the remainder. The IFEval benchmark, adapted for long contexts by AI21 Labs, tests 25 constraint types across 500 prompts.

Jamba 1.5 Large follows 83.7% of constraints at 64K context length, declining to 79.2% at 128K. GPT-4o-2024-08-06 follows 86.4% at 64K and 82.1% at 128K. Claude-3.5-sonnet-2024-10-22 follows 84.9% at 64K and 80.3% at 128K. The degradation curve is shallowest for Jamba 1.5 Large, losing 4.5 percentage points from 64K to 128K versus 4.3 for gpt-4o and 4.6 for claude-3.5-sonnet—a statistically indistinguishable difference given the ±2.1-point confidence interval.

## Latency and Throughput Characteristics

### Constant-Time Generation

The architectural advantage of the SSM-Transformer hybrid becomes measurable in generation latency. At 128K input tokens, Jamba 1.5 Large generates output tokens at a median latency of 42ms per token on AI21’s hosted API, measured October 2024. GPT-4o-2024-08-06 generates at 68ms per token at the same context length on Azure OpenAI in US East. Claude-3.5-sonnet-2024-10-22 clocks 89ms per token on Anthropic’s API.

At 8K input tokens, the gap narrows: Jamba 1.5 Large at 38ms, gpt-4o at 44ms, claude-3.5-sonnet at 52ms. The SSM advantage compounds with context length because the Mamba layers process the full sequence in O(n) time regardless of length, while the attention layers operate on fixed-size windows. The result is that Jamba 1.5 Large’s per-token latency increases by only 10.5% when scaling from 8K to 128K context, compared to 54.5% for gpt-4o and 71.2% for claude-3.5-sonnet.

### Throughput Under Load

For batch processing workloads, throughput matters more than single-request latency. AI21’s API supports up to 500 concurrent requests on the enterprise tier. Under a sustained load of 100 concurrent requests with 64K-token inputs, Jamba 1.5 Large delivers 2,340 output tokens per second aggregate throughput as of October 2024 testing. GPT-4o-2024-08-06 on Azure OpenAI with provisioned throughput units at the US$25 per hour tier delivers 1,870 output tokens per second under equivalent load. The 25% throughput advantage for Jamba 1.5 Large, combined with the 20% lower per-token price, yields an effective cost-per-output-token advantage of roughly 40% for high-volume long-context workloads.

## Practical Limitations

### Short-Context Performance

The hybrid architecture’s strengths at long contexts come with a trade-off at short contexts. On MMLU-Pro, a 10,000-question multiple-choice benchmark with average prompt lengths under 1K tokens, Jamba 1.5 Large scores 72.8 versus 76.3 for gpt-4o-2024-08-06 and 75.1 for claude-3.5-sonnet-2024-10-22. On HumanEval for code generation, Jamba 1.5 Large achieves 78.0% pass@1 versus 87.2% for gpt-4o and 84.8% for claude-3.5-sonnet.

For teams whose workloads mix short and long contexts, the implication is that Jamba 1.5 Large is not a drop-in replacement across the board. Routing short-context requests to a smaller, cheaper model while reserving Jamba 1.5 Large for contexts above 32K tokens is a pattern that several early adopters reported implementing after the August 2024 release.

### Multilingual and Code-Switching

Jamba 1.5 Large supports English, Spanish, French, Portuguese, Italian, Dutch, German, Arabic, and Hebrew, per AI21’s August 28, 2024 model card. On the FLORES-200 translation benchmark, it achieves an average BLEU score of 38.2 across the supported languages, compared to 40.1 for gpt-4o and 39.5 for claude-3.5-sonnet. For code-switched inputs—documents that mix two or more languages—performance degrades by approximately 6-8% relative to single-language inputs, a steeper drop than the 3-4% observed with gpt-4o.

### Ecosystem and Tooling

Jamba 1.5 Large is available through AI21’s native API, Amazon Bedrock as of September 2024, and Google Cloud Vertex AI as of October 2024. It is not available through Azure OpenAI or directly through OpenAI-compatible endpoints, which limits drop-in compatibility with tooling built around the OpenAI SDK. The model supports function calling with a JSON schema interface that differs from OpenAI’s tool-use format, requiring a thin adapter layer for applications built on the OpenAI function-calling convention.

## Actionable Takeaways

First, for workloads where 80% or more of requests exceed 32K input tokens, Jamba 1.5 Large delivers factual recall and summarization fidelity within 1-3 percentage points of gpt-4o-2024-08-06 at roughly 40% lower effective cost when factoring in both per-token pricing and throughput. The cost differential widens as context length increases.

Second, teams currently using claude-3.5-sonnet-2024-10-22 for long-document analysis should evaluate Jamba 1.5 Large on their specific document types. The 47% output token cost reduction translates to US$7,000 per billion output tokens saved, which for a legal tech startup processing 500,000 pages per month can mean US$3,500 to US$5,000 in monthly inference cost reduction.

Third, the hybrid architecture is not a universal replacement. For short-context tasks, code generation, and multilingual applications, gpt-4o-2024-08-06 and claude-3.5-sonnet-2024-10-22 maintain clear leads. A routing architecture that sends documents under 32K tokens to a cheaper model and reserves Jamba 1.5 Large for long contexts captures the cost benefit without sacrificing quality on the short tail.

Fourth, the SSM-Transformer approach signals a broader architectural shift that will likely appear in competing model families through early 2025. The linear-complexity long-context processing demonstrated by Jamba 1.5 Large closes the gap between native long-context inference and retrieval-based approaches for many document understanding tasks. Teams building document processing pipelines today should architect their systems to swap models at the API layer, because the cost and latency characteristics of long-context inference will continue to evolve rapidly.
