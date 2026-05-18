---
title: "AI Model Quantization: GGUF vs AWQ vs GPTQ Performance and Accuracy Tradeoffs in 2025"
description: "For teams running local LLMs in early 2025, the cost calculus has shifted. Cloud GPU instances on AWS p4d.24xlarge now run $32.77 per hour on-demand in us-ea…"
category: "Cost & Infrastructure"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:45:48Z"
modDatetime: "2026-05-18T08:45:48Z"
readingTime: 12
tags: ["Cost & Infrastructure"]
---

For teams running local LLMs in early 2025, the cost calculus has shifted. Cloud GPU instances on AWS p4d.24xlarge now run $32.77 per hour on-demand in us-east-1 as of January 2025, while dedicated inference endpoints for models like Llama-3.1-70B-Instruct on Together AI cost $0.90 per million tokens. Meanwhile, the open-weight model landscape has matured: Meta released Llama 3.3 70B in December 2024, Mistral shipped Mistral Large 2 in July 2024, and Qwen2.5-72B landed in September 2024. Each of these models ships at full FP16 precision, weighing in at 140 GB or more for the 70B-class variants. Running them unquantized on consumer hardware remains impractical.

Quantization has become the default path to deployment. But the method chosen determines whether a model fits within 24 GB of VRAM on a single RTX 4090, whether it retains enough accuracy for a RAG pipeline over legal documents, and whether inference latency stays under 100 ms for a chat interface. The three dominant formats as of Q1 2025 are GGUF (the llama.cpp ecosystem format), AWQ (Activation-aware Weight Quantization), and GPTQ (Post-Training Quantization with GPT-derived calibration). Each occupies a distinct point in the accuracy-speed-hardware triangle. This article examines the tradeoffs with benchmark data pinned to specific model versions, quantization levels, and hardware configurations.

## Quantization Formats: Architecture and Runtime

The three formats differ fundamentally in how they compress weights and how inference engines handle those compressed representations. Understanding these differences explains why a Q4_K_M GGUF file runs on a MacBook while a 4-bit GPTQ model requires a CUDA GPU.

### GGUF: CPU-First Design with GPU Offloading

GGUF is the native format for llama.cpp, introduced in August 2023 to replace the earlier GGML format. It stores quantized weights alongside metadata such as tokenizer configuration, chat templates, and model architecture parameters in a single file. The format supports a range of quantization types: 2-bit through 8-bit, with intermediate "K-quant" variants like Q4_K_M and Q5_K_M that apply mixed precision, allocating more bits to attention and feed-forward layers deemed more important by empirical testing.

The key runtime characteristic is that GGUF models run on CPU with optional GPU offloading via llama.cpp's `-ngl` flag. This means a Llama-3.1-70B-Instruct quantized to Q4_K_M (approximately 40 GB) can run across two Mac Studio M2 Ultra systems with 192 GB of unified memory, or on a single Linux workstation with 64 GB of system RAM and a 24 GB GPU, offloading 20 layers. Inference speed on CPU-only for a 70B Q4_K_M model typically reaches 2-4 tokens per second on an AMD Ryzen 7950X, while GPU offloading can push that to 15-20 tokens per second depending on the number of layers moved.

As of llama.cpp release b4455 (January 2025), the project supports flash attention, speculative decoding, and KV cache quantization to Q8_0 or Q4_0, further reducing memory pressure. The ecosystem now includes first-class support for embedding models, vision-language models including Llama 3.2 Vision, and tool-calling via constrained grammar sampling.

### AWQ: Activation-Aware 4-Bit Quantization

AWQ, published by researchers at MIT and SJTU in June 2023, takes a different approach. Rather than quantizing all weights uniformly, AWQ identifies salient weight channels by analyzing activation distributions on a small calibration dataset. It then scales those salient weights before quantization to preserve their dynamic range, effectively trading a small increase in quantization error for a larger reduction in overall loss. The result is 4-bit quantization that maintains perplexity closer to FP16 than uniform methods.

The runtime for AWQ is GPU-only. The reference implementation uses custom CUDA kernels that dequantize weights on the fly during matrix multiplications, fusing the scaling operation into the GEMM. This keeps memory usage at 4 bits per weight but incurs a small compute overhead for the dequantization step. The vLLM inference engine added native AWQ support in version 0.2.0 (August 2023), and as of vLLM 0.7.0 (January 2025), AWQ models achieve 1,200-1,800 tokens per second on an A100 80 GB for a Llama-3.1-70B-Instruct AWQ model, depending on batch size and sequence length.

