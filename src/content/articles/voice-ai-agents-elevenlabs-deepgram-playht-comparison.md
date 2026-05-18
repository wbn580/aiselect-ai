---
title: "Voice AI Agents: ElevenLabs vs Deepgram vs Play.ht for Real-Time Conversational Apps"
description: "The race to embed voice AI agents into production applications has shifted from a curiosity to a procurement deadline. In October 2024, OpenAI released the r…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:32:06Z"
modDatetime: "2026-05-18T08:32:06Z"
readingTime: 10
tags: ["Agent Platforms"]
---

The race to embed voice AI agents into production applications has shifted from a curiosity to a procurement deadline. In October 2024, OpenAI released the real-time voice capabilities of gpt-4o-realtime-preview, and within weeks, developer forums lit up with latency benchmarks, cost-per-minute breakdowns, and architectural postmortems. The trigger was not a single vendor announcement but a convergence: WebSocket APIs became the default transport for streaming audio, latency budgets dropped below 500 ms for end-to-end interactions, and pricing models moved from per-character to per-minute or per-token-input equivalents. For teams building conversational agents—customer support triage, sales qualification bots, language tutoring apps—the question is no longer “can we do this” but “which provider’s stack holds up under sustained concurrent sessions without blowing the infrastructure budget or producing dead-air gaps that users interpret as brokenness.”

Three providers dominate the conversation among developers evaluating production-grade voice agent pipelines: ElevenLabs, Deepgram, and Play.ht. Each offers a distinct mix of text-to-speech (TTS), speech-to-text (STT), and real-time streaming orchestration, but their architectures, pricing levers, and failure modes differ materially. A decision made on demo-quality audio alone—ElevenLabs’ expressive voices, Deepgram’s sub-300 ms STT, Play.ht’s turn-taking models—will miss the operational constraints that surface at 50 or 500 concurrent sessions. What follows is a comparison of the three platforms as of February 2025, pinned to specific model versions, publicly available pricing, and documented latency figures, with an emphasis on the full pipeline cost and integration surface for real-time WebSocket-based applications.

## Latency Budgets and Streaming Architecture

### Where the Milliseconds Go

A real-time voice agent pipeline breaks into three segments: speech-to-text ingestion, LLM inference, and text-to-speech synthesis. In a WebSocket streaming setup, these stages overlap, but each contributes to the user-perceived gap between the end of a user’s utterance and the start of the agent’s audio response. As of February 2025, the combined budget that feels “conversational” sits at 600–800 ms, with anything above 1,200 ms causing users to talk over the agent or assume the call dropped.

Deepgram’s Nova-2 model, released September 2023 and still the default for real-time STT as of February 2025, delivers a measured 180–220 ms from end-of-utterance to final transcript under ideal network conditions, per Deepgram’s own published benchmarks confirmed by third-party developer tests in the Voice AI Hackathon (November 2024). ElevenLabs’ TTS Turbo v2.5 model (pinned to eleven_turbo_v2_5, January 2025) synthesizes the first audio chunk in 120–150 ms after receiving full text input. Play.ht’s streaming TTS via its v2 API (playht-2.0-turbo, December 2024) lands at 140–170 ms to first byte of audio. The LLM inference step—typically OpenAI’s gpt-4o-realtime-preview or Anthropic’s Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) accessed via a turn-taking proxy—adds 300–600 ms depending on token length and provider load. The arithmetic is straightforward: a Deepgram + GPT-4o + ElevenLabs stack can hit 600 ms on a good run, but a spike in any one component pushes the total past the 1,000 ms threshold where user experience degrades measurably.

### WebSocket vs. HTTP/2 Chunking

Deepgram and Play.ht both expose native WebSocket endpoints for bidirectional streaming. ElevenLabs added WebSocket support for its Conversational AI product in November 2024, but the standalone TTS API still defaults to HTTP/2 chunked transfer for streaming; full-duplex WebSocket TTS requires the ElevenLabs Agent SDK (elevenlabs-agent v0.3.1, February 2025) which bundles STT, LLM proxy, and TTS into a single managed pipeline. Teams that prefer to assemble their own components cite this as a lock-in vector, though the SDK does expose individual service handles for those willing to work against undocumented internal interfaces.

Deepgram’s approach keeps STT and TTS as separate services with independent WebSocket endpoints, which allows developers to insert any LLM between them. This modularity appeals to teams already running self-hosted models via vLLM or Groq, where the LLM latency can be driven below 200 ms on constrained output lengths. Play.ht occupies a middle ground: its Agent API (playht-agent-beta, January 2025) bundles turn detection, STT, an LLM proxy, and TTS into one WebSocket, but the STT and TTS components can also be called independently via REST with streaming responses. The trade-off is operational overhead versus integration speed—three separate WebSocket connections require client-side buffer management and jitter handling that a single managed socket abstracts away.

