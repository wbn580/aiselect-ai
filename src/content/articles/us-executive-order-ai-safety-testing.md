---
title: "US Executive Order on AI Safety Testing for Foundation Models"
description: "Developers and founders evaluating foundation models for production systems now face a compliance variable that did not exist two years ago. On October 30, 2…"
category: "Regulation & Compliance"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:34:33Z"
modDatetime: "2026-05-18T08:34:33Z"
readingTime: 7
tags: ["Regulation & Compliance"]
---

Developers and founders evaluating foundation models for production systems now face a compliance variable that did not exist two years ago. On October 30, 2023, President Biden signed Executive Order 14110, “Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence.” The order invokes the Defense Production Act to require companies developing dual-use foundation models above a compute threshold—models trained with more than 10^26 integer or floating-point operations—to report training runs, red-team results, and safety measures to the federal government. The compute threshold is not hypothetical. As of August 2024, GPT-4o-2024-08-06 and Claude 3.5 Sonnet 2024-10-22 both exceed it. The order also tasks the National Institute of Standards and Technology (NIST) with developing testing standards and directs the Department of Commerce to collect model weights and safety data. For teams shipping AI features in healthcare, finance, or infrastructure, the order introduces pre-release testing obligations that did not exist in 2022. The practical question is not whether regulation is coming. It is what specific testing frameworks are required, which models fall under the mandate, and how the timelines affect procurement decisions through 2025.

## Scope and Compute Thresholds

The order defines “dual-use foundation model” as an AI model trained on broad data, generally using self-supervision, containing at least tens of billions of parameters, and applicable across a wide range of contexts. The concrete trigger is the 10^26 FLOP threshold during training. This number matters because it captures models at the scale of GPT-4, Claude 3.5, and Gemini Ultra. Smaller models—Llama 3.1 8B, Mixtral 8x7B, or Claude 3 Haiku—fall below the threshold and are not subject to the same reporting requirements as of October 2024.

### Which Models Are Affected

OpenAI disclosed that GPT-4 training used approximately 2.15 × 10^25 FLOPs, placing it below the threshold. However, GPT-4o-2024-08-06 and the o1-preview model released September 12, 2024 use substantially more compute. Anthropic has not published exact FLOP counts for Claude 3.5 Sonnet 2024-10-22, but independent estimates from Epoch AI place it in the 1–5 × 10^26 range. Google’s Gemini Ultra, released February 8, 2024, falls within the same bracket. Any team procuring these models for fine-tuning or deployment in regulated industries should assume the reporting obligations apply to the base model provider and, in some cases, to downstream fine-tuners who materially modify safety properties.

### Reporting Obligations Timeline

The order required companies to submit initial safety reports within 90 days of the order’s publication—by January 28, 2024. NIST published its first draft of the AI Risk Management Framework (AI RMF) Generative AI Profile on April 29, 2024. The final profile is expected by January 2025. The Department of Commerce’s Bureau of Industry and Security (BIS) proposed mandatory reporting rules for foundation model developers on September 9, 2024, with a 60-day comment period closing November 8, 2024. Final rules are anticipated in Q2 2025. Teams building procurement roadmaps should budget for compliance overhead starting mid-2025.

## Red-Teaming Requirements

Section 4.2 of the order directs NIST to establish guidelines for red-teaming foundation models. Red-teaming in this context means structured adversarial testing to identify capabilities that could enable chemical, biological, radiological, or nuclear (CBRN) threats, cyberattacks on critical infrastructure, or the generation of non-consensual intimate imagery. The order does not treat red-teaming as optional or best-effort. It mandates that companies above the compute threshold conduct testing against NIST-defined benchmarks and report results to the government.

### NIST AI 600-1 Profile

NIST released its initial draft document, “AI 600-1: Artificial Intelligence Risk Management Framework: Generative AI Profile,” on April 29, 2024. The profile maps 12 specific risks across the AI lifecycle, including data poisoning during pre-training, jailbreaking during fine-tuning, and prompt injection during inference. For each risk, the profile specifies testing actions: adversarial input generation, output filtering audits, and human-in-the-loop evaluation protocols. The document does not yet prescribe pass/fail thresholds. It provides a taxonomy that companies must map to their internal testing suites. Developers evaluating models should request vendor documentation showing alignment with AI 600-1 categories before signing enterprise contracts.

### Third-Party Audit Requirements

The order encourages—and the draft BIS rules may require—independent third-party audits for models above the compute threshold. As of October 2024, no accredited auditor certification program exists, but NIST is working with the National Information Assurance Partnership (NIAP) to develop one. In practice, Anthropic published a third-party red-teaming report for Claude 3.5 Sonnet on October 22, 2024, conducted by the Alignment Research Center and METR. OpenAI released a system card for o1-preview on September 12, 2024 with external red-teaming results from Apollo Research. These are early examples of the documentation buyers should expect as standard by late 2025.

