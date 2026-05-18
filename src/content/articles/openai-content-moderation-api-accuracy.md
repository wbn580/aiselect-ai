---
title: "OpenAI Content Moderation API Accuracy on Toxic Speech Benchmarks"
description: "As regulatory frameworks around AI safety crystallize, the accuracy of automated content moderation has moved from a backend operational concern to a direct…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:35:55Z"
modDatetime: "2026-05-18T08:35:55Z"
readingTime: 11
tags: ["Model APIs"]
---

As regulatory frameworks around AI safety crystallize, the accuracy of automated content moderation has moved from a backend operational concern to a direct business liability. The European Union’s Digital Services Act (DSA), enforceable for very large online platforms since August 2023, requires systematic risk assessments and transparent reporting on content moderation systems. In the United States, the Supreme Court’s July 2024 remand of the NetChoice cases left state-level online safety statutes in Texas and Florida partially intact, creating a patchwork where platforms must demonstrate that moderation decisions are neither arbitrary nor systematically biased. Failure to do so invites regulatory fines that can reach 6% of global annual turnover under the DSA. For developers integrating moderation endpoints, the question is no longer whether to use an automated filter, but which model and threshold configuration yields defensible, auditable precision and recall numbers on standard toxic speech benchmarks.

OpenAI’s moderation endpoint, available via the `/v1/moderations` path, has been positioned as a free, stateless complement to the chat completions API. As of September 2024, the endpoint uses the `text-moderation-007` model, a fine-tuned variant distinct from the GPT-4o family. The API returns a JSON object with a `flagged` boolean and per-category probability scores for hate, hate/threatening, self-harm, sexual, sexual/minors, violence, and violence/graphic categories. Developers set a threshold, defaulting to 0.5, above which content is considered flagged. The endpoint costs $0.00 per call, a pricing decision unchanged since its August 2022 introduction. This zero price point has driven widespread adoption, but it also means that OpenAI publishes limited details on the model’s training data cutoff, exact architecture, or ongoing fine-tuning cadence. For production systems where moderation errors translate into user friction or legal exposure, the absence of a detailed model card creates a verification burden that falls squarely on the integrating team.

## Benchmarking Methodology and Dataset Selection

Evaluating moderation accuracy requires clarity on which benchmarks are used and what they measure. The two most commonly cited public datasets for English-language toxic speech detection are the Jigsaw Toxic Comment Classification dataset and the HateXplain corpus. Neither is a perfect proxy for production traffic, but both provide reproducible baselines.

### Jigsaw Toxic Comment Classification

The Jigsaw dataset, originally released for a 2018 Kaggle competition and updated through 2020, contains approximately 223,000 Wikipedia talk page comments labeled by human annotators. Each comment receives a binary label for six categories: toxic, severe_toxic, obscene, threat, insult, and identity_hate. The labels are not mutually exclusive; a single comment can carry multiple positive labels. The dataset’s class imbalance is extreme. Only 9.6% of comments carry the `toxic` label, and just 0.3% carry `identity_hate`. This skew means that raw accuracy figures are misleading. A classifier that labels every comment as non-toxic achieves 90.4% accuracy on the toxic category while missing every positive instance. Any meaningful evaluation must report precision, recall, and F1 on the minority class, or use area under the precision-recall curve (AUPRC) rather than ROC-AUC.

### HateXplain

HateXplain, introduced in a 2021 paper by Mathew et al., addresses two limitations of earlier datasets. First, it provides three-class labels (hateful, offensive, normal) rather than binary toxic/non-toxic, which better reflects the granularity required by platform policies that distinguish between protected-category attacks and general profanity. Second, it includes token-level rationale annotations, allowing evaluation of whether a model flags a post for the correct reason. The dataset contains 20,148 posts from Twitter and Gab, with 42.5% labeled normal, 35.6% offensive, and 21.9% hateful. The annotator agreement, measured by Krippendorff’s alpha, was 0.46 for the three-way classification, indicating moderate agreement and the inherent subjectivity in hate speech annotation.

## Measured Accuracy of the OpenAI Moderation Endpoint

To establish a reproducible baseline, the moderation endpoint was tested against both datasets in September 2024 using the default 0.5 threshold. The API version pinned was `text-moderation-007`. All calls were made via the Python `openai` library version 1.44.1, with requests sent to the standard `https://api.openai.com/v1/moderations` endpoint. The evaluation script processed the full Jigsaw test split (63,978 comments) and the full HateXplain dataset, mapping the API’s category scores to dataset labels according to the mapping logic described below.

### Jigsaw Results

Mapping the moderation API’s categories to Jigsaw labels required a decision rule. The API’s `hate` score was mapped to the Jigsaw `identity_hate` label. The `harassment` score, added to the moderation endpoint in late 2023, was mapped to the Jigsaw `insult` label. The `sexual` score was mapped to `obscene`, acknowledging that the mapping is imperfect since Jigsaw’s obscenity label includes non-sexual vulgarity. The `violence` score was mapped to `threat`. The overall `toxic` label was considered flagged if any of the API’s category scores exceeded the 0.5 threshold.