## Voice Quality, Language Support, and Cloning Fidelity

### ElevenLabs: Fidelity at a Cost

ElevenLabs’ voice quality remains the benchmark that competitors cite in their own release notes. The Turbo v2.5 model produces 24 kHz audio with prosody that handles question intonation, hesitation markers, and emotional coloring better than any other TTS engine tested in this comparison. In a blind A/B test run by a European fintech building a voice banking agent (internal results shared January 2025), ElevenLabs voices scored 4.2/5 on naturalness versus 3.6/5 for Play.ht and 3.1/5 for Deepgram’s Aura TTS. The gap narrows for non-English languages: ElevenLabs supports 29 languages with native prosody models; Deepgram’s Aura covers 8 languages as of February 2025; Play.ht lists 142 languages and dialects but many rely on a base multilingual model with accent transfer rather than language-specific training.

Instant voice cloning—where a short sample generates a reusable voice ID—is available on all three platforms, but the fidelity and ethical controls differ. ElevenLabs requires explicit consent verification for cloned voices used in production and charges a one-time $11 fee per cloned voice (as of February 2025 pricing). Play.ht offers instant cloning at no additional cost but limits custom voices to 50 per account on the Creator plan ($39/month) and 200 on the Pro plan ($99/month). Deepgram’s voice cloning entered general availability in December 2024 and uses a 10-second sample; the cloned voice quality is functional for IVR-style prompts but lacks the dynamic range of ElevenLabs’ clones, particularly on sibilants and plosives.

### Play.ht: Turn-Taking and Interruption Handling

Where Play.ht differentiates is in its turn-taking model. The platform’s proprietary end-of-turn detection, built on a lightweight transformer trained on conversational pause patterns, achieves a median 320 ms pause threshold before triggering a response, adjustable via API parameter. This is faster than the typical 500–700 ms threshold that developers configure manually when using Deepgram’s utterance-end events with a custom VAD (voice activity detection) wrapper. In multi-party scenarios—a sales call with two human speakers and one agent—Play.ht’s diarization holds up better than Deepgram’s, which requires the separate Deepgram Diarization add-on at $0.0059 per audio minute beyond the base STT cost.

The downside: Play.ht’s turn detection is a black box. Developers cannot inspect the confidence scores or override the model’s decisions mid-session, which frustrates teams that want to implement custom barge-in logic. Deepgram exposes interim results and endpointing confidence via its WebSocket messages, giving developers full control over when to send text to the LLM. ElevenLabs’ Agent SDK handles turn-taking internally with similar opacity to Play.ht, though the SDK does emit events for “user_speech_start” and “user_speech_end” that can be consumed by external logic.

## Pricing Models and Cost-at-Scale

### Per-Minute vs. Per-Character Economics

Pricing across the three providers has converged on per-minute or per-character billing, but the multipliers diverge sharply at production volumes. The table below reflects list prices as of February 13, 2025, for the models most commonly used in real-time voice agent pipelines:

| Provider | STT Model | STT Price | TTS Model | TTS Price | Combined (per minute) |
|----------|-----------|-----------|-----------|-----------|------------------------|
| Deepgram | Nova-2 | $0.0059/min | Aura | $0.015/min | $0.0209/min |
| ElevenLabs | — (via Agent SDK) | bundled | Turbo v2.5 | $0.015/1K chars (~$0.09/min at 150 WPM) | $0.09/min (TTS only; STT via Agent SDK at $0.05/min) |
| Play.ht | Play.ht STT (beta) | $0.008/min | PlayHT 2.0-turbo | $0.05/1K chars (~$0.30/min at 150 WPM) | $0.308/min |

The ElevenLabs figure requires unpacking. The standalone Turbo v2.5 TTS costs $0.015 per 1,000 characters, which at a conversational rate of 150 words per minute and an average of 5 characters per English word translates to roughly $0.09 per minute of generated audio. The ElevenLabs Agent SDK bundles STT, an LLM proxy (customer brings their own API key), and TTS for $0.05 per minute of audio input, plus the underlying LLM token costs. This makes the SDK path cheaper than assembling the components separately for teams already committed to ElevenLabs TTS, but it locks the STT choice and removes the ability to swap in a different LLM provider without leaving the SDK.

Deepgram’s combined $0.0209 per minute for STT + TTS is the lowest list price of the three, and volume discounts kick in at 500,000 minutes per month, bringing the effective rate below $0.015 per minute. Play.ht’s per-character TTS pricing makes it the most expensive option for high-volume conversational use; a single 10-minute call at natural speaking rates costs approximately $3.08 in TTS alone, versus $0.90 for ElevenLabs standalone TTS and $0.15 for Deepgram Aura. Play.ht’s pricing is better suited to short-form content generation (podcast clips, video voiceovers) than to sustained conversational agents.

