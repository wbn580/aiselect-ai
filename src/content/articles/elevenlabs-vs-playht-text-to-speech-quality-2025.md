---
title: "ElevenLabs vs PlayHT: Text-to-Speech Quality and Latency for Real-Time Voice Agents in 2025"
description: "As of April 2025, the landscape for real-time voice agents has shifted from experimental demos to production-critical infrastructure. The trigger is not a si…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:56:43Z"
modDatetime: "2026-05-18T10:56:43Z"
readingTime: 8
tags: ["Agent Platforms"]
---

As of April 2025, the landscape for real-time voice agents has shifted from experimental demos to production-critical infrastructure. The trigger is not a single regulatory event but a compound of latency expectations set by OpenAI’s Realtime API (gpt-4o-realtime-preview-2024-12-17), the maturation of WebRTC signaling in voice pipelines, and a pricing war that has pushed per-character costs below the threshold where founders need to debate build-versus-buy. Voice agent frameworks like Vapi, Retell, and LiveKit now routinely target sub-800ms total response latency, and the text-to-speech (TTS) component accounts for 120–400ms of that budget. Two providers dominate procurement checklists: ElevenLabs and PlayHT. The decision between them is no longer about which one sounds “more human” in a vacuum. It is about measurable word error rates in noisy environments, streaming latency under concurrent load, phoneme-level control for non-English languages, and the hard dollar cost when a single agent handles 12,000 calls per month. This article pins the evaluation to specific model snapshots and benchmark figures recorded in Q1 2025, avoiding the subjective audio demos that have muddied earlier comparisons.

## Model Architecture and Voice Customization

The core differentiation in mid-2025 lies in how each platform approaches voice generation. ElevenLabs has doubled down on its proprietary transformer-based model, while PlayHT has shifted its architecture to a modified decoder-only transformer that it calls PlayDialog. The practical consequence is a divergence in cloning fidelity, prosody control, and the latency-to-quality trade-off curve.

### ElevenLabs Turbo v2.5 vs PlayHT PlayDialog 1.0

ElevenLabs’ workhorse for real-time agents is Turbo v2.5, released 2024-11-12. It operates as a distilled version of the company’s Multilingual v2 model, optimized for streaming via chunked transfer encoding. In benchmarks conducted by Vapi on 2025-01-20, Turbo v2.5 achieved a mean time-to-first-audio (TTFA) of 98ms on a 10-word English sentence, measured from the moment the LLM token stream concluded to the first audio byte arriving at the client. PlayHT’s PlayDialog 1.0, released 2025-02-03, recorded a TTFA of 134ms on the same hardware (AWS c7g.xlarge, us-east-1). The 36ms delta is perceptible in a turn-based conversation but becomes less significant when network jitter exceeds 50ms. Where Turbo v2.5 pulls ahead is in streaming continuity; it buffers 3 tokens before generating audio, whereas PlayDialog 1.0 buffers 5 tokens, introducing a slightly longer initial pause on complex sentences.

### Voice Cloning Fidelity and Emotion Control

For voice cloning, ElevenLabs requires 60 seconds of reference audio to generate an instant clone with its 2025-01-07 model revision. The clone retains speaker identity with a 4.2% equal error rate (EER) on the VoxCeleb1 test set, as reported in ElevenLabs’ technical disclosure on 2025-02-18. PlayHT’s instant clone, using its 2025-03-01 model, requires 30 seconds of audio and achieves a 5.1% EER on the same benchmark. The gap widens for non-English languages: ElevenLabs’ multilingual cloning maintains sub-6% EER across Hindi, Japanese, and Arabic, while PlayHT’s EER rises to 8.7% for Arabic, per a third-party audit by Speechmatics published 2025-03-12. Emotion control remains a weak point for both. ElevenLabs exposes a “style exaggeration” slider (0.0–1.0) that modulates prosody variance. PlayHT offers discrete emotion tags (“happy,” “sad,” “angry”) that function as prepended control tokens. In testing, the tag-based approach produced more dramatic but less consistent results; “angry” on PlayHT sometimes introduced clipping artifacts at amplitudes above -3dBFS.

## Latency and Streaming Performance Under Load

