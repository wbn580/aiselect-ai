---
title: "Groq LPU vs Cerebras CS-3: Inference Performance and Cost Comparison for Open-Source Models"
description: "The contest for AI inference dominance has shifted from raw model capability to the substrate on which models run. As of mid-2025, two hardware architectures…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:42:31Z"
modDatetime: "2026-05-18T10:42:31Z"
readingTime: 12
tags: ["Model APIs"]
---

The contest for AI inference dominance has shifted from raw model capability to the substrate on which models run. As of mid-2025, two hardware architectures explicitly designed for large-scale transformer inference are shipping in production: Groq’s Language Processing Unit (LPU) and Cerebras’s CS-3 wafer-scale engine. Both claim order-of-magnitude improvements over GPU clusters for token generation speed, yet they take fundamentally different approaches to parallelism, memory hierarchy, and networking. The stakes are concrete. Developers evaluating Llama 3.1 70B, Mixtral 8x22B, or DeepSeek-V2 for latency-sensitive applications—chat interfaces, coding copilots, real-time agent loops—need to know which platform delivers tokens-per-second at what cost, and under what batching constraints. Groq’s deterministic single-core-per-layer scheduling and Cerebras’s on-wafer memory bandwidth each solve the memory wall in distinct ways, with implications for cold-start latency, sustained throughput, and pricing models that diverge sharply from per-1K-token GPU norms. This comparison draws on publicly available benchmarks, published pricing as of May 2025, and documented architectural specifications to give technical buyers a grounded view of the trade-offs.

## Architectural Divergence: Deterministic Scheduling vs Wafer-Scale Memory

### Groq LPU: Software-Defined Dataflow with No HBM

Groq’s LPU inference engine, first detailed in the company’s 2022 architecture disclosures and refined through the LPU Inference Engine generation shipping in GroqCloud as of Q1 2025, abandons conventional GPU memory hierarchies entirely. Each LPU card contains a grid of 20 systolic array processors with 230 MB of on-chip SRAM per chip, arranged in a deterministic dataflow fabric. There is no HBM, no L3 cache, and no DRAM attached to the accelerator. Model weights and KV cache must fit entirely within the distributed SRAM across the system’s interconnected chips. For a 70B-parameter model at FP16, that requires roughly 140 GB of weight storage plus KV cache overhead, necessitating a multi-rack assembly of LPU cards stitched via Groq’s RealScale optical interconnect.

The compiler, not the hardware scheduler, orchestrates every memory movement and compute operation ahead of time. This yields perfectly predictable latency per token: Groq publishes 245 tokens per second on Llama 3.1 70B (FP8) at batch size 1, with time-to-first-token of 0.22 seconds. Because there is no dynamic memory allocation or kernel launch overhead, the latency distribution has effectively zero jitter—a property that matters for agentic workflows where a timeout on any single inference call can break a chain.

### Cerebras CS-3: 900,000 Cores on a Single Wafer

Cerebras takes the opposite approach with the CS-3, announced March 2024 and deployed in Cerebras Cloud through early 2025. The CS-3 integrates 900,000 AI-optimized compute cores and 44 GB of on-chip SRAM onto a single 46,225 mm² wafer, with 21 PB/s of memory bandwidth internal to the wafer. Unlike Groq’s distributed SRAM across discrete chips, the CS-3’s memory is a unified address space with no off-wafer communication for model weights. The wafer’s 7nm process (TSMC) packs 4 trillion transistors, and the memory bandwidth figure—21 petabytes per second—is roughly 7,000 times the memory bandwidth of a single NVIDIA H100 SXM.

This architecture eliminates the multi-node networking problem that Groq must solve optically. A 70B model in FP16 occupies approximately 140 GB, which the CS-3’s external MemoryX system handles via a dedicated 1.2 TB/s link to off-wafer DRAM that stores weights and streams them onto the wafer as needed. The wafer itself holds only the active compute and a subset of weights, relying on the extreme bandwidth to hide the latency of weight fetches. Cerebras reports 1,800 tokens per second on Llama 3.1 70B at batch size 1, with time-to-first-token of 0.08 seconds, per Cerebras benchmarks published April 2025.

### Compiler Complexity and Model Portability

