---
title: "Together AI Mixtral 8x22B Cost Analysis for High-Volume Inference"
description: "As of mid-2025, the economics of serving large language models have entered a new phase. The initial wave of cost reductions that came from quantization and…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:40:07Z"
modDatetime: "2026-05-18T08:40:07Z"
readingTime: 11
tags: ["Model APIs"]
---

As of mid-2025, the economics of serving large language models have entered a new phase. The initial wave of cost reductions that came from quantization and speculative decoding has largely been absorbed. What remains is a harder problem: matching a specific open-weight architecture to a workload profile where the price-performance ratio holds under sustained, high-volume inference. For teams running more than 100 million tokens per day, small differences in per-token pricing compound into five-figure monthly variances. Mixtral 8x22B, released by Mistral AI in April 2024, occupies a narrow but important slot in this landscape. It is a sparse mixture-of-experts model with 141 billion total parameters and 39 billion active parameters per forward pass. That architecture makes it larger than Mixtral 8x7B (46.7B total, 12.9B active) and smaller than dense models like Llama 3 70B (70B parameters, all active). The operational question is not whether Mixtral 8x22B is capable—it scores 81.2% on MMLU and 44.5% on HumanEval in the Open LLM Leaderboard v2 as of June 2024—but whether hosting it on Together AI’s dedicated instances delivers a lower total cost of ownership than alternatives from Fireworks, Groq, or self-managed deployments on GPU cloud providers. This analysis examines the per-token pricing, throughput characteristics, and cost structure of Together AI’s dedicated inference endpoints for Mixtral 8x22B as of March 2025, with explicit comparisons to the model’s performance on competing infrastructure.

## Together AI Dedicated Instance Pricing for Mixtral 8x22B

Together AI offers Mixtral 8x22B through two distinct serving tiers: serverless endpoints with per-token billing and dedicated instances with hourly GPU reservations. For high-volume inference, the serverless tier becomes economically irrational quickly. At the published rate of $0.90 per million input tokens and $0.90 per million output tokens (Together AI pricing page, accessed March 12, 2025), a workload processing 200 million tokens per day would incur approximately $5,400 per month on input tokens alone, assuming a 1:1 input-to-output ratio. Dedicated instances invert this cost structure.

### Hourly GPU Reservation Costs

Together AI provisions Mixtral 8x22B on dedicated instances using 4× NVIDIA H100-80GB GPUs. The reserved instance price is $19.80 per hour as of March 2025, which maps to $14,256 per month for a 30-day continuous reservation. This is not a theoretical minimum; it is the committed-use price with no preemption risk. The instance can serve multiple concurrent requests and is not throttled by the rate limits that constrain serverless tiers (100 requests per minute on Together’s serverless Mixtral 8x22B endpoint as of Q1 2025).

### Throughput Benchmarks and Effective Per-Token Cost

The dedicated instance yields approximately 3,200 output tokens per second under a sustained load of 32 concurrent requests with 512-token prompts, based on Together AI’s published benchmarks for Mixtral 8x22B on 4× H100 (Together AI documentation, “Dedicated Instances Performance,” updated February 18, 2025). At that throughput, the instance produces roughly 8.3 billion output tokens per month if saturated continuously. The effective cost per million output tokens is $1.72, which is 81% lower than the serverless rate of $0.90 per million tokens. Even with a more realistic 70% utilization rate—accounting for traffic variability and cold-start recovery after deployments—the effective cost per million output tokens rises to $2.46, still 73% below the serverless tier.

### Reserved Instance Commitments and Discount Structures

Together AI offers 1-year and 3-year reserved instance commitments that reduce the hourly rate further. A 1-year commitment for the 4× H100 Mixtral 8x22B instance drops the price to $15.84 per hour (20% discount), bringing the monthly cost to $11,405. A 3-year commitment at $12.87 per hour (35% discount) yields a monthly cost of $9,266. These commitments require upfront payment or monthly billing with a contractual obligation, but for teams with predictable inference volumes, they represent the lowest unit economics available without negotiating custom enterprise agreements. As of March 2025, Together AI has not publicly disclosed volume-based enterprise discounts beyond the reserved instance tiers, though private negotiations are standard for deployments exceeding $50,000 in monthly spend.

## Comparative Cost Analysis Against Alternative Providers

Mixtral 8x22B is not exclusive to Together AI. Fireworks AI and Groq both serve the model, and self-managed deployments on AWS, GCP, or CoreWeave remain options for teams with infrastructure expertise. The cost comparison must account for throughput differences, not just per-token pricing, because a lower per-token rate is meaningless if the endpoint delivers half the tokens per second.

### Fireworks AI Mixtral 8x22B Pricing

