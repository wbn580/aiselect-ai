---
title: "Baseten TRT-LLM Throughput Benchmarks for Llama 3 70B"
description: "Inference throughput is not a theoretical concern for teams shipping LLM features in mid-2025. It determines whether a product demo works under load, whether…"
category: "Dev Frameworks"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:53:51Z"
modDatetime: "2026-05-18T08:53:51Z"
readingTime: 11
tags: ["Dev Frameworks"]
---

Inference throughput is not a theoretical concern for teams shipping LLM features in mid-2025. It determines whether a product demo works under load, whether a batch job finishes before the next billing cycle, and whether a per-token pricing model survives contact with real traffic. The conversation has shifted from “can this model answer correctly” to “can it answer correctly at 200 concurrent requests without melting the GPU cluster.” That shift is driven by two concrete developments: the widespread availability of Llama 3 70B as a production-grade open-weight model, and the maturation of NVIDIA TensorRT-LLM as a deployment framework that promises to extract maximum throughput from fixed GPU budgets.

Baseten, a managed inference provider that runs customer workloads on bare-metal GPU instances, published a set of TRT-LLM benchmarks for Llama 3 70B in late 2024. Those numbers matter because they represent a real-world ceiling for what teams can expect when they move beyond OpenAI-compatible wrappers and invest in optimizing their own inference stack. The benchmarks are not synthetic: they measure tokens-per-second across varying request rates, context lengths, and GPU counts, using the exact model weights that developers download from Meta. For anyone evaluating whether to self-host Llama 3 70B or pay per-token to a managed endpoint, these figures are the starting point for a cost model.

What makes the timing significant is the pricing pressure in the inference market. As of October 2024, Together AI charges $0.90 per million input tokens and $0.90 per million output tokens for Llama 3 70B. Fireworks offers the same model at $0.70 per million tokens across input and output. Groq, using its custom LPU hardware, lists Llama 3 70B at $0.59 per million input tokens and $0.79 per million output tokens. These are dated, verifiable prices that form the baseline against which any self-hosted deployment must compete. Baseten’s TRT-LLM benchmarks provide the throughput data needed to calculate whether owning the GPUs beats renting the tokens.

## The Benchmark Setup

Baseten’s testing configuration is specific enough to replicate. The team used NVIDIA H100-80GB GPUs, the standard inference workhorse as of late 2024, running TensorRT-LLM version 0.10.0 with the Llama 3 70B model in FP8 precision. FP8 is the practical choice here: it preserves model quality for most production use cases while roughly halving memory requirements compared to FP16, which enables larger batch sizes and higher throughput. The benchmarks measure output tokens per second under a continuous batching regime, which is how any production serving system operates when it needs to handle concurrent users.

### GPU Configurations Tested

Three hardware configurations appear in the published results. The single-node setup uses 4x H100 GPUs with tensor parallelism across all four devices. The dual-node configuration scales to 8x H100 GPUs, distributing the model across two interconnected nodes. The largest tested configuration uses 4 nodes with 16x H100 GPUs total. Each step up in GPU count reduces the per-GPU memory pressure and allows for larger batch sizes, but introduces inter-node communication overhead that TensorRT-LLM must manage through its paged attention and KV cache optimizations.

### Workload Parameters

The benchmark varies two axes: request rate measured in queries per second, and input context length. Context lengths tested include 128 tokens, 1024 tokens, and 4096 tokens, with output generation fixed at 128 tokens per request. This output length is deliberately short to stress the prefill phase and the KV cache management rather than the autoregressive decode loop. For teams building RAG applications where retrieved context is substantial but generated answers are concise, this workload profile matches production reality more closely than benchmarks that generate 2000-token completions.

### Measurement Methodology

Throughput is reported in output tokens per second across the entire system, not per GPU. Baseten uses steady-state measurements after a warm-up period, discarding the first 60 seconds of each run to avoid cold-start effects. The numbers reflect what an end user experiences: total tokens generated divided by wall-clock time from the first request to the last completion. This methodology avoids the common pitfall of reporting peak instantaneous throughput that cannot be sustained under continuous load.

## Throughput Results by GPU Configuration

The raw throughput figures tell a story of diminishing returns as GPU count scales, but the absolute numbers are high enough to make self-hosting economically viable for teams with steady inference demand. All results below are for Llama 3 70B in FP8 precision, generating 128 output tokens per request with continuous batching enabled.

### Single-Node 4x H100 Performance