## Watermarking and Provenance

Section 4.5 of the order directs the Department of Commerce to develop guidance for authenticating AI-generated content and tracking provenance. The order specifically calls out synthetic content authentication through watermarking, metadata standards, and content provenance tools based on the Coalition for Content Provenance and Authenticity (C2PA) specification.

### C2PA Adoption Status

The C2PA 2.1 specification, released January 30, 2024, defines a standard for cryptographically binding provenance metadata to media files. Adobe, Microsoft, and Google have committed to implementing C2PA across their content creation tools. OpenAI announced C2PA metadata support for DALL-E 3 images generated through the API on February 6, 2024, and extended it to ChatGPT on February 12, 2024. The metadata includes a manifest with the generation timestamp, model identifier, and a content credential signature. Buyers evaluating image generation APIs should verify C2PA compliance in the API response headers. As of October 2024, Midjourney has not implemented C2PA, while Stability AI added C2PA metadata to Stable Diffusion 3 API outputs on June 12, 2024.

### Watermarking for Text Models

Text watermarking remains technically unresolved. The order references it as a research priority. Google DeepMind’s SynthID-text, published in Nature on October 23, 2024, embeds a statistical signature into token probability distributions without degrading output quality. The technique achieves a detection AUC of 0.99 on 1,000-token samples but requires access to the model’s logit outputs at inference time, making it incompatible with black-box API access. OpenAI has not shipped a text watermark for GPT-4o as of October 2024. Teams building content authenticity pipelines should budget for post-hoc detection tools rather than relying on embedded watermarks in 2025.

## Compute Reporting and Model Weights

Section 4.2(a) of the order requires companies acquiring or operating large-scale computing clusters to report their activities to the Department of Commerce. The reporting threshold is a cluster with a set of machines physically co-located in a single datacenter, transitively connected by data center networking of over 100 Gbit/s, and having a theoretical maximum compute capacity of 10^20 integer or floating-point operations per second. This captures clusters with approximately 10,000 H100 GPUs. AWS, Google Cloud, and Microsoft Azure all operate clusters above this threshold and are required to report when foreign persons train models exceeding the 10^26 FLOP threshold on their infrastructure.

### Implications for Cloud Buyers

Teams training models on cloud infrastructure do not have direct reporting obligations unless they trigger the compute threshold independently. However, cloud providers may require customers to disclose training run details as part of the provider’s own compliance obligations. AWS updated its acceptable use policy for Amazon Bedrock on March 15, 2024, to require customers to notify AWS if they plan to train a model exceeding 10^26 FLOPs. Google Cloud added similar language to its Vertex AI terms on May 1, 2024. Founders budgeting for large-scale fine-tuning runs should factor in the administrative overhead of these disclosures, which can add 2–4 weeks to procurement timelines based on early adopter reports.

### Model Weight Security

The order directs NIST to develop best practices for securing model weights against theft or unauthorized access. The concern is that stolen model weights eliminate the safety guardrails applied during fine-tuning and RLHF. NIST’s draft guidance, published July 2024, recommends hardware security modules (HSMs) for weight storage, access logging with tamper-evident audit trails, and multi-party authorization for weight access. These requirements are not yet mandatory, but the BIS proposed rule published September 9, 2024 would make them enforceable for models above the compute threshold. Teams evaluating on-premises deployment of open-weight models like Llama 3.1 405B should note that the security requirements apply to the model’s original developer, not to downstream deployers, as of October 2024.

## What Buyers Should Do Now

First, audit the models in your procurement pipeline against the 10^26 FLOP threshold. If you are using GPT-4o-2024-08-06, Claude 3.5 Sonnet 2024-10-22, or Gemini Ultra, request the vendor’s NIST AI 600-1 alignment documentation and third-party red-teaming reports before signing annual contracts. Second, build C2PA compliance into your image generation evaluation criteria. DALL-E 3 and Stable Diffusion 3 API outputs include C2PA metadata; Midjourney does not. Third, budget 2–4 weeks of additional procurement time for any cloud-based training run approaching the reporting threshold, even if you are below it, because cloud providers are erring on the side of over-disclosure. Fourth, monitor the BIS proposed rule docket. The comment period closes November 8, 2024, and the final rule will clarify whether downstream fine-tuners inherit reporting obligations. Fifth, treat red-teaming as a procurement requirement, not a nice-to-have. If a model vendor cannot produce a red-teaming report aligned with NIST categories by Q2 2025, the model is not ready for deployment in regulated sectors.