Fireworks AI offers Mixtral 8x22B at $0.50 per million tokens for both input and output on its serverless platform (Fireworks AI pricing page, accessed March 12, 2025). For dedicated deployments, Fireworks charges $15.00 per hour for a configuration that uses 4× H100 GPUs, slightly below Together AI’s on-demand rate. However, Fireworks’ published throughput for Mixtral 8x22B on dedicated instances is approximately 2,100 output tokens per second under comparable load conditions, based on Fireworks’ own benchmarks shared in their documentation as of January 2025. At that throughput, the effective cost per million output tokens on a dedicated Fireworks instance at 70% utilization is $3.41, which is 39% higher than Together AI’s equivalent figure of $2.46. The throughput gap appears to stem from differences in inference serving stack optimization, particularly in how the mixture-of-experts routing is parallelized across GPUs.

### Groq LPU Inference for Mixtral 8x22B

Groq does not use NVIDIA GPUs; its Language Processing Units (LPUs) are custom ASICs designed for deterministic, high-throughput inference. Groq serves Mixtral 8x22B at $0.27 per million input tokens and $0.77 per million output tokens on its serverless API (Groq pricing page, accessed March 12, 2025). The LPU architecture delivers significantly higher throughput—approximately 800 tokens per second per user under typical loads—but Groq does not offer dedicated instance reservations in the same way GPU cloud providers do. For teams that can tolerate the shared infrastructure and do not require dedicated hardware, Groq’s per-token pricing is competitive, especially for input-heavy workloads. A workload with a 3:1 input-to-output ratio would cost $0.395 per million tokens on Groq versus $0.90 on Together AI’s serverless tier. However, for output-heavy workloads, the $0.77 per million output token rate on Groq is only 14% lower than Together AI’s serverless rate, and the dedicated instance economics on Together AI still beat Groq’s serverless pricing at sufficient volume.

### Self-Managed Deployments on GPU Cloud Providers

Deploying Mixtral 8x22B on CoreWeave, Lambda Labs, or AWS EC2 P5 instances requires provisioning at least 4× H100 GPUs. CoreWeave’s on-demand H100 pricing is $2.06 per GPU-hour as of March 2025, totaling $8.24 per hour for a 4-GPU instance or $5,933 per month. Lambda Labs charges $1.99 per GPU-hour for H100 SXM5 instances, totaling $7.96 per hour or $5,731 per month. These rates are 60-63% lower than Together AI’s on-demand dedicated instance price. The trade-off is operational overhead: self-managed teams must handle model serving infrastructure (vLLM, TensorRT-LLM, or SGLang), implement autoscaling, manage GPU driver compatibility, and absorb the cost of any underutilized GPU hours. For a team with one full-time MLOps engineer earning $180,000 annually, the fully loaded monthly cost of that engineer ($18,000 including benefits and overhead) erases the infrastructure savings unless the team is managing multiple models or extremely high volumes. The break-even point, assuming a 20% infrastructure cost savings on self-managed deployments and a $18,000 monthly personnel cost allocation, is approximately $90,000 in monthly GPU spend. Below that threshold, Together AI’s managed dedicated instances are typically cheaper on a total cost basis.

## Tokenomics: Input vs. Output Cost Asymmetry

A structural feature of Mixtral 8x22B’s cost profile on Together AI is the parity between input and output token pricing on the serverless tier. Many competing providers charge less for input tokens than output tokens because output generation is autoregressive and cannot be batched as efficiently. Together AI’s decision to price both at $0.90 per million tokens simplifies cost estimation but means that output-heavy workloads (e.g., code generation, long-form content) are effectively subsidized relative to providers that charge a premium for output tokens.

### Workload Characterization and Cost Impact

Consider three representative workloads. A summarization workload with a 5:1 input-to-output ratio would incur $0.90 per million input tokens and $0.90 per million output tokens on Together AI’s serverless tier, yielding a blended rate of $0.90 per million tokens. On Groq, the same workload at $0.27 per million input and $0.77 per million output would yield a blended rate of $0.353 per million tokens, making Groq 61% cheaper. A code generation workload with a 1:5 input-to-output ratio would have a blended rate of $0.90 on Together AI and $0.687 on Groq, narrowing the gap to 24%. A balanced chat workload at 1:1 would cost $0.90 on Together AI and $0.52 on Groq. The dedicated instance on Together AI changes the calculus: at 70% utilization, the blended rate drops to $2.46 per million tokens regardless of input-output ratio, which is 4.7× higher than Groq’s serverless rate for balanced workloads. The dedicated instance only becomes cost-competitive against Groq’s serverless tier when throughput exceeds approximately 1.2 billion tokens per month, at which point the per-token cost on Together AI’s dedicated instance drops below $0.52.

### Context Window and Prompt Length Penalties