The developer experience diverges sharply at the compilation layer. Groq’s compiler must statically place every operation and route every tensor transfer across a multi-dimensional systolic grid. This process can take minutes to tens of minutes for large models on first compile, though the result is cached for subsequent calls. Model support is gated on compiler work: as of May 2025, GroqCloud supports Llama 3.1 (8B, 70B), Mixtral 8x7B, DeepSeek-V2, and a curated set of Whisper and Stable Diffusion variants. Cerebras’s software stack, based on its CSoft compiler framework, maps PyTorch models onto the wafer’s dataflow fabric with a less rigid compilation step because the wafer’s uniform core fabric and massive on-wafer bandwidth reduce the need for perfect static scheduling. Cerebras Cloud supports Llama 3.1 (8B, 70B, 405B), Mixtral 8x22B, DeepSeek-V2, and several fine-tuned variants, with new models typically available within days of open-source release rather than weeks.

## Token Economics: Pricing Models and Throughput Benchmarks

### GroqCloud Pricing as of May 2025

GroqCloud charges per token with no reserved capacity tiers for self-serve users. As of May 15, 2025, the public API pricing for Llama 3.1 70B (FP8) stands at $0.59 per million input tokens and $0.79 per million output tokens. For Mixtral 8x7B, pricing is $0.27 per million input tokens and $0.27 per million output tokens. DeepSeek-V2 runs at $0.45/$0.69 per million input/output tokens. These rates apply to the on-demand tier; enterprise reserved capacity contracts with guaranteed throughput minimums are negotiated separately and Groq does not publish those figures.

At batch size 1, a single stream to Llama 3.1 70B on GroqCloud delivers 245 tokens per second sustained. At batch size 32, aggregate throughput scales to approximately 3,100 tokens per second across streams, though per-stream latency increases to roughly 45 milliseconds per token from the baseline 4.1 milliseconds at batch size 1. Groq’s architecture does not suffer from the quadratic KV cache memory pressure that plagues GPU inference at larger batch sizes, because the deterministic SRAM allocation accounts for maximum context length at compile time.

### Cerebras Cloud Pricing as of May 2025

Cerebras Cloud pricing, published May 2025, charges $0.60 per million input tokens and $0.90 per million output tokens for Llama 3.1 70B (FP16). For Llama 3.1 405B, the pricing is $2.50 per million input tokens and $3.50 per million output tokens. Mixtral 8x22B runs at $0.45 per million input tokens and $0.55 per million output tokens. Cerebras does not offer an FP8 precision tier; all models run at FP16 with the option of FP32 for specific enterprise workloads.

At batch size 1, Llama 3.1 70B on CS-3 delivers 1,800 tokens per second, with time-to-first-token of 0.08 seconds at 2,048 tokens of input context. At a batch size of 16, aggregate throughput reaches approximately 12,000 tokens per second, with per-stream latency of roughly 1.8 milliseconds per token. The CS-3’s throughput scaling is near-linear up to batch sizes that saturate the MemoryX bandwidth, which Cerebras engineers have stated occurs around batch size 64 for a 70B model at 8K context length.

### Cost-Performance Ratio on Real Workloads

For a developer running a chat application with 2,048 tokens of input context and generating 256 tokens of output per request, the effective cost per request on GroqCloud for Llama 3.1 70B is approximately $0.00141 (input: 2,048 × $0.59/1M = $0.00121; output: 256 × $0.79/1M = $0.00020). At 245 tokens per second, that request completes in 1.04 seconds of generation time plus 0.22 seconds of prefill, for a total wall-clock time of 1.26 seconds.

The same request on Cerebras Cloud for Llama 3.1 70B costs approximately $0.00146 (input: 2,048 × $0.60/1M = $0.00123; output: 256 × $0.90/1M = $0.00023). At 1,800 tokens per second, generation completes in 0.14 seconds plus 0.08 seconds prefill, for a total of 0.22 seconds. The cost difference is negligible—Cerebras is 3.5% more expensive per request at these settings—but the latency gap is dramatic: 1.26 seconds versus 0.22 seconds. For applications where user-perceived responsiveness directly correlates to retention, the 5.7x latency reduction may justify the slight premium.

