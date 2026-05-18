---
title: "Open-Source LLM Deployment: vLLM vs TGI Performance and Throughput Comparison"
description: "In late January 2025, the European Union’s AI Office published the first compliance deadlines under the AI Act for general-purpose AI models. Providers of mo…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:18:26Z"
modDatetime: "2026-05-18T08:18:26Z"
readingTime: 9
tags: ["Model APIs"]
---

In late January 2025, the European Union’s AI Office published the first compliance deadlines under the AI Act for general-purpose AI models. Providers of models released after August 2, 2025 must document training data provenance, compute budgets, and evaluation results before deployment. For engineering teams running open-source models on their own infrastructure, the clock started ticking on a parallel problem: the cost of self-hosting inference is now a line item that directly affects regulatory overhead. Every additional GPU-hour spent serving a model increases the carbon and compute disclosures required under Annex XI of the Act. Meanwhile, AWS dropped its p5.48xlarge on-demand price to US$98.32 per hour on January 15, 2025, and Lambda Labs followed with an H100 node at US$1.99 per GPU-hour on February 1, 2025. The arithmetic is straightforward: picking the wrong inference engine on an 8×H100 node can waste US$157 per day per percentage point of throughput left on the table. Two engines dominate production self-hosting of open-weight models: vLLM (v0.6.3, released November 2024) and Hugging Face’s Text Generation Inference (TGI v2.3.1, released December 2024). The choice between them is not about feature checklists. It is about sustained tokens per second per dollar, tail latency under concurrent load, and how gracefully each engine handles the Llama-3.1-70B-Instruct weights that shipped with a gated license on July 23, 2024.

## Throughput and Latency Under Load

### Sustained Tokens per Second on 8×H100

Engineers at Anyscale published a benchmark on December 12, 2024 that pinned vLLM v0.6.3 against TGI v2.3.1 on an 8×H100 SXM node running Llama-3.1-70B-Instruct at FP16. With 512 input tokens and 128 output tokens per request, vLLM delivered 4,872 tokens per second at concurrency 128. TGI reached 3,241 tokens per second under identical conditions. The gap widened at higher concurrency. At 256 concurrent requests, vLLM hit 5,103 tokens per second while TGI plateaued at 3,089 tokens per second. The P99 time-to-first-token told a similar story: 187 milliseconds for vLLM versus 412 milliseconds for TGI at concurrency 256. These are not synthetic numbers. The benchmark used the ShareGPT dataset with real prompt distributions, and the Anyscale team open-sourced the reproduction scripts on December 13, 2024.

### Memory Efficiency and Batch Packing

The throughput delta traces back to memory management. vLLM’s PagedAttention, described in the October 2023 paper from UC Berkeley, treats KV cache blocks as virtual memory pages. When a request finishes, the engine frees its blocks and reallocates them to waiting requests without fragmentation. TGI v2.3.1 uses a contiguous pre-allocation scheme. On Llama-3.1-70B-Instruct, the KV cache per token at FP16 occupies 640 KB. Under mixed-length requests, TGI’s allocator leaves an average of 18% of allocated KV cache unused because it reserves space for the maximum sequence length. vLLM’s page-based allocator drops that waste below 3%. On an 8×H100 node with 640 GB of HBM, that 15-percentage-point difference translates to roughly 96 GB of additional usable KV cache, enough to pack 38% more concurrent requests before preemption kicks in.

### Continuous Batching Behavior

Both engines implement continuous batching, but the scheduling policies diverge. vLLM v0.6.3 uses a preemption-aware scheduler that evicts and recomputes KV cache blocks when memory pressure hits a configurable threshold. TGI v2.3.1 defaults to a first-come-first-served queue with no preemption; it rejects requests with a 503 when the batch is full. In a production traffic pattern modeled on the LMSYS-Chat-1M dataset, vLLM maintained a 99.7% acceptance rate at concurrency 256, while TGI dropped to 87.4% acceptance. For a service with a 99.9% uptime SLO, that gap means TGI requires either overprovisioning by 14% or an external retry layer with exponential backoff.

## Model Support and Quantization

### Weight-Only Quantization Accuracy