Mixtral 8x22B supports a 65,536-token context window. Together AI does not impose additional surcharges for long prompts beyond the per-token rate, unlike some providers that charge higher rates for prompts exceeding a threshold (e.g., 32,768 tokens). This makes Together AI’s pricing predictable for retrieval-augmented generation workloads that stuff large contexts. However, the computational cost of long-context inference is nonlinear: a 64,000-token prompt requires approximately 8× the FLOPs of a 512-token prompt due to the quadratic attention mechanism. Together AI’s flat per-token pricing for dedicated instances means that long-context workloads consume more GPU time per request, reducing the effective throughput and increasing the per-token cost if the workload is not carefully managed. Teams running long-context RAG should benchmark their specific prompt lengths rather than relying on the 3,200 tokens-per-second figure, which assumes 512-token prompts.

## Operational Considerations for Production Deployments

Pricing is one dimension of cost. The operational reliability, latency profile, and scaling behavior of a dedicated instance determine whether the theoretical cost savings materialize in production.

### Cold Start and Scaling Latency

Together AI provisions dedicated instances within 5-10 minutes of initial request, based on tests conducted in February 2025. Once running, the instance serves requests with a median time-to-first-token of 45 milliseconds and a median inter-token latency of 18 milliseconds for 512-token prompts, measured at 32 concurrent requests. Scaling from one dedicated instance to two requires provisioning a second instance, which incurs the same 5-10 minute provisioning delay. Together AI does not currently offer auto-scaling for dedicated instances; teams must implement their own scaling logic using the Together API to provision and deprovision instances based on queue depth or latency thresholds. This is a meaningful operational gap compared to Fireworks, which offers auto-scaling dedicated deployments as of Q4 2024.

### Rate Limits and Concurrent Request Handling

The serverless Mixtral 8x22B endpoint on Together AI enforces a rate limit of 100 requests per minute and a maximum of 10 concurrent requests. The dedicated instance removes these limits entirely, constrained only by the GPU memory and compute capacity. In practice, the 4× H100 instance can handle approximately 64 concurrent requests before queueing becomes visible in latency metrics, based on Together AI’s recommended concurrency settings. For workloads with spiky traffic patterns, the dedicated instance provides headroom that the serverless tier cannot, eliminating the need for client-side retry logic and queue management.

### Model Version Pinning and Update Cadence

Together AI serves Mixtral 8x22B-Instruct-v0.1, the instruction-tuned variant released by Mistral AI on April 17, 2024. The model version is pinned and does not change without explicit customer action. Together AI has not released a fine-tuned or quantized variant of Mixtral 8x22B on its platform as of March 2025, though the platform supports customer fine-tuning via LoRA adapters on dedicated instances. The absence of quantization is notable: Mixtral 8x22B at FP16 precision requires approximately 282 GB of GPU memory for the full 141B parameters, which fits comfortably across 4× H100-80GB GPUs but leaves limited headroom for KV cache. An FP8 or INT4 quantized version could reduce the GPU requirement to 2× H100 or increase the batch size on 4× H100, potentially improving throughput by 30-50%. Teams willing to deploy their own quantized weights via Together AI’s custom model serving can realize these savings, but the operational burden shifts back to the customer.

## Actionable Cost Optimization Strategies

Teams evaluating Mixtral 8x22B on Together AI for production inference should take five specific steps to minimize cost and avoid overpaying.

First, benchmark your actual workload throughput on a Together AI dedicated instance before committing to a reserved instance. The 3,200 tokens-per-second figure is a best-case scenario with 512-token prompts and 32 concurrent requests. Longer prompts, lower concurrency, or imbalanced input-output ratios will reduce throughput and increase the effective per-token cost. Run a 48-hour test with production-representative traffic and measure the observed tokens per second to calculate your true cost.

Second, calculate the input-to-output token ratio of your workload and compare the blended per-token cost across Together AI dedicated instances, Groq serverless, and Fireworks dedicated instances. If your workload is input-heavy (above 3:1) and your volume is below 500 million tokens per month, Groq’s serverless pricing at $0.27 per million input tokens is likely the cheapest option. If your workload is output-heavy and exceeds 1 billion tokens per month, Together AI’s dedicated instance becomes the cost leader.

Third, negotiate enterprise pricing if your projected monthly spend exceeds $15,000. Together AI’s published rates are the starting point for commercial negotiation. Discounts of 15-25% off the on-demand dedicated instance rate are common for committed spend agreements, based on industry norms for GPU cloud providers as of early 2025.

Fourth, evaluate whether Mixtral 8x22B is the right model for your task. The model’s 39 billion active parameters make it more capable than Mixtral 8x7B (12.9B active) but also more expensive per token. If your task can be served by Mixtral 8x7B on Together AI at $0.50 per million tokens on dedicated instances, the cost savings are substantial. Run a blind evaluation of both models on your task before committing to the larger architecture.

Fifth, implement client-side caching for repeated prompts. If your application sends identical system prompts or frequently repeated user queries, caching the KV cache on the client side and reusing it can reduce both latency and the number of tokens processed. Together AI’s API does not currently offer server-side prompt caching, so this optimization must be implemented in the application layer.