A practical consideration: AWQ requires a calibration step during quantization, typically using a subset of the Pile or another generic text corpus. This calibration takes 10-30 minutes on a single A100 for a 70B model. The resulting quantized model is not a single file but a directory of safetensors shards with a modified config.json. Loading requires an AWQ-compatible inference engine; the most common choices are vLLM, TGI (Text Generation Inference) from Hugging Face, and AutoAWQ for local experimentation.

### GPTQ: Layer-Wise Post-Training Quantization

GPTQ, introduced by Frantar et al. in October 2022 and refined through 2023, performs layer-wise quantization using an approximate second-order method. It processes the model one layer at a time, quantizing weights to 4 bits while compensating for the resulting error by adjusting the remaining unquantized weights in that layer. This "optimal brain surgeon" style approach requires a calibration dataset, typically 128 samples from C4 or WikiText-2.

The runtime characteristics mirror AWQ: GPU-only, with custom CUDA kernels for 4-bit matrix multiplication. GPTQ models load as safetensors shards with a quantize_config.json specifying the group size, desc_act (whether activation order is preserved), and bits. The ExLlamaV2 engine, released in September 2023, provides the fastest GPTQ inference, reaching 1,400-2,000 tokens per second on an A100 for Llama-3.1-70B-Instruct GPTQ at batch size 1, with the speed advantage over AWQ narrowing at larger batch sizes.

A key difference from AWQ is that GPTQ supports variable group sizes (commonly 128 or 32), where weights are quantized in groups and each group has its own scaling factor. Smaller group sizes improve accuracy at the cost of slightly higher memory usage (the scale factors themselves consume memory). GPTQ also supports activation-order quantization (desc_act=True), which processes columns in order of decreasing activation magnitude, improving perplexity by 0.1-0.3 points on downstream tasks according to the original paper's measurements on OPT-175B.

## Accuracy Benchmarks Across Formats and Bit Widths

Accuracy comparisons require pinned model versions and specific quantization parameters. The following data comes from two sources: a systematic evaluation published by Neural Magic on November 15, 2024, comparing Llama-3.1-70B-Instruct across quantization methods, and independent testing by the llama.cpp maintainers on Llama-3.3-70B-Instruct, published in the project's GitHub discussions on December 10, 2024.

### Llama-3.1-70B-Instruct: MMLU and HumanEval

Neural Magic's evaluation (November 2024) tested Llama-3.1-70B-Instruct at FP16 baseline and across GGUF Q4_K_M, AWQ 4-bit (group size 128), and GPTQ 4-bit (group size 128, desc_act=True). The calibration dataset for AWQ and GPTQ was a 128-sample subset of the Pile. All measurements used the same evaluation harness (lm-evaluation-harness v0.4.3) with identical few-shot settings.

On MMLU (5-shot), FP16 scored 86.0%. GGUF Q4_K_M scored 85.2%, a drop of 0.8 percentage points. AWQ 4-bit scored 85.6%, a drop of 0.4 points. GPTQ 4-bit with desc_act=True scored 85.7%, a drop of 0.3 points. The differences between the three 4-bit formats fell within the margin of error for MMLU (±0.5 points on repeated runs), suggesting that for multiple-choice knowledge tasks, any of the three formats at 4-bit is acceptable.

On HumanEval (pass@1, temperature 0.0), FP16 scored 81.7%. GGUF Q4_K_M scored 78.0%, a drop of 3.7 points. AWQ 4-bit scored 79.9%, a drop of 1.8 points. GPTQ 4-bit scored 80.5%, a drop of 1.2 points. Code generation proves more sensitive to quantization, with GGUF's mixed-precision approach showing the largest gap. The Neural Magic authors attributed this to the K-quant strategy allocating fewer bits to certain feed-forward layers that code generation tasks rely on more heavily than general text completion.

### Llama-3.3-70B-Instruct: Perplexity and Long-Context

The llama.cpp maintainers published perplexity measurements for Llama-3.3-70B-Instruct on December 10, 2024, using a held-out subset of WikiText-2. They compared FP16 (perplexity 4.12) against GGUF Q4_K_M (4.38), Q5_K_M (4.27), Q6_K (4.19), and Q8_0 (4.15). AWQ and GPTQ 4-bit were not included in this specific comparison, but the trend is clear: Q6_K and Q8_0 GGUF quantizations approach FP16 perplexity within 0.07 points, while Q4_K_M shows a 0.26-point degradation.

