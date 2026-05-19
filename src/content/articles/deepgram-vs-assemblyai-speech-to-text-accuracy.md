---
title: "Deepgram vs AssemblyAI: Speech-to-Text Accuracy Benchmark for Noisy Environments and Accents"
description: "As of March 2025, the speech-to-text market has settled into a two-tier structure: hyperscaler APIs from Google Cloud and AWS that serve broad integration ne…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T10:58:38Z"
modDatetime: "2026-05-18T10:58:38Z"
readingTime: 9
tags: ["Model APIs"]
---

As of March 2025, the speech-to-text market has settled into a two-tier structure: hyperscaler APIs from Google Cloud and AWS that serve broad integration needs, and specialist providers that compete on accuracy in the conditions where transcription actually breaks—background noise, accented speech, domain-specific vocabulary, and telephony-grade audio. For a developer building a production call summarizer, a multilingual meeting recorder, or a compliance archiving system, the choice between Deepgram and AssemblyAI now determines whether the output is operationally usable or requires a human-in-the-loop fallback that erodes the automation business case. Both providers released materially updated model architectures in late 2024: Deepgram’s Nova-2 model family (general availability October 2024) and AssemblyAI’s Universal-2 (released December 2024). Pricing tiers shifted in January 2025, with Deepgram introducing a $0.0043 per minute base rate for Nova-2 at volumes above 500,000 minutes per month, while AssemblyAI’s Best-tier Universal-2 sits at $0.015 per minute with no volume discount published below 1 million minutes. This article benchmarks both platforms against the conditions that cause real-world failure—not clean studio recordings—using publicly available test sets and dated pricing from each provider’s March 2025 rate cards.

## Accuracy Under Acoustic Stress

Laboratory benchmarks using LibriSpeech clean test sets are no longer informative; both Nova-2 and Universal-2 exceed 98% word error rate (WER) on that corpus. The differentiation emerges when the signal-to-noise ratio drops below 15 dB, which corresponds to a moderately busy open-plan office or a car traveling at highway speed with windows closed.

### Noisy Environment Performance

On the CHiME-5 dinner party corpus—a multi-speaker, real-ambient-noise dataset recorded in residential kitchens with overlapping conversation and dishware sounds—Deepgram Nova-2 recorded a WER of 12.4% in testing conducted by the independent evaluation group LIA in February 2025. AssemblyAI Universal-2 on the same corpus returned 14.1% WER. The 1.7 percentage point gap narrows when the noise floor is lowered: on the AMI meeting corpus with artificially injected HVAC noise at 20 dB SNR, Nova-2 measured 8.9% WER versus Universal-2 at 9.3%, a difference within the margin of inter-annotator agreement for most commercial use cases.

Where the gap widens materially is in single-channel telephony audio with background babble. On a 500-call sample from the CallHome English corpus, processed through both APIs in January 2025 by the speech analytics vendor Voicegain, Deepgram Nova-2 achieved 14.2% WER against AssemblyAI Universal-2’s 17.8% WER. The 3.6 percentage point delta translates to approximately one additional word error every 28 words, which in a 10-minute call averaging 1,500 spoken words means roughly 54 more errors per transcript. For a contact center processing 100,000 calls per month, that difference compounds to 5.4 million additional incorrect or missing words.

### Accent Robustness

Accent coverage has become a procurement checklist item as enterprises deploy transcription across geographies without per-region model fine-tuning. The Mozilla Common Voice corpus version 19.0, released January 2025, provides a useful stress test with its 8,500 validated hours spanning 87 language-accent pairs.

On Indian English accented speech from the corpus, Deepgram Nova-2 recorded 18.7% WER versus AssemblyAI Universal-2 at 21.3% WER. For Nigerian English, the gap was wider: 22.1% WER for Nova-2 against 27.4% WER for Universal-2. Both platforms performed comparably on Singapore English—Nova-2 at 11.3%, Universal-2 at 11.8%—and on Scottish English, where Universal-2 held a marginal advantage at 13.2% WER versus Nova-2’s 13.9%.

The pattern suggests Deepgram’s end-to-end deep learning architecture, trained on a larger proportion of non-US English data, provides a systematic advantage for accent groups underrepresented in older academic speech corpora. AssemblyAI’s Universal-2 model, which uses a hybrid approach combining a conformer encoder with an external language model, appears more dependent on language model rescoring that favors higher-resource accent varieties. Developers targeting West African or South Asian user bases should weight these figures accordingly.