At 128-token context length, the 4x H100 configuration delivers approximately 4,200 output tokens per second at a request rate of 8 queries per second. As the request rate increases to 16 QPS, throughput rises to roughly 4,800 output tokens per second before plateauing. The system reaches saturation at around 20 QPS, beyond which latency increases without meaningful throughput gains. At 1024-token context, throughput drops to approximately 3,100 output tokens per second at 8 QPS, reflecting the increased computational cost of the prefill phase. At 4096-token context, the system sustains roughly 1,800 output tokens per second.

### Dual-Node 8x H100 Performance

Scaling to 8x H100 across two nodes improves throughput at all context lengths but not linearly. At 128-token context, the system peaks at approximately 7,500 output tokens per second at 16 QPS. At 1024-token context, throughput reaches roughly 5,400 output tokens per second. The 4096-token context workload yields approximately 3,200 output tokens per second. The inter-node communication introduces a roughly 10-12% efficiency penalty compared to what a theoretical single-node 8x H100 system would achieve, based on NVIDIA’s reported NVLink bandwidth figures of 900 GB/s for intra-node versus 50-100 GB/s for inter-node connections on typical cloud instances as of Q3 2024.

### Four-Node 16x H100 Performance

The 16x H100 configuration pushes throughput to approximately 12,000 output tokens per second at 128-token context and 32 QPS. At 1024-token context, the system delivers roughly 8,600 output tokens per second. At 4096 tokens, throughput settles at approximately 5,100 output tokens per second. The scaling efficiency from 8 to 16 GPUs is approximately 60%, meaning each additional GPU contributes less incremental throughput than the previous one. This is consistent with the known communication bottlenecks in multi-node tensor parallelism and is not specific to Baseten’s implementation.

## Cost Analysis Against Managed Endpoints

The throughput numbers become actionable when translated into cost-per-token figures. A single H100 GPU on-demand from a major cloud provider costs approximately $3.50 per hour as of October 2024, though reserved instances and spot pricing can reduce this to $1.80-$2.50 per hour. For a 4x H100 configuration running continuously, the hourly GPU cost is $14.00 at on-demand rates. At 4,200 output tokens per second sustained throughput, this configuration produces approximately 15.1 million output tokens per hour. The resulting cost is roughly $0.93 per million output tokens, which is competitive with Together AI’s $0.90 per million but higher than Fireworks’ $0.70 per million.

The economics shift decisively in favor of self-hosting when the workload involves long context lengths or when GPU utilization approaches 100%. The 4x H100 configuration at 4096-token context produces approximately 6.5 million output tokens per hour, yielding a cost of $2.15 per million output tokens. At this context length, managed providers also charge higher effective rates because the input token cost dominates. Together AI’s pricing for a 4096-token input with 128-token output works out to approximately $3.69 per request per thousand queries, while the self-hosted cost on Baseten’s stack at $14.00 per hour and 1,400 requests per hour is $10.00 per thousand queries. The breakeven point depends on daily request volume, but for teams processing more than 500,000 requests per day, the self-hosted approach on 4x H100 is cheaper by a margin of 25-40% depending on context length.

For the 8x H100 configuration at $28.00 per hour and 7,500 output tokens per second at 128-token context, the cost drops to approximately $0.52 per million output tokens, undercutting all major managed providers as of October 2024. This configuration makes sense for teams with sustained high throughput requirements, though it requires a minimum daily spend that only makes sense at scale.

## Latency Under Load

Throughput alone does not capture user experience. Baseten’s benchmarks include latency measurements at the 50th, 95th, and 99th percentiles, and these reveal the operational trade-offs of running at high utilization.

### Time to First Token

At 128-token context and 8 QPS on 4x H100, median time to first token is approximately 45 milliseconds. At 16 QPS, median TTFT increases to 65 milliseconds. The 99th percentile TTFT at 16 QPS reaches 180 milliseconds, which is still acceptable for interactive applications but may be noticeable in chat interfaces where users expect sub-100-millisecond responsiveness. At 4096-token context and 8 QPS, median TTFT rises to 210 milliseconds, and the 99th percentile reaches 520 milliseconds. These numbers reflect the computational cost of processing long prefixes through the full 70-billion-parameter model before any output token can be generated.

### Inter-Token Latency

Once generation begins, inter-token latency remains low and stable. On 4x H100 at 128-token context, median inter-token latency is 18 milliseconds across all request rates tested. Even at the 99th percentile, inter-token latency stays below 35 milliseconds, meaning the decode phase is not the bottleneck. At 4096-token context, median inter-token latency is 22 milliseconds, with 99th percentile at 42 milliseconds. These figures confirm that TensorRT-LLM’s KV cache management is effective at preventing the decode phase from degrading under load, and that the primary latency challenge for Llama 3 70B is the prefill computation for long contexts.

