---
title: "Edge AI Inference: Apple MLX vs Qualcomm AI Engine vs NVIDIA Jetson for On-Device LLMs"
description: "Running an LLM locally on a device that fits in a coat pocket was an engineering curiosity in 2023. By mid-2025, it has become a line item in procurement spr…"
category: "Cost & Infrastructure"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:45:44Z"
modDatetime: "2026-05-18T08:45:44Z"
readingTime: 10
tags: ["Cost & Infrastructure"]
---

Running an LLM locally on a device that fits in a coat pocket was an engineering curiosity in 2023. By mid-2025, it has become a line item in procurement spreadsheets. Three forces converged to make on-device inference a hard requirement rather than a nice-to-have. First, the European Union’s AI Act entered its general-purpose AI obligations phase on 2 August 2025, pushing any organization handling personally identifiable information toward architectures where data never leaves hardware they control. Second, cloud GPU rental prices for inference-grade instances stabilized at roughly $1.10–$1.40 per A100-hour (reserved, 1-year commit, us-east-1 pricing observed June 2025), which makes a $249 edge device with a 3-year lifespan look economically rational for workloads above roughly 800 queries per day. Third, Apple’s MLX framework reached v0.22 in September 2025 with a stable Metal backend that runs quantized 7B-parameter models at 28 tokens per second on an M4 Max MacBook Pro — a throughput figure that crossed the usability threshold for interactive chat and code completion.

The question for developers and founders is no longer whether edge inference works. It is which silicon and software stack delivers the right mix of throughput, memory ceiling, power draw, and tooling maturity for a specific deployment profile. This article examines three platforms that represent distinct points on the cost-capability curve: Apple MLX on M-series silicon, Qualcomm’s AI Engine on Snapdragon X Elite, and NVIDIA Jetson Orin. Benchmarks are pinned to specific model versions and quantization levels, with pricing sourced to publicly available retail and distributor channels as of October 2025.

## The Three Silicon Stacks Compared

### Apple MLX: The Developer’s On-Ramp

Apple’s MLX framework began as a research project in 2023 and reached production readiness for inference workloads with the v0.20 release in July 2025. It targets the unified memory architecture of M-series chips, where the CPU, GPU, and Neural Engine share a single pool of LPDDR5 memory. This design eliminates the PCIe bottleneck that constrains discrete GPU inference, making the full 128 GB of an M4 Max available to model weights without developer intervention.

Benchmarks run by the MLX community on 15 September 2025 using llama.cpp’s MLX backend and a 4-bit quantized Llama-3.1-8B-Instruct (MLX format, group size 128) show 28.4 tokens per second on an M4 Max (16-core CPU, 40-core GPU, 128 GB unified memory) at batch size 1. The same model on an M3 Pro (12-core CPU, 18-core GPU, 36 GB unified memory) delivered 18.7 tokens per second. Power draw at the wall during sustained inference measured 38 W for the M4 Max and 27 W for the M3 Pro, making both viable for battery-powered deployment in field settings.

The framework’s primary advantage is its integration with the Python data science ecosystem. A developer can prototype a fine-tuned adapter in PyTorch on a cloud instance, convert it to MLX format with a single `mlx-lm convert` command, and deploy it to a MacBook or Mac Mini without touching C++ or Metal Shading Language. The cost of entry is low: a Mac Mini M4 (16 GB unified memory, 256 GB SSD) retails for $599 as of October 2025 and can run 7B-class models at acceptable speed for document summarization and email drafting tasks.

The limitation is the ceiling. Apple Silicon lacks dedicated transformer acceleration hardware comparable to NVIDIA’s Tensor Cores or Qualcomm’s Hexagon NPU. The Neural Engine on M4 provides 38 TOPS (INT8), but MLX primarily targets the GPU for transformer inference, leaving a portion of the silicon underutilized. For models beyond 13B parameters, even the 128 GB memory ceiling of the M4 Max becomes a constraint when serving multiple concurrent users or running larger Mixture of Experts architectures.

### Qualcomm AI Engine: The Power Efficiency Play

Qualcomm’s Snapdragon X Elite (model X1E-84-100) shipped in mid-2024 in the Surface Pro 10 and Samsung Galaxy Book4 Edge. Its AI Engine combines a Hexagon NPU rated at 45 TOPS (INT4) with an Adreno GPU and Kryo CPU cores, all accessible through the Qualcomm AI Engine Direct SDK. The chip’s defining characteristic is its power envelope: the NPU draws approximately 6–8 W under sustained inference load, compared to 30–40 W for a comparable x86 laptop GPU.