Real-time voice agents require consistent performance not just for a single request but under concurrent session loads typical of a customer support queue or an outbound dialer campaign. The numbers below come from a benchmark run by Retell AI on 2025-03-28, simulating 100 concurrent WebRTC streams with a 20ms audio packet interval.

### Time-to-First-Audio and End-to-End Latency

Under 100 concurrent streams, ElevenLabs Turbo v2.5 recorded a P50 TTFA of 112ms and a P99 of 287ms. PlayHT PlayDialog 1.0 recorded a P50 of 141ms and a P99 of 412ms. The P99 figure for PlayHT crossed the 400ms threshold that several voice agent platforms flag as the point where users begin to interrupt or repeat themselves. End-to-end latency, measured from the end of user speech to the start of agent audio, averaged 643ms for ElevenLabs and 712ms for PlayHT when paired with gpt-4o-realtime-preview-2024-12-17 on Azure East US. The 69ms difference is attributable to both the TTS buffering strategy and the fact that ElevenLabs’ API gateway terminates TLS closer to the inference node.

### Streaming Stability and Audio Chunk Delivery

Streaming stability is measured by the number of audio underrun events per 1,000 streaming minutes. ElevenLabs recorded 2.1 underruns per 1,000 minutes; PlayHT recorded 8.4. An underrun occurs when the audio buffer on the client side empties before the next chunk arrives, producing an audible gap. PlayHT’s higher underrun rate correlates with its 5-token buffering requirement; on sentences with low token counts (fewer than 8 tokens), the model sometimes waits for additional tokens that never arrive, triggering a timeout. ElevenLabs mitigates this with a padding strategy that appends silence after the final token if the sentence is shorter than 3 tokens. Neither provider guarantees sub-200ms P99 latency in their SLAs as of April 2025. ElevenLabs’ enterprise SLA commits to 99.5% uptime but does not bind latency percentiles. PlayHT’s SLA similarly omits latency guarantees, stating only “commercially reasonable efforts” for real-time streaming.

## Multilingual Capabilities and Pronunciation Control

Voice agents deployed in Southeast Asia, the Middle East, and Europe require more than just language support; they need phoneme-level control for proper nouns, code-switching between languages, and dialect-specific pronunciation.

### Language Breadth and Code-Switching

ElevenLabs supports 29 languages as of its 2025-03-15 model update. PlayHT supports 142 languages and dialects, a number that includes regional variants like Moroccan Arabic (ary) and Swiss German (gsw). The raw count favors PlayHT, but the quality per language tells a different story. For the 29 languages where they overlap, ElevenLabs achieves a mean opinion score (MOS) of 4.12 on a 1–5 scale, while PlayHT scores 3.87, per a crowd-sourced evaluation by Deepgram published 2025-02-28. The gap is most pronounced in tonal languages: ElevenLabs’ Mandarin (zh-CN) MOS is 4.31 versus PlayHT’s 3.64. PlayHT’s advantage emerges in low-resource languages like Swahili (sw) and Amharic (am), where ElevenLabs has no support and PlayHT achieves MOS scores of 3.21 and 2.98, respectively. For code-switching, where a single sentence mixes two languages, ElevenLabs handles English-Spanish and English-Hindi pairs with fewer than 1.2% phoneme errors. PlayHT’s code-switching error rate is 3.8% on the same pairs, often defaulting to the dominant language’s phoneme set for the minority language’s words.

### SSML Support and Pronunciation Customization

Both providers support a subset of Speech Synthesis Markup Language (SSML). ElevenLabs implements `<phoneme>`, `<break>`, `<prosody>`, and `<say-as>` tags. PlayHT supports the same set but adds `<voice>` for multi-speaker synthesis within a single request. The `<phoneme>` tag is where the practical difference lies. ElevenLabs accepts both IPA and X-SAMPA alphabets and respects the provided phoneme string with high fidelity in 24 of its 29 languages. PlayHT’s phoneme parser is less reliable outside English; in testing with Japanese proper nouns on 2025-04-02, PlayHT ignored custom phonemes in 12% of cases and fell back to its grapheme-to-phoneme model. For voice agents that must pronounce customer names or technical product codes correctly, this is a material limitation.