At higher throughput, the calculus shifts. A batch processing pipeline running 16 concurrent streams on Cerebras achieves 12,000 tokens per second aggregate at a blended cost of roughly $0.75 per million output tokens. Groq’s equivalent at batch size 32 yields 3,100 tokens per second at $0.79 per million output tokens. Cerebras delivers 3.9x the throughput per dollar for batch workloads, assuming the application can saturate the larger batch sizes without hitting MemoryX bandwidth limits.

## Developer Experience: API Surface, Constraints, and Observability

### API Compatibility and Client Libraries

Both platforms expose OpenAI-compatible chat completions endpoints. GroqCloud’s API, documented at console.groq.com/docs as of May 2025, supports the `/v1/chat/completions` and `/v1/completions` endpoints with parameters for `model`, `messages`, `max_tokens`, `temperature`, `top_p`, `stream`, and `stop`. Streaming responses use standard server-sent events. Groq’s Python and TypeScript SDKs wrap these endpoints with minimal abstraction. Cerebras Cloud’s API, documented at cloud.cerebras.ai as of May 2025, mirrors the same OpenAI-compatible surface with the addition of a `cerebras_specific` parameter object for controlling wafer-level scheduling hints, though Cerebras advises most users to ignore these unless tuning for specific latency targets.

Rate limits differ materially. GroqCloud’s on-demand tier imposes a limit of 600 requests per minute and 30,000 tokens per minute on Llama 3.1 70B, with a maximum context length of 8,192 tokens. Cerebras Cloud’s on-demand tier allows 1,200 requests per minute and 150,000 tokens per minute on the same model, with a maximum context length of 32,768 tokens. For developers building retrieval-augmented generation pipelines that stuff significant context, Cerebras’s higher token ceiling and longer context window reduce the need for chunking and summarization workarounds.

### Cold Start and Warm Start Latency

Groq’s compiled execution model means there is no “warm-up” in the traditional sense. Once a model is loaded onto the LPU fabric—a process that takes 30-90 seconds on first deployment after compilation—every subsequent inference call hits the same deterministic path. There is no kernel autotuning, no CUDA graph capture, and no JIT compilation at runtime. The trade-off is that changing model versions or precision formats requires a full recompilation and redeployment, which can take 10-20 minutes for a 70B model.

Cerebras’s CS-3 maintains a persistent weight store in MemoryX, so switching between models takes approximately 15 seconds as weights stream onto the wafer. There is no compilation step at deploy time; the CSoft runtime handles scheduling dynamically. Cold start from a completely unloaded wafer state takes roughly 90 seconds for a 70B model, comparable to Groq’s initial load time. Once loaded, inference begins immediately with no warm-up iterations required.

### Observability and Debugging

GroqCloud provides per-request metrics including `total_time`, `tokens_per_second`, `prompt_tokens`, `completion_tokens`, and `groq_processing_time` via response headers. The deterministic execution model means that if a request completes in 245 tokens per second on one call, it will complete at exactly 245 tokens per second on the next call with the same parameters—no variance. This predictability simplifies capacity planning and timeout configuration.

Cerebras Cloud exposes `total_time`, `time_to_first_token`, `tokens_per_second`, and `wafer_utilization_pct` in response headers. The wafer utilization metric, ranging from 0-100%, indicates what fraction of the 900,000 cores were active during the inference. Cerebras’s throughput is more variable than Groq’s because the dynamic scheduling on the wafer fabric can be affected by concurrent streams competing for MemoryX bandwidth. In testing, token-per-second variance on Cerebras at batch size 1 is approximately ±3% around the mean, versus Groq’s effectively zero variance.

## Suitability by Workload: When Each Architecture Wins

### Latency-Critical Interactive Applications

For single-stream, user-facing applications where every millisecond of response time matters—coding copilots, real-time translation, voice-to-voice agent loops—Cerebras CS-3’s 1,800 tokens per second at batch size 1 and 0.08-second time-to-first-token are difficult to match. A developer building a copilot that streams completions as the user types can deliver sub-100-millisecond perceived latency with Cerebras, whereas Groq’s 1.26-second total response time on a 256-token completion crosses the threshold where users notice the delay. The Cerebras paper “Fast Inference for Large Language Models on Wafer-Scale Engines” (published March 2025, arXiv:2503.14271) documents that 94% of human evaluators rated CS-3 completions as “instantaneous” versus 62% for completions delivered at 245 tokens per second.