In testing published by Qualcomm on 3 October 2025, a Snapdragon X Elite running a 4-bit quantized Llama-3.2-3B model via the QNN (Qualcomm Neural Network) runtime achieved 32.1 tokens per second at batch size 1 with a power draw of 7.2 W. The same device running a 4-bit Llama-3.1-8B achieved 14.8 tokens per second at 8.1 W. These figures position the platform for always-on inference workloads — voice assistants, real-time transcription, on-device code suggestion — where the device must remain responsive for hours on battery.

The developer experience is less polished than MLX. Model deployment requires conversion to Qualcomm’s QNN format through a toolchain that currently supports ONNX as an intermediate representation. The conversion path from Hugging Face weights to QNN involves roughly four steps (export to ONNX, quantize, convert to QNN, generate context binary) and occasionally fails on custom architectures or uncommon attention patterns. Qualcomm addressed part of this friction with the AI Hub, launched March 2025, which provides pre-converted models for 75 common architectures including Llama 3.1, Mistral, and Phi-3.5. Developers targeting standard models can download a QNN binary directly; those with fine-tuned variants must navigate the full conversion pipeline.

Memory bandwidth is the platform’s bottleneck. The Snapdragon X Elite supports up to 64 GB of LPDDR5x at 136 GB/s, which is sufficient for 8B models but constrains batch size and sequence length for anything larger. A 13B model at 4-bit precision occupies roughly 7.5 GB, leaving headroom for KV cache but limiting context windows beyond 8,192 tokens without aggressive KV quantization.

### NVIDIA Jetson Orin: The Industrial Workhorse

NVIDIA’s Jetson Orin family occupies the high end of edge inference, both in capability and cost. The Jetson AGX Orin 64 GB developer kit retails for $1,999 as of October 2025. It provides 2048 CUDA cores, 64 Tensor Cores, and 64 GB of LPDDR5 at 204.8 GB/s. The module is rated for 15–60 W configurable TDP, placing it in a different power class than the Apple or Qualcomm options but enabling throughput that neither can match.

Using NVIDIA’s TensorRT-LLM framework (version 0.14, released 12 September 2025) with a 4-bit quantized Llama-3.1-8B, the Jetson AGX Orin 64 GB delivers 41.3 tokens per second at batch size 1 and 85.6 tokens per second at batch size 4. These numbers come from NVIDIA’s published benchmarks on 20 September 2025 and have been independently reproduced by the edge inference benchmarking project at edge-benchmarks.org on 28 September 2025. For a 4-bit Llama-3.1-70B, throughput drops to 5.2 tokens per second at batch size 1, which is below conversational usability but sufficient for batch summarization or overnight document processing.

The software stack is the most mature of the three platforms. TensorRT-LLM provides graph optimization, kernel fusion, and inflight batching out of the box. Developers who have worked with NVIDIA’s data center tooling will find the Jetson environment familiar: the same CUDA toolkit, the same Triton Inference Server (available in a Jetson-optimized build since version 2.48), and the same Nsight profiling tools. The cost of this maturity is complexity. A production deployment on Jetson requires understanding of Docker container configuration, device tree overlays for hardware acceleration, and power mode management through `nvpmodel`. It is not a platform for teams without embedded systems experience.

The Jetson Orin NX 16 GB offers a lower entry point at $599 (module only) or $899 (developer kit). It provides 1024 CUDA cores, 32 Tensor Cores, and 16 GB of LPDDR5 at 102.4 GB/s. Benchmarks with the same TensorRT-LLM setup show 22.7 tokens per second for 4-bit Llama-3.1-8B at batch size 1, making it roughly competitive with the M4 Mac Mini in throughput but at higher power draw (15 W configured TDP).

## Quantization and Memory: The Real Constraint

### 4-bit Is the Default; 2-bit Is Emerging

Across all three platforms, 4-bit quantization (specifically GPTQ with group size 128 or AWQ with group size 64) has become the default precision for on-device LLM inference in 2025. A 7B-parameter model in FP16 occupies 14 GB. At 4-bit, it occupies 3.9 GB. At 2-bit, it occupies 2.2 GB. The quality degradation from FP16 to 4-bit is measurable but acceptable for most retrieval-augmented generation and summarization tasks. The jump from 4-bit to 2-bit introduces more noticeable degradation, particularly on factual recall benchmarks.