The Llama-3.1-70B-Instruct weights at FP16 consume 140 GB of GPU memory. On a single 8×H100 node, that leaves 500 GB for KV cache, enough for roughly 800 concurrent requests at 512 tokens each. Moving to 4-bit quantization halves the model footprint to 70 GB. vLLM v0.6.3 supports AWQ and GPTQ out of the box, with an AWQ calibration file released by TheBloke on August 2, 2024. TGI v2.3.1 added AWQ support in November 2024 but requires the model to be pre-quantized with Hugging Face’s optimum library. On the MMLU-Pro benchmark run on January 10, 2025 by the LMSYS organization, Llama-3.1-70B-Instruct-AWQ scored 66.4% accuracy compared to 66.9% for the FP16 baseline. The 0.5-percentage-point drop is within the benchmark’s ±0.3% margin of error. For throughput-sensitive applications where the cost of an H100 hour matters more than a half-point of MMLU, AWQ is the default choice, and vLLM’s native loader avoids a conversion step that TGI’s pipeline adds.

### Multi-LoRA Serving

Fine-tuned adapters change the deployment calculus. vLLM v0.6.3 can serve up to 128 LoRA adapters on a single base model instance, loading and unloading them from CPU memory without blocking inference. TGI v2.3.1 caps LoRA adapters at 16 per instance and requires a restart to change the set. On November 20, 2024, Predibase published a benchmark showing vLLM serving 64 LoRA adapters on Llama-3.1-8B-Instruct with a throughput drop of only 7% compared to a single adapter. TGI showed a 31% drop at 16 adapters. For teams building multi-tenant SaaS with per-customer fine-tunes, the difference is between one 8×H100 node and three.

### Speculative Decoding

Speculative decoding uses a small draft model to propose tokens that the large model verifies in parallel. vLLM v0.6.3 supports n-gram speculation and draft-model speculation via a pluggable interface. TGI v2.3.1 added Medusa-based speculative decoding in December 2024, but it is tied to the Medusa architecture and requires a separate Medusa head trained for each base model. On Llama-3.1-70B-Instruct with a Llama-3.2-1B draft model, vLLM delivered a 1.7× throughput improvement at batch size 1, measured by Anyscale on December 12, 2024. TGI’s Medusa implementation on the same model achieved 1.3×. The gap narrows at high concurrency because the draft model’s overhead eats into the GPU’s compute budget, but for latency-sensitive interactive applications, 1.7× is the difference between a 200-millisecond and a 340-millisecond response.

## Operational Overhead and Observability

### Deployment and Configuration Complexity

vLLM ships as a Python package installable via pip. Starting a server on an 8×H100 node requires one command: `vllm serve meta-llama/Llama-3.1-70B-Instruct --tensor-parallel-size 8`. TGI requires a Docker image, a model volume mount, and environment variables for sharding, quantization, and max input length. The Docker requirement is not a dealbreaker for teams already running Kubernetes, but the environment-variable interface has 47 documented parameters as of TGI v2.3.1, and misconfiguring `MAX_INPUT_LENGTH` or `MAX_BATCH_PREFILL_TOKENS` silently degrades throughput. vLLM exposes 23 server arguments, and the defaults are tuned for the hardware detected at startup. In a survey of 200 self-hosted inference deployments published by RunPod on January 22, 2025, 68% of respondents reported that vLLM was operational within one hour of starting setup, compared to 41% for TGI.

### Metrics and Monitoring

Both engines expose Prometheus endpoints. vLLM v0.6.3 emits 31 metrics including `vllm:time_to_first_token_seconds`, `vllm:time_per_output_token_seconds`, `vllm:request_success_total`, and `vllm:gpu_cache_usage_perc`. TGI v2.3.1 emits 19 metrics. The critical gap is in cache metrics: TGI reports `tgi_queue_size` and `tgi_batch_current_size` but does not expose KV cache utilization as a percentage. Without that metric, autoscaling based on GPU memory pressure requires inference from queue depth, which is a lagging indicator. vLLM’s `gpu_cache_usage_perc` allows a Kubernetes HPA to scale the deployment before requests start getting rejected.

### Failure Modes and Recovery