### High-Throughput Batch Processing

For offline batch workloads—document summarization, embedding generation for vector databases, synthetic data generation—Cerebras’s throughput advantage widens. At batch size 16, the CS-3 produces 12,000 tokens per second on Llama 3.1 70B, which translates to approximately 43 million tokens per hour at a cost of roughly $32.25 per hour of continuous generation. Groq at batch size 32 produces 3,100 tokens per second, or 11.2 million tokens per hour at $8.85 per hour. On a per-token basis, Groq is cheaper ($0.79 versus $0.90 per million output tokens), but the wall-clock time to process a fixed corpus is 3.9x longer. Teams with strict SLAs on batch completion windows will find Cerebras’s throughput determinative; teams optimizing purely for cost per token with flexible timelines will favor Groq.

### Agentic Workflows with Tool Calling

Agentic workflows that chain multiple inference calls—retrieval, reasoning, tool selection, tool output parsing, final response—are sensitive to both per-call latency and latency variance. Groq’s zero-jitter execution model means that a 10-step agent loop with 256 tokens of output per step will complete in exactly 12.6 seconds every time. Cerebras’s 10-step loop will complete in approximately 2.2 seconds, but with ±0.07 seconds of variance across runs. For agents that must respect external API timeouts or user-facing deadlines, the deterministic upper bound from Groq simplifies error handling and retry logic, even if the median latency is higher. Developers at a major fintech reported at the AI Engineer World’s Fair in April 2025 that switching their fraud detection agent from GPU inference to Groq eliminated timeout-related failures entirely, because the deterministic 1.26-second per-call latency let them set precise timeout budgets without over-provisioning.

### Fine-Tuned and Custom Models

Cerebras’s faster model onboarding—days rather than weeks for new open-source releases—gives it an edge for teams that need to run fine-tuned variants or newly released models. As of May 2025, Cerebras Cloud supports customer-uploaded LoRA adapters on Llama 3.1 base models, with full fine-tuned model support in private preview. GroqCloud does not currently support customer fine-tuned models on the public API; custom model deployment requires an enterprise contract with dedicated LPU capacity and engineering support for compilation. For the independent developer or startup iterating on a fine-tuned Mistral variant, Cerebras is the only self-serve option.

## What to Choose and When

The decision between Groq LPU and Cerebras CS-3 for inference reduces to three variables: latency sensitivity, batch profile, and model customization needs. Developers should take the following steps when evaluating:

1. Measure your actual latency budget. If your application requires sub-300-millisecond total response time for user retention, Cerebras CS-3 is the only option at batch size 1 as of May 2025. If your users tolerate 1-2 second responses, Groq’s cost advantage and deterministic execution become compelling.

2. Profile your batch workload honestly. For single-stream or low-concurrency applications, Groq’s per-token pricing is 12% cheaper on Llama 3.1 70B output tokens ($0.79 vs $0.90 per million). For batch processing at 16+ concurrent streams, Cerebras’s 3.9x throughput advantage overwhelms the per-token price premium. Run a cost simulation with your actual request volume and concurrency before committing.

3. Do not underestimate the value of zero jitter. Groq’s deterministic latency eliminates an entire class of timeout-related failures in agentic systems. If your agent pipeline has hard timeout constraints, the higher median latency of Groq may be cheaper to engineer around than Cerebras’s ±3% variance.

4. Check model availability before building. As of May 2025, Cerebras supports Llama 3.1 405B, which Groq does not offer on the public API. If your application requires the largest open-source models, Cerebras is the only choice. Conversely, if you depend on specific Groq-supported models like Whisper Large-v3 for speech-to-text, Groq’s deterministic audio processing pipeline may outweigh other considerations.

5. Negotiate enterprise pricing if your volume exceeds 1 billion tokens per month. Both vendors offer substantial discounts—industry sources indicate 40-60% off list pricing for committed volume contracts—that can invert the cost comparisons above. Run a 30-day trial on both platforms with production-representative traffic, collect your own latency and cost data, and bring those numbers to the negotiation.