A study published by researchers at the University of Washington on 15 August 2025 evaluated Llama-3.1-8B at various quantization levels on MMLU and HumanEval. FP16 scored 68.7 on MMLU and 72.1 on HumanEval. 4-bit GPTQ scored 66.9 on MMLU and 70.8 on HumanEval. 2-bit GPTQ scored 58.3 on MMLU and 61.4 on HumanEval. The drop at 2-bit is large enough that developers should reserve it for use cases where latency or memory constraints leave no alternative, such as running a 13B model on a 16 GB device.

### KV Cache Is the Silent Memory Killer

A 7B model at 4-bit with a 4,096-token context window requires approximately 0.5 GB for the KV cache at FP16. At 32,768 tokens, the KV cache grows to 4 GB. At 128,000 tokens, it reaches 16 GB — exceeding the model weights themselves. The three platforms handle this differently. Apple MLX supports FP8 KV cache quantization natively as of v0.22, reducing the 128k-token cache to 8 GB. Qualcomm’s QNN runtime added INT8 KV cache support in SDK version 2.28 (August 2025). TensorRT-LLM supports INT8 and FP8 KV cache with automatic selection based on a user-defined memory budget.

In practice, a 16 GB device running a 4-bit 7B model can serve a context window of roughly 8,192 tokens before hitting memory pressure, assuming the operating system and other processes consume 2–3 GB. Developers targeting long-context applications on edge devices should budget memory for the KV cache first and select model size second.

## Deployment Patterns and Total Cost

### Single-User Developer Assistant

For a developer running a local coding assistant (Continue, Cursor with local model, or a custom VS Code extension), the M4 Mac Mini at $599 represents the lowest total cost. It runs a 4-bit DeepSeek-Coder-6.7B at 26 tokens per second, draws 25 W, and requires no additional cooling. The Qualcomm alternative — a Snapdragon X Elite laptop starting at $1,099 — provides comparable throughput with better portability and lower power draw but at nearly double the upfront cost. The Jetson Orin NX 16 GB at $899 adds complexity without a meaningful throughput advantage for this use case.

### Multi-User Edge Server

For a deployment serving 5–10 concurrent users in a clinic, legal office, or retail environment, the Jetson AGX Orin 64 GB at $1,999 becomes the practical choice. Its inflight batching capability allows it to serve multiple requests simultaneously, achieving 85.6 tokens per second at batch size 4. A cluster of four Mac Minis at $2,396 total could theoretically match this throughput but would require a custom load-balancing layer and would lack the unified memory pool needed for larger models. The Qualcomm platform lacks a multi-user server form factor entirely as of October 2025; it is exclusively available in laptops and tablets.

### Always-On Voice Interface

For a battery-powered device that must run inference continuously for 8+ hours — a field data collector, a warehouse voice picker, a construction site documentation tool — the Snapdragon X Elite’s 7.2 W power draw at 32 tokens per second is the decisive advantage. An M4 MacBook Air can achieve similar battery life but at lower throughput (roughly 18 tokens per second for a 3B model on MLX). The Jetson AGX Orin draws too much power for untethered battery operation beyond 2–3 hours without a large external pack.

## What to Buy and When

The edge inference market in October 2025 offers three clear decision paths. Choose Apple MLX on an M4 Mac Mini ($599) if the workload is a single-user developer tool, the model is 7B parameters or smaller, and the team values Python-native tooling over maximum throughput. The total cost of ownership over three years, including electricity at the US average of $0.14/kWh, is approximately $680.

Choose a Snapdragon X Elite device (starting at $1,099) if the workload requires battery-powered always-on inference with a 3B–8B model and the team can invest the engineering time to navigate the QNN conversion pipeline or can use a pre-converted model from the Qualcomm AI Hub. The power savings relative to x86 alternatives recover the price premium within roughly 18 months of continuous operation.

Choose the Jetson AGX Orin 64 GB ($1,999) if the workload involves serving multiple concurrent users, models larger than 8B parameters, or batch processing where throughput per dollar is the primary metric. Budget for an embedded systems engineer who can manage the NVIDIA software stack; the hardware cost is the smaller part of the total deployment expense.

For teams that need to defer the decision, renting a cloud instance with an L40S GPU for $0.80/hour (reserved pricing, October 2025) and running vLLM with a 4-bit model provides a baseline that any edge deployment must beat on latency, privacy, or total cost. Run the workload in the cloud for one month, measure the query volume and latency distribution, and only then commit to a hardware purchase. The edge inference platforms are mature enough to deploy today, but they are not yet commodity items where any choice yields equivalent results. The silicon matters. The quantization level matters. The KV cache configuration matters. Getting all three right is the difference between a device that feels like magic and one that feels like a prototype.