When an H100 node encounters an ECC error, NVIDIA’s driver resets the GPU, and the inference engine must recover in-flight requests. vLLM v0.6.3 checkpoints KV cache blocks to CPU memory every 100 iterations by default, allowing recovery of partial request state after a GPU reset. TGI v2.3.1 does not implement KV cache checkpointing; a GPU reset drops all in-flight requests and requires clients to retry. For a deployment processing 5,000 requests per second across 10 nodes, a single GPU reset per node per week translates to roughly 50,000 dropped requests per week on TGI versus near-zero on vLLM. The difference shows up in the P99 latency SLO, where TGI’s retry spikes can push tail latency past 10 seconds.

## Cost Analysis at Scale

### Per-Token Economics on H100 Instances

Assume an 8×H100 node at Lambda Labs’ February 2025 on-demand price of US$15.92 per hour (8 × US$1.99). Running Llama-3.1-70B-Instruct at FP16 on vLLM v0.6.3, the node delivers 4,872 tokens per second at concurrency 128. That works out to 17.54 million tokens per hour, or US$0.00091 per 1,000 output tokens. On TGI v2.3.1 at 3,241 tokens per second, the node produces 11.67 million tokens per hour, or US$0.00136 per 1,000 output tokens. The 49% cost premium for TGI adds up: serving 1 billion output tokens per month costs US$910 on vLLM and US$1,360 on TGI. Over a 12-month reservation on an 8×H100 node (US$110,000 per year at Lambda’s reserved pricing announced January 2025), the throughput gap means vLLM delivers 153 billion tokens per year versus 102 billion on TGI. The US$110,000 is a sunk cost either way; the only variable is how many tokens it buys.

### Reserved vs. Spot Instance Behavior

On AWS, a p5.48xlarge spot instance can dip to US$29.50 per hour when capacity is loose. Spot interruptions arrive with a two-minute warning. vLLM v0.6.3 supports graceful shutdown on SIGTERM, draining in-flight requests and saving KV cache state to disk. TGI v2.3.1 initiates a shutdown but does not drain; in-flight requests fail. On a spot fleet of four p5.48xlarge instances with an average interruption rate of 5% per hour (realistic for us-east-1 in Q1 2025), TGI’s request failure rate from interruptions alone is 0.4% of total traffic. vLLM’s is below 0.01%. For a service serving 100 million requests per day, that is 400,000 failed requests per day on TGI versus fewer than 10,000 on vLLM.

### Quantization Savings

Switching to AWQ 4-bit on Llama-3.1-70B-Instruct reduces the model footprint from 140 GB to 70 GB. On an 8×H100 node, that frees 70 GB for KV cache, increasing maximum concurrency from roughly 800 to roughly 1,600 requests at 512 tokens each. vLLM v0.6.3 with AWQ delivers 8,100 tokens per second at concurrency 256, per Anyscale’s December 2024 benchmark. TGI v2.3.1 with AWQ reaches 5,400 tokens per second. The per-token cost drops to US$0.00055 for vLLM and US$0.00082 for TGI. At 1 billion output tokens per month, the AWQ savings are US$550 on vLLM versus US$820 on TGI. The US$270 monthly difference covers the cost of a dedicated CI/CD runner for model evaluation.

## What to Choose and When

The decision between vLLM and TGI in February 2025 reduces to four scenarios. First, for single-model, high-throughput deployments on H100 or A100 nodes, vLLM v0.6.3 is the default. The 50% throughput advantage on Llama-3.1-70B-Instruct at FP16, combined with PagedAttention’s memory efficiency and KV cache checkpointing, makes the per-token cost case unassailable. Second, if the deployment requires Hugging Face’s inference endpoints or tight integration with the HF Hub’s model versioning and access control, TGI v2.3.1 is the only option that supports those natively. The convenience tax is roughly 49% on per-token cost. Third, for multi-LoRA serving with more than 16 adapters, vLLM is the only engine that handles the workload without a linear increase in node count. Fourth, for teams that prioritize one-command deployment and Prometheus-native GPU cache metrics for autoscaling, vLLM’s operational simplicity outweighs TGI’s broader parameter surface. The Llama-3.1 family weights, released July 23, 2024, will remain the dominant open-weight models until at least mid-2025. The inference engine that serves them most efficiently is not a matter of preference. It is a line item on a compute bill that, under the EU AI Act’s disclosure requirements, will soon be public.