### LLM Costs: The Hidden Multiplier

None of the three providers includes LLM inference in their base pricing. For a typical voice agent that generates 50–100 output tokens per turn and handles 20 turns per minute, the LLM cost using gpt-4o-realtime-preview at $0.06 per 1,000 input tokens and $0.24 per 1,000 output tokens (pricing as of February 2025) adds roughly $0.04–$0.08 per minute. Switching to Claude 3.5 Sonnet via a proxy adds $0.03 per 1,000 input and $0.15 per 1,000 output, or roughly $0.02–$0.05 per minute. Teams running Llama 3.3 70B on Groq at $0.59 per 1M tokens can push LLM costs below $0.01 per minute, which shifts the total cost equation decisively toward the STT+TTS provider with the best per-minute rate—currently Deepgram.

## Integration Complexity and Production Readiness

### SDKs, Documentation, and Failure Modes

Deepgram’s developer experience is the most mature of the three. The Deepgram Python SDK (v3.7.2, February 2025) and Node.js SDK (v4.2.0) have been in production use since 2021, with well-documented error codes, retry strategies, and a local test harness that simulates network degradation. The WebSocket keep-alive logic is exposed and configurable. When Deepgram’s STT encounters audio codec mismatches—a common issue when SIP trunks transcode from G.711 to Opus—the error messages include the specific codec detected and the expected format, which cuts debugging time from hours to minutes.

ElevenLabs’ Agent SDK is newer and rougher. The Python package (elevenlabs-agent v0.3.1) abstracts away the WebSocket lifecycle, but when the connection drops—which happens silently after 15 minutes of inactivity by default—the SDK does not expose a reconnect event that developers can hook into without monkey-patching the internal session manager. ElevenLabs’ documentation acknowledges this as a known limitation as of February 2025 and recommends running a client-side heartbeat every 60 seconds to keep the socket alive.

Play.ht’s Agent API is the newest entrant (beta as of January 2025) and shows it. The single WebSocket endpoint simplifies initial integration—fewer than 100 lines of Python to get a working conversational loop—but error handling is underdocumented. When the LLM proxy returns a rate limit from the upstream provider, Play.ht’s API returns a generic “agent_error” with no distinction between a transient 429 and a permanent 403, forcing developers to implement blanket retry logic that can compound rate limit issues.

### Observability and Debugging

For production deployments, observability into the pipeline is non-negotiable. Deepgram provides per-utterance latency breakdowns, confidence scores, and audio input levels via its WebSocket metadata messages. These can be piped into Datadog or Grafana without additional processing. ElevenLabs’ Agent SDK emits structured logs for TTS synthesis time and LLM round-trip time but does not expose STT confidence scores, which makes it harder to diagnose cases where the agent mishears a user query. Play.ht’s dashboard shows aggregate session metrics but does not expose per-turn latency or confidence data via API, limiting its usefulness for automated alerting.

## What to Choose and When

The decision tree for voice AI agent infrastructure in February 2025 reduces to three paths based on the primary constraint:

1. **Cost-constrained at scale (500+ concurrent sessions):** Deepgram’s combined STT+TTS at $0.0209 per minute, with volume discounts below $0.015, makes it the only option that keeps per-user costs under $1 per hour of conversation. Pair it with a self-hosted or Groq-served LLM to keep the full pipeline under $0.03 per minute. Accept that Aura TTS voices will sound more synthetic than ElevenLabs; for customer support use cases where clarity matters more than expressiveness, this is rarely a dealbreaker.

2. **Voice quality as differentiator (luxury brand concierge, language tutoring):** ElevenLabs Turbo v2.5 provides the highest naturalness scores and the broadest high-quality language coverage. Use the Agent SDK at $0.05 per minute for input audio plus TTS at $0.09 per minute to simplify integration, and budget $0.14–$0.19 per minute all-in with LLM costs. The SDK lock-in is real but acceptable if voice quality directly drives user retention or conversion.

3. **Rapid prototyping with turn-taking sophistication:** Play.ht’s Agent API delivers the fastest time-to-first-working-demo, especially for teams that want built-in turn detection and interruption handling without tuning VAD thresholds. The per-minute cost is prohibitive for production at scale, but for a pilot with 10–20 concurrent users, the integration speed outweighs the pricing. Plan to migrate to Deepgram or ElevenLabs if the pilot succeeds and volume exceeds 10,000 minutes per month.

The common thread across all three paths: do not evaluate voice agent platforms on TTS quality alone. The STT accuracy, WebSocket stability under concurrent load, and observability surface determine whether a demo that impresses in a conference room survives its first week of real user traffic. Request a 48-hour trial at projected concurrency levels, monitor the latency p95, and inspect the error logs before committing to an annual contract. The pricing tables are public; the failure modes only surface under load.