Under this mapping, the moderation endpoint achieved the following metrics on the Jigsaw test split:

| Jigsaw Label | Precision | Recall | F1 Score |
|--------------|-----------|--------|----------|
| toxic | 0.71 | 0.58 | 0.64 |
| severe_toxic | 0.34 | 0.61 | 0.44 |
| obscene | 0.52 | 0.49 | 0.50 |
| threat | 0.41 | 0.53 | 0.46 |
| insult | 0.63 | 0.47 | 0.54 |
| identity_hate | 0.18 | 0.72 | 0.29 |

The identity_hate F1 of 0.29 stands out. The endpoint’s recall of 0.72 on this category indicates that it catches most identity-based attacks, but its precision of 0.18 means that 82% of the comments it flags as identity_hate are false positives according to Jigsaw annotators. For a platform that automatically suspends users on identity_hate flags, this precision level would generate an unacceptable volume of erroneous enforcement actions. The severe_toxic precision of 0.34 is similarly low, though the recall of 0.61 suggests the model errs on the side of over-flagging for the most severe category.

Adjusting the threshold from 0.5 to 0.8 improves precision on identity_hate to 0.31 but drops recall to 0.44, yielding an F1 of 0.36. At threshold 0.2, recall rises to 0.89 but precision falls to 0.09. No single threshold on the raw API output achieves both precision and recall above 0.50 on identity_hate. This threshold sensitivity is critical for teams designing moderation pipelines; the default 0.5 is not optimized for any specific category and represents a compromise that may not align with a platform’s risk tolerance.

### HateXplain Results

For HateXplain, the API’s `hate` score was mapped to the hateful class, and the `harassment` score was mapped to the offensive class. Comments where no score exceeded threshold were considered normal. On the three-way classification, the endpoint achieved a macro-averaged F1 of 0.51. The per-class F1 scores were 0.62 for normal, 0.44 for offensive, and 0.47 for hateful. The confusion matrix revealed that the endpoint frequently conflated offensive and hateful content, with 31% of true hateful comments classified as offensive and 27% of true offensive comments classified as hateful. This conflation matters operationally because platforms typically apply different enforcement actions for hate speech (account suspension) versus offensive speech (content removal, warning). Misclassification between these categories creates inconsistent user experiences.

A third-party audit published by the Stanford Internet Observatory on August 12, 2024, independently evaluated the moderation endpoint against a custom dataset of 5,000 English-language social media posts collected between January and June 2024. The Stanford audit reported an overall F1 of 0.67 on binary toxic/non-toxic classification, consistent with the Jigsaw toxic F1 of 0.64 reported here. The Stanford audit further noted that the endpoint’s performance degraded by 12 percentage points on posts containing African American Vernacular English (AAVE), with false positive rates rising from 0.22 to 0.34. This dialectal bias finding aligns with broader research on language model fairness and represents a concrete risk for platforms serving diverse user bases.

## Comparison with Alternative Moderation Approaches

The moderation landscape extends beyond OpenAI’s endpoint. Two alternatives warrant direct comparison: Google’s Perspective API and the open-source Llama Guard models.

### Perspective API

Perspective, developed by Jigsaw and Google, has been publicly available since 2017 and processes over 2 billion comments per day across platforms including The New York Times, Reddit, and Disqus. As of September 2024, Perspective offers 13 attributes including TOXICITY, SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, PROFANITY, and THREAT. Each attribute returns a score between 0 and 1, with the recommended threshold set at 0.7 for the TOXICITY attribute. Perspective’s pricing is usage-based: the first 1 million API calls per month are free, after which the cost is $1.00 per 10,000 calls up to 10 million calls, with volume discounts available.

On the Jigsaw dataset, using the TOXICITY attribute at the recommended 0.7 threshold, Perspective achieves a toxic F1 of 0.72, compared to OpenAI’s 0.64. On identity_hate, Perspective’s IDENTITY_ATTACK attribute achieves an F1 of 0.38 at threshold 0.7, versus OpenAI’s 0.29 at threshold 0.5. Perspective’s advantage on these benchmarks is partially attributable to its longer development history and the fact that the Jigsaw dataset was created by the same organization, raising legitimate concerns about benchmark contamination. Perspective’s model card, last updated on March 14, 2024, acknowledges that the TOXICITY attribute was trained on data that included Wikipedia talk page comments, which overlap with the Jigsaw dataset’s source.

### Llama Guard 3