Long-context retrieval presents a more demanding test. On the RULER benchmark at 32,768 tokens context length (needle-in-haystack retrieval), FP16 Llama-3.3-70B-Instruct achieved 94.3% accuracy. GGUF Q4_K_M dropped to 89.1%, while AWQ 4-bit (tested separately by a community contributor on December 15, 2024) scored 91.7%. The degradation in GGUF is attributed to KV cache quantization compounding with weight quantization; llama.cpp defaults to Q8_0 KV cache, but at 32K context, the accumulated quantization noise in attention becomes measurable.

### 2-Bit and 3-Bit: The Lower Bound

For resource-constrained deployments, 2-bit and 3-bit quantization are sometimes considered. On Llama-3.1-8B-Instruct, GGUF IQ3_XXS (a 3-bit variant with importance-based mixed precision, introduced in llama.cpp in November 2024) scored 64.2% on MMLU compared to 69.4% for FP16, a drop of 5.2 points. GGUF IQ2_XXS (2-bit) scored 58.1%, a drop of 11.3 points. At these bit widths, the model remains functional but loses significant factual recall and reasoning capability. AWQ and GPTQ do not officially support 2-bit or 3-bit quantization for production use; their 4-bit implementations are already near the practical floor for these methods.

## Hardware Compatibility and Deployment Scenarios

The choice of quantization format is often dictated by hardware availability rather than accuracy preferences. Each format maps to specific deployment scenarios.

### Local Development and Edge Deployment

For a developer running models on a MacBook Pro M3 Max with 36 GB unified memory, GGUF is the only viable option among the three. AWQ and GPTQ require CUDA GPUs and do not run on Apple Silicon's Metal backend without significant modification. A Llama-3.1-8B-Instruct Q4_K_M GGUF file (approximately 4.7 GB) runs at 40-50 tokens per second on an M3 Max using llama.cpp's Metal acceleration. A 70B model at Q4_K_M (40 GB) exceeds the 36 GB limit but fits on a Mac Studio M2 Ultra with 64 GB unified memory, achieving 8-12 tokens per second.

For edge devices like NVIDIA Jetson Orin with 32 GB shared memory, GGUF again dominates. The llama.cpp codebase compiles for ARM64 with NEON intrinsics, and the Q4_0 quantization type (simpler than K-quant, without the mixed-precision logic) runs Llama-3.1-8B-Instruct at 15-20 tokens per second on the Orin's 2048 CUDA cores. AWQ and GPTQ are not supported on Jetson platforms as of January 2025.

### Server-Side Batch Inference

For an API serving hundreds of concurrent requests, AWQ or GPTQ on vLLM or TGI is the standard choice. The throughput advantage comes from GPU-native 4-bit GEMM kernels and the inference engines' continuous batching schedulers. On an 8×A100 80 GB node serving Llama-3.1-70B-Instruct AWQ, vLLM 0.7.0 achieves approximately 12,000 tokens per second total throughput at batch size 32, with time-to-first-token (TTFT) of 45 ms and inter-token latency of 8 ms. The same model in GGUF Q4_K_M, running on llama.cpp's server mode with all layers offloaded to GPU, achieves approximately 3,500 tokens per second on the same hardware due to llama.cpp's less optimized continuous batching implementation.

The cost implication is direct. At $32.77 per hour for an 8×A100 node (p4d.24xlarge, us-east-1, January 2025), AWQ delivers 1.32 million tokens per dollar, while GGUF on the same hardware delivers 0.38 million tokens per dollar. For a startup serving 100 million tokens per day, the monthly infrastructure cost difference is approximately $2,272 for AWQ versus $7,895 for GGUF, assuming sustained utilization.

### Mixed CPU-GPU Setups

Between the extremes lies a common scenario: a single workstation with a consumer GPU and ample system RAM. An RTX 4090 24 GB paired with 64 GB DDR5-6000 system RAM can run Llama-3.1-70B-Instruct Q4_K_M GGUF with 20 layers offloaded to GPU. This yields 15-18 tokens per second, usable for a single-user chat interface. AWQ and GPTQ cannot run in this configuration because the full 40 GB of quantized weights must fit in GPU memory; the 24 GB RTX 4090 is insufficient. The only way to run a 70B AWQ model on a single consumer GPU is to use a 2×24 GB setup (dual RTX 4090 or RTX 6000 Ada) with tensor parallelism, which vLLM supports but llama.cpp does not require.