## Pricing, Rate Limits, and Enterprise SLAs

Cost modeling for production voice agents requires factoring in not just the per-character price but the concurrency limits, overage behavior, and the hidden cost of retries due to failed or slow requests.

### Per-Character and Per-Request Pricing

ElevenLabs Turbo v2.5 is priced at US$0.015 per 1,000 characters as of 2025-04-01. PlayHT PlayDialog 1.0 is priced at US$0.012 per 1,000 characters on its pay-as-you-go plan. For a voice agent handling 12,000 calls per month with an average of 800 characters of generated speech per call, the monthly TTS cost is US$144.00 on ElevenLabs and US$115.20 on PlayHT. The US$28.80 monthly difference is negligible for most teams, but PlayHT’s lower price comes with a concurrency cap of 50 simultaneous streams on the standard plan, versus ElevenLabs’ 100 streams. Teams exceeding 50 concurrent sessions on PlayHT must upgrade to an enterprise plan with custom pricing that typically starts at US$0.018 per 1,000 characters, erasing the cost advantage. ElevenLabs’ enterprise plan, for teams above 200 concurrent streams, drops to US$0.012 per 1,000 characters, matching PlayHT’s entry-level price at higher volume.

### Rate Limits and Overage Behavior

ElevenLabs enforces a hard rate limit of 120 concurrent streams on its standard plan, returning HTTP 429 responses for requests beyond that. PlayHT’s standard plan queues requests beyond 50 concurrent streams for up to 3 seconds before returning a 429. The queuing behavior is documented in PlayHT’s API reference updated 2025-03-20. In practice, this means PlayHT can absorb short bursts above the concurrency limit without dropping requests, but the queued requests experience added latency of 1.2–2.8 seconds, which is unacceptable for real-time voice agents. ElevenLabs’ approach fails fast, allowing the agent framework to retry or fall back to a cached audio response. Neither provider offers a financially backed latency SLA in their standard plans. ElevenLabs’ enterprise SLA includes a 99.9% availability commitment with service credits of 10% of monthly fees for each 30-minute period of downtime beyond the threshold. PlayHT’s enterprise SLA matches the 99.9% availability but limits service credits to 5% of monthly fees per incident.

## Actionable Takeaways for Voice Agent Builders

For teams shipping real-time voice agents in Q2 2025, the ElevenLabs versus PlayHT decision reduces to the specific constraints of the deployment. The following points summarize the data above into concrete procurement guidance.

First, if the agent serves a multilingual user base that includes tonal languages (Mandarin, Vietnamese, Thai) or requires phoneme-level control for proper nouns, ElevenLabs Turbo v2.5 is the lower-risk choice. Its 4.31 MOS for Mandarin versus PlayHT’s 3.64 and its reliable `<phoneme>` parsing in 24 languages outweigh the US$0.003 per 1,000 characters premium.

Second, if the agent targets low-resource languages where ElevenLabs has no coverage, PlayHT is the only viable option between the two. Swahili and Amharic support at MOS scores above 2.9 is usable for information-delivery agents, though not for high-stakes customer service.

Third, for latency-sensitive deployments where P99 TTFA must stay below 300ms, ElevenLabs’ measured P99 of 287ms under 100 concurrent streams makes it the default. PlayHT’s P99 of 412ms crosses the threshold where users perceive hesitation. Teams building on Vapi or Retell should configure their TTS timeout to 350ms and expect a higher retry rate if using PlayHT.

Fourth, cost-conscious teams with predictable concurrency below 50 streams and no tonal language requirements can save 20% on TTS costs by using PlayHT. The US$115.20 monthly cost for 12,000 calls is lower than ElevenLabs’ US$144.00, and the queuing behavior for short bursts provides a buffer against traffic spikes.

Fifth, neither provider should be used without a fallback TTS endpoint. Deepgram Aura, priced at US$0.015 per 1,000 characters as of 2025-04-01, offers a P99 TTFA of 180ms and serves as a reliable secondary for English-only agents. Architecting the voice pipeline with a TTS abstraction layer that can route to a fallback on 429 responses or P99 latency breaches is standard practice for production deployments as of April 2025.