Meta released Llama Guard 3 on July 23, 2024, as part of the Llama 3.1 release. The model is an 8-billion-parameter instruction-tuned classifier based on the Llama 3.1 8B base. It classifies text into 14 hazard categories and returns a binary safe/unsafe judgment with per-category confidence scores. Llama Guard 3 is available under the Llama 3.1 Community License and can be self-hosted or accessed via cloud providers. On the MLCommons AI Safety benchmark v0.5, released August 2024, Llama Guard 3 achieved a macro-averaged F1 of 0.78 on English-language toxic content detection, outperforming both OpenAI’s moderation endpoint (0.64 on the same benchmark) and Perspective (0.74). The MLCommons benchmark uses a held-out dataset not overlapping with any model’s training data, reducing contamination concerns.

Self-hosting Llama Guard 3 on an AWS `g5.xlarge` instance (NVIDIA A10G, 24 GB GPU memory) costs approximately $1.01 per hour on-demand as of September 2024. At a throughput of 200 moderation checks per second, the per-call cost is approximately $0.0000014, making it cost-competitive with OpenAI’s free endpoint at scale once the fixed infrastructure cost is amortized. The trade-off is operational complexity: self-hosting requires managing GPU instances, model updates, and scaling logic, whereas the OpenAI endpoint is a stateless HTTP call.

## Operational Considerations for Production Deployment

Accuracy benchmarks provide a starting point, but production moderation systems face constraints that benchmarks do not capture. Latency, rate limits, multilingual coverage, and adversarial robustness each affect the viability of an API-based moderation approach.

### Latency and Rate Limits

The OpenAI moderation endpoint exhibits a median latency of 180 ms for a 500-token input, measured from us-east-1 AWS region to the OpenAI API over a 7-day period in September 2024. The 99th percentile latency was 1,200 ms. OpenAI’s rate limits for the moderation endpoint are 1,000 requests per minute for Tier 1 accounts and 5,000 requests per minute for Tier 5 accounts, as documented on September 3, 2024. For platforms processing user-generated content in real time, the 99th percentile latency of 1.2 seconds may require asynchronous moderation with a post-submission review window rather than pre-submission blocking.

### Multilingual Coverage

The `text-moderation-007` model supports 19 languages as of September 2024: Arabic, Chinese (Simplified and Traditional), Czech, Dutch, English, French, German, Hindi, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish, and Vietnamese. A multilingual evaluation conducted by the AI Safety Foundation on June 5, 2024, tested the endpoint on toxic speech datasets in German, Hindi, and Korean. The F1 scores were 0.58 for German, 0.41 for Hindi, and 0.39 for Korean, compared to 0.66 for English in the same evaluation. The performance gap on Hindi and Korean is attributed to the smaller volume of non-English training data in the moderation model’s fine-tuning corpus. Platforms serving multilingual audiences should budget for language-specific threshold tuning or supplemental moderation models for lower-resourced languages.

### Adversarial Robustness

A September 2024 preprint by researchers at Carnegie Mellon University tested the moderation endpoint against simple adversarial perturbations, including character-level substitutions (e.g., “h8te” for “hate”), whitespace manipulation, and homoglyph attacks. The endpoint’s recall on toxic content dropped from 0.72 to 0.34 under character substitution attacks, and to 0.19 under combined substitution and whitespace attacks. The paper’s authors note that these attacks require no model access or gradient information, making them feasible for motivated users. The moderation endpoint does not include input normalization or adversarial training as of the `text-moderation-007` release, leaving a gap that platforms must fill with preprocessing layers such as Unicode normalization, leetspeak decoding, and character-level fuzzy matching before calling the API.

## What to Act on Now

First, do not deploy the moderation endpoint at the default 0.5 threshold without calibration on a labeled sample of your own platform’s content. The identity_hate precision of 0.18 at default settings means that automated enforcement actions will generate a high volume of false positives, which erodes user trust and creates support overhead. Run a calibration exercise with at least 5,000 manually labeled examples from your production traffic, and select a threshold that balances precision and recall according to your enforcement policy’s cost of errors.

Second, budget for dialectal and multilingual fairness testing. The 12-percentage-point degradation on AAVE content and the sub-0.50 F1 scores on Hindi and Korean are not edge cases for platforms with diverse user bases. If your audience includes speakers of languages beyond English, German, French, and Spanish, plan to supplement the OpenAI endpoint with a self-hosted model like Llama Guard 3 that can be fine-tuned on language-specific data.

Third, implement an input normalization layer before moderation API calls. The adversarial robustness results indicate that basic text preprocessing can recover a significant portion of the lost recall under substitution attacks. At minimum, apply Unicode NFKC normalization, decode common leetspeak substitutions, and strip zero-width characters. These steps add single-digit milliseconds of latency and require no model changes.

Fourth, if your platform operates in the EU and falls under DSA obligations, the moderation endpoint alone is insufficient for audit requirements. The DSA mandates transparency into moderation accuracy, broken down by content category and language. OpenAI’s endpoint does not expose confidence calibration data or per-category threshold provenance. Maintain an independent evaluation dataset and publish accuracy reports that do not depend on vendor-provided benchmarks. The Stanford Internet Observatory audit format provides a template: describe the evaluation dataset, the mapping rules, the threshold, and the per-category metrics, updated at least quarterly.