### Queueing Effects at Saturation

When request rates exceed the system’s saturation point, queueing delay dominates. At 24 QPS on 4x H100 with 128-token context, the system cannot process requests faster than they arrive, and the 99th percentile TTFT spikes to over 2 seconds. This behavior is typical of any inference system and underscores the importance of setting rate limits below the measured saturation point. Baseten’s data suggests a safe operating point at approximately 70% of the maximum throughput QPS, which provides headroom for traffic spikes without triggering queueing delays.

## Implementation Considerations

Deploying TRT-LLM on Baseten or any other infrastructure requires navigating several engineering decisions that directly affect the throughput numbers reported above.

### Model Quantization Trade-offs

The benchmarks use FP8 quantization, which is supported natively on H100 GPUs through the Transformer Engine. FP8 reduces the model’s memory footprint from approximately 140 GB in FP16 to roughly 70 GB, enabling the 4x H100 configuration to fit the entire model in GPU memory with room for KV cache. Teams considering INT4 quantization should expect roughly 30-40% higher throughput than FP8 but must validate that accuracy degradation is acceptable for their specific use case. According to Meta’s Llama 3 technical report published July 23, 2024, FP8 quantization results in less than 0.5% degradation on standard benchmarks compared to FP16, while INT4 can degrade by 1-3% depending on the task.

### Batching Strategy

TensorRT-LLM’s continuous batching, also called in-flight batching, allows the scheduler to append new requests to the current batch without waiting for all in-progress generations to complete. This is the key mechanism that enables the throughput numbers reported above. Static batching, by contrast, would reduce throughput by 40-60% at equivalent request rates because GPUs would idle while waiting for the longest generation in each batch to finish. Any deployment that does not implement continuous batching will see throughput far below the Baseten benchmarks.

### KV Cache Sizing

The KV cache stores the key and value tensors for every token in every active request’s context. For Llama 3 70B, each token in the KV cache consumes approximately 2.5 MB of GPU memory in FP8. At 4096-token context with 32 concurrent requests, the KV cache alone requires roughly 320 GB, which exceeds the memory available on 4x H100 GPUs. This is why the 4096-token context throughput on 4x H100 is lower: the system cannot batch as aggressively because it runs out of KV cache space. Teams serving long-context workloads should provision GPU memory accordingly, with 8x H100 as the practical minimum for high-concurrency 4096-token deployments.

## What the Numbers Mean for Production Deployments

The Baseten TRT-LLM benchmarks for Llama 3 70B provide a concrete reference point for teams deciding between managed APIs and self-hosted inference. The data supports a few actionable conclusions.

First, for teams with intermittent or low-volume workloads, managed endpoints remain the economically rational choice. The breakeven point for a 4x H100 cluster at on-demand pricing is approximately 300,000 requests per day at 128-token context, assuming sustained utilization during operating hours. Below that threshold, the operational overhead of managing GPU instances, handling failovers, and updating model versions outweighs the per-token savings.

Second, teams serving long-context RAG applications should run their own cost models using the 4096-token figures. The managed providers charge per input token, and at 4096 tokens of context per query, the input token cost dominates. Self-hosting on 8x H100 at $28.00 per hour yields an effective cost of roughly $0.86 per million input-plus-output tokens at 4096-token context, which is 50-60% cheaper than the managed alternatives as of October 2024.

Third, latency-sensitive applications must provision for the prefill bottleneck. The 210-millisecond median TTFT at 4096-token context on 4x H100 is too slow for real-time chat, though acceptable for batch summarization or document processing. Teams building interactive products should target the 8x H100 configuration and cap context lengths at 1024 tokens to keep median TTFT under 100 milliseconds.

Fourth, the scaling efficiency data from 4 to 8 to 16 GPUs indicates that the sweet spot for Llama 3 70B is 8x H100. The jump from 4 to 8 GPUs delivers roughly 78% throughput improvement, while the jump from 8 to 16 delivers only 60%. Unless throughput requirements exceed 10,000 output tokens per second sustained, the 16-GPU configuration is difficult to justify on cost grounds.

Fifth, teams should benchmark their own workloads rather than relying solely on published numbers. The Baseten benchmarks use a specific request distribution, output length, and quantization scheme that may not match a given application’s traffic pattern. Running a one-day test on the target hardware with production-representative queries costs a few hundred dollars and can reveal bottlenecks that generic benchmarks miss, particularly around KV cache pressure and queueing behavior at peak load.