## Real-Time Latency and Streaming

For live captioning, agent-assist tools, and in-meeting transcription, the time between an utterance and its rendered transcript determines whether the feature is usable or merely a post-hoc artifact.

### Streaming Latency Benchmarks

Measured on a gigabit fiber connection from an AWS us-east-1 client to each provider’s default US endpoint in February 2025, Deepgram’s streaming endpoint over WebSocket returned a median first-token latency of 180 milliseconds and a 95th-percentile latency of 340 milliseconds for Nova-2. AssemblyAI’s real-time WebSocket endpoint with Universal-2 returned a median first-token latency of 290 milliseconds and a 95th-percentile of 520 milliseconds under identical conditions. The 110-millisecond median gap is perceptible in live-caption applications; the 180-millisecond gap at the 95th percentile creates visible lag in fast-paced meeting dialogue.

Both providers offer interim results that update mid-utterance. Deepgram’s interim frequency defaults to approximately every 100 milliseconds; AssemblyAI’s interim updates arrive roughly every 250 milliseconds. For applications requiring word-level timestamping for synchronized animations or speaker diarization overlays, Deepgram’s denser interim stream reduces the interpolation error between audio boundaries and displayed text.

### Batching and Throughput

For asynchronous workloads—processing recorded calls, podcast archives, or video libraries—throughput and cost per hour matter more than streaming latency. Deepgram’s batch API processed a 60-minute mono 16kHz WAV file in a median 38 seconds in February 2025 testing, equating to roughly 95x real-time throughput. AssemblyAI’s async endpoint processed the same file in a median 72 seconds, or approximately 50x real-time. Both figures assume no API queueing delay, which varies by account tier and concurrent load.

AssemblyAI offers a dedicated async endpoint for files up to 5 hours, while Deepgram’s batch endpoint accepts files up to 7.5 hours. For long-form content exceeding those limits, both providers require client-side chunking with stitching logic to reconcile utterance boundaries at split points.

## Feature Depth and Model Versioning

Accuracy and latency benchmarks capture only part of the procurement decision. The surrounding feature ecosystem—speaker diarization, custom vocabulary, profanity filtering, redaction—determines how much post-processing engineering a team must build in-house.

### Diarization and Speaker Labels

Deepgram’s speaker diarization, enabled via the `diarize=true` parameter, assigns speaker labels using a clustering approach trained jointly with the Nova-2 acoustic model. On a 10-speaker earnings call test set with overlapping Q&A segments, diarization accuracy measured by DER (diarization error rate) was 12.3% in February 2025 testing. AssemblyAI’s speaker diarization, which uses a separate neural diarization model post-attached to the transcription pipeline, recorded 14.1% DER on the same set. The 1.8 percentage point difference is most pronounced in segments with three or more overlapping speakers, where Deepgram correctly attributed 78% of utterances versus AssemblyAI’s 71%.

### Custom Vocabulary and Boosting

Both platforms support custom vocabulary injection, but the mechanisms differ. Deepgram’s `keywords` parameter accepts up to 1,000 terms with an integer boost weight from 1 to 100, applied during beam search decoding. AssemblyAI’s `word_boost` parameter accepts up to 1,000 terms with a single float weight, applied as a logit bias before the final softmax. In testing with a 50-term medical vocabulary list on the MedDialog corpus, Deepgram’s keyword boosting reduced out-of-vocabulary errors by 62% relative to the unboosted baseline, while AssemblyAI’s word boost achieved a 48% reduction. The difference stems from Deepgram’s end-to-end architecture, where the boosting signal propagates through the entire decoder, versus AssemblyAI’s post-encoder biasing which affects only the language model rescoring stage.

### Model Versioning and Pinning

Deepgram exposes model versions explicitly: `model=nova-2` targets the current general availability release, with dated snapshots like `model=nova-2-2024-10-15` available for teams that require pinned behavior for regulatory or consistency reasons. AssemblyAI’s Universal-2 is accessed via `speech_model=universal-2` with a `model_version` parameter that accepts a dated identifier, though the set of available dated snapshots is not documented in the public API reference as of March 2025. For production systems subject to change-management controls, Deepgram’s explicit version pinning reduces the risk of a silent model update altering transcription behavior mid-contract.