## Quantization Workflow and Ecosystem Maturity

The practical experience of quantizing a model differs significantly across formats, affecting iteration speed during development.

### GGUF: Convert and Quantize

The GGUF workflow uses the `convert_hf_to_gguf.py` script from the llama.cpp repository to convert a Hugging Face model to unquantized GGUF, followed by `llama-quantize` to apply quantization. Quantizing Llama-3.1-70B-Instruct to Q4_K_M takes approximately 45 minutes on a 64-core AMD EPYC CPU with 256 GB RAM, with no GPU required. The output is a single file that can be distributed via Hugging Face or copied directly. The process is deterministic; running the same quantization on the same model produces an identical file.

### AWQ: Calibration and Packing

AWQ quantization requires a GPU with sufficient memory to load the FP16 model. For a 70B model, that means at least 140 GB of VRAM, typically an A100 80 GB × 2 or H100 80 GB. The `autoawq` library handles calibration and packing in a single pass, taking approximately 25 minutes on dual A100s. The calibration dataset matters; using domain-specific text (e.g., medical literature for a healthcare chatbot) can improve downstream accuracy by 0.5-1.0 percentage points compared to generic text, according to a case study published by the AutoAWQ maintainers on October 3, 2024.

### GPTQ: Group Size and Activation Order

GPTQ quantization uses the `auto-gptq` library and similarly requires GPU memory for the FP16 model. Quantizing a 70B model to 4-bit with group size 128 and desc_act=True takes approximately 35 minutes on dual A100s. The group size parameter presents a tradeoff: group size 32 improves perplexity by 0.08-0.12 points over group size 128 on Llama-3.1-70B-Instruct according to Neural Magic's November 2024 measurements, but increases model size by approximately 3% due to additional scale factors. For most deployments, group size 128 is the default and sufficient.

## Choosing a Format: Decision Framework

The format decision reduces to three questions about the deployment environment.

First, does the inference hardware include a CUDA GPU with enough VRAM to hold the entire quantized model? If yes, AWQ or GPTQ on vLLM or TGI will deliver the highest throughput and lowest per-token cost. Between AWQ and GPTQ, the accuracy differences at 4-bit are negligible for most tasks, with GPTQ holding a marginal edge on code generation (0.6 points on HumanEval for Llama-3.1-70B-Instruct). AWQ's simpler quantization process and slightly faster calibration make it the pragmatic default unless code generation is the primary workload.

Second, is the deployment environment CPU-only or a mixed CPU-GPU setup where the GPU cannot hold the full model? GGUF is the only option. The Q4_K_M quantization type offers the best balance of size and accuracy for 70B-class models, while Q5_K_M provides a meaningful accuracy improvement (0.11 perplexity points on Llama-3.3-70B-Instruct) at the cost of approximately 12% larger file size. For 8B-class models, Q4_K_M is sufficient for most use cases; Q8_0 is worth the extra memory if available, as it approaches FP16 accuracy within 0.03 perplexity points.

Third, is the model an embedding model or a vision-language model? Embedding models are particularly sensitive to quantization because small weight perturbations can shift embedding vectors in ways that degrade retrieval accuracy. On the MTEB retrieval benchmark, the BGE-large-en-v1.5 model quantized to GGUF Q4_K_M dropped from 54.1 to 51.3 nDCG@10, a 2.8-point decline measured by the llama.cpp team in September 2024. For embedding models, Q8_0 or FP16 is recommended. Vision-language models like Llama-3.2-11B-Vision require the GGUF format for local deployment as of January 2025; AWQ and GPTQ support for vision encoders remains experimental in vLLM and TGI.

The quantization landscape in early 2025 offers clear, measurable tradeoffs rather than ambiguous choices. GGUF provides maximum hardware flexibility at the cost of server throughput. AWQ and GPTQ deliver production-grade GPU inference with accuracy within 0.5 percentage points of FP16 on most benchmarks. The format lock-in is real but not permanent; converting between formats is possible by going back to the FP16 source, and the open-weight model ecosystem ensures that multiple quantization options exist for every major model release. For teams shipping LLM-powered features, the quantization decision should be documented alongside the model version, calibration dataset, and evaluation scores, treated with the same rigor as any other infrastructure choice.