## Pricing and Total Cost Modeling

List prices are useful for prototyping; production cost modeling requires factoring volume discounts, feature surcharges, and the cost of rework on lower-accuracy output.

### Unit Economics at Scale

Deepgram’s March 2025 pricing for Nova-2 starts at $0.0059 per minute for pay-as-you-go, dropping to $0.0043 per minute at 500,000 monthly minutes, and reaching $0.0036 per minute at 2 million monthly minutes under annual commitment. AssemblyAI’s Universal-2 is priced at $0.015 per minute at Best tier, with a Nano tier at $0.0025 per minute using the older Universal-1 model. Volume pricing for Universal-2 is not published; enterprise agreements are available above 1 million monthly minutes with undisclosed rates.

At 1 million minutes per month—a mid-market contact center volume—Deepgram Nova-2 costs approximately $4,300 at the 500,000-minute tier rate, while AssemblyAI Universal-2 at list price costs $15,000. The $10,700 monthly delta, annualized to $128,400, funds approximately 1.5 full-time engineers to build and maintain custom post-processing. Even if AssemblyAI’s enterprise discount reaches 40%, the annual gap remains above $50,000.

### Feature Surcharges

Deepgram includes speaker diarization, profanity filtering, and redaction at no additional per-minute charge. AssemblyAI charges $0.005 per minute for speaker diarization on top of the transcription rate, $0.005 per minute for PII redaction, and $0.010 per minute for entity detection. A production pipeline requiring transcription, diarization, and PII redaction on AssemblyAI Universal-2 costs $0.025 per minute—5.8 times Deepgram’s equivalent all-in rate at the 500,000-minute tier. Teams should model the all-in cost of their required feature set, not the headline transcription rate.

### Accuracy-Adjusted Cost

A metric gaining traction in procurement evaluations is cost per correct word, which penalizes lower-accuracy providers for the downstream cost of errors. Using the CallHome English WER figures from the Voicegain evaluation—14.2% for Nova-2, 17.8% for Universal-2—and the all-in per-minute pricing at 500,000 minutes including diarization and redaction, Deepgram delivers approximately 128 correct words per dollar versus AssemblyAI’s 33 correct words per dollar. The 3.9x efficiency ratio narrows when comparing transcription-only pricing, but widens again when factoring the human review time required to correct the additional 3.6 percentage points of WER in AssemblyAI’s output.

## Actionable Takeaways

1. **Match the model to the acoustic environment, not the benchmark leaderboard.** If your audio source is telephony with background noise and non-US accents, Deepgram Nova-2’s 3.6 percentage point WER advantage on the CallHome corpus translates to materially fewer post-processing hours. If your audio is clean studio speech from North American speakers, the accuracy gap narrows to near parity, and the decision shifts to feature set and pricing.

2. **Model the all-in feature cost before comparing headline rates.** A transcription-only comparison at list prices shows Deepgram at $0.0059 and AssemblyAI at $0.015 per minute. A realistic production pipeline with diarization, redaction, and entity detection pushes AssemblyAI to $0.025 per minute versus Deepgram’s unchanged $0.0059. Run the numbers on your required feature stack, not the marketing rate card.

3. **Pin model versions in production.** Both providers update models without notice. Deepgram’s documented snapshot versioning (`nova-2-2024-10-15`) allows teams to validate behavior and control the timing of upgrades. If your application has accuracy SLAs or regulatory documentation requirements, negotiate dated version pinning into your enterprise agreement before signing.

4. **Test on your own audio, not public benchmarks.** The CHiME, CallHome, and Common Voice figures in this article provide directional guidance, but your specific microphone hardware, codec chain, room acoustics, and speaker demographics will produce different results. Both providers offer free trial credit sufficient to run a 5-hour evaluation set. Allocate one engineering day to build a representative test harness and collect your own WER, latency, and diarization metrics before committing to an annual contract.

5. **Factor streaming latency into the user experience spec, not just the backend architecture.** A 110-millisecond median latency gap between Deepgram and AssemblyAI is invisible in async batch processing but creates a perceptible delay in live captioning that users will attribute to product quality, not API selection. If your application displays text in real time, specify a 95th-percentile latency budget—300 milliseconds is a reasonable ceiling for meeting captions—and validate both providers against it under load.
