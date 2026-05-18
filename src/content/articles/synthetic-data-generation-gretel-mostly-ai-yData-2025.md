---
title: "Synthetic Data Generation Tools 2025: Gretel vs Mostly AI vs yData for Privacy-Preserving ML"
description: "As privacy regulations tighten and data-hungry models grow more demanding, the calculus for machine learning teams has shifted. The European Union’s AI Act,…"
category: "Data & MLOps"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:37:49Z"
modDatetime: "2026-05-18T08:37:49Z"
readingTime: 8
tags: ["Data & MLOps"]
---

As privacy regulations tighten and data-hungry models grow more demanding, the calculus for machine learning teams has shifted. The European Union’s AI Act, which entered into force on 1 August 2024, classifies synthetic data generation as a permissible technique for creating training datasets that comply with GDPR’s data minimization principle. Meanwhile, the U.S. Federal Trade Commission has signaled through its Operation AI Comply enforcement sweep in September 2024 that companies using real consumer data without explicit consent for model training face material fines. The practical consequence: a mid-market fintech building a credit risk model can no longer simply dump production PostgreSQL rows into a training pipeline and call it compliance. It must either navigate increasingly complex consent architectures or generate statistically faithful synthetic alternatives. Three tools have emerged as the default shortlist for privacy-preserving synthetic data in early 2025: Gretel (San Diego, Series B), Mostly AI (Vienna, bootstrapped), and yData (Seattle, seed-stage). Each takes a distinct architectural approach to the same problem—producing tabular and sequential data that preserves statistical relationships without memorizing individual records. This comparison evaluates them on model quality, privacy guarantees, developer experience, and total cost of ownership at production scale, using publicly benchmarked results and dated pricing as of February 2025.

## Model Quality Benchmarks

Evaluating synthetic data quality requires measuring how well generated datasets preserve the statistical properties of the original data without leaking individual records. The standard methodology uses the Synthetic Data Vault (SDV) framework’s three-axis evaluation: column shape similarity, pair-wise correlation preservation, and propensity score discrimination. All three vendors publish results against these metrics, though with different test datasets and reporting granularity.

### Tabular Data Fidelity

Gretel’s ACTGAN model, released in its 1.0 stable form in October 2024, reports a mean column-wise KSComplement score of 0.91 across the UCI Adult Income dataset, with a CorrelationSimilarity of 0.87. These numbers come from Gretel’s own documentation updated 15 January 2025. For the same dataset, Mostly AI’s proprietary VAE-GAN hybrid architecture achieves a KSComplement of 0.93 and CorrelationSimilarity of 0.89, as published in their Q4 2024 technical report. yData’s Fabric SDK, using its Adaptive Synthesizer with default parameters, reaches 0.88 KSComplement and 0.84 CorrelationSimilarity on the same benchmark, per yData’s public documentation last updated November 2024. The 0.02 to 0.05 point differences in these scores are statistically meaningful: a KSComplement below 0.85 typically indicates column-level distributions that downstream models will treat as out-of-distribution, degrading predictive performance by 8-12% in transfer learning scenarios according to a paper by Jordon et al. published at NeurIPS 2022.

### Time Series and Sequential Data

For sequential data—transaction logs, patient journeys, IoT sensor streams—the evaluation criteria shift toward autocorrelation preservation and event timing accuracy. Mostly AI’s sequential synthesizer demonstrates a 0.94 autocorrelation match on the Google Analytics customer journey dataset (2.3 million sessions, 47 features), as documented in their November 2024 case study with a European telecommunications operator. Gretel’s DGAN model, built on a DoppelGANger architecture, achieves 0.89 autocorrelation preservation on comparable sequential benchmarks. yData’s time-series synthesizer, which uses a temporal VAE approach, reports 0.86 autocorrelation match on its standard evaluation suite. The gap widens when sequence length exceeds 100 time steps: Mostly AI maintains fidelity above 0.90 while both Gretel and yData degrade to the 0.78-0.82 range, a limitation acknowledged in Gretel’s documentation note dated 3 December 2024.

## Privacy Guarantees and Regulatory Posture

Synthetic data tools must prove they do not memorize and regurgitate training records. The two dominant privacy frameworks are differential privacy (DP) with mathematically provable bounds, and empirical privacy testing through membership inference attacks. The choice between them affects both model utility and regulatory defensibility.

### Differential Privacy Implementation

Gretel offers DP-SGD training across all its model types, configurable with epsilon values from 0.1 to 10.0. At epsilon=1.0, which provides meaningful privacy guarantees under the Dwork definition, Gretel’s ACTGAN model sees a KSComplement degradation from 0.91 to 0.79 on the Adult dataset—a 13% utility hit documented in their 15 January 2025 benchmarks. Mostly AI implements DP through its Smart Imputation layer rather than at the training optimizer level, claiming this preserves more utility at equivalent privacy budgets. At epsilon=1.0, Mostly AI reports KSComplement of 0.85, a 9% degradation from its non-DP baseline. yData does not offer native differential privacy training as of February 2025; its privacy features rely on holdout-based empirical evaluation and k-anonymity checks, which provide weaker formal guarantees. For organizations subject to GDPR Article 35 Data Protection Impact Assessments, the absence of DP training may require supplementary documentation that the empirical approach satisfies the “data protection by design” requirement.

### Membership Inference Resistance

All three vendors publish membership inference attack (MIA) results. Gretel’s synthetic data achieves an MIA AUC-ROC of 0.52 (where 0.50 represents random guessing) against a shadow model attack, indicating near-perfect resistance, per results published 15 January 2025. Mostly AI reports MIA AUC-ROC of 0.51 on its standard evaluation suite. yData’s synthesized datasets show MIA AUC-ROC of 0.56, slightly above the ideal 0.50 threshold, suggesting marginal information leakage detectable by sophisticated attackers. A 2023 study by Stadler et al. at ETH Zurich established that MIA AUC-ROC above 0.55 indicates statistically significant memorization in synthetic tabular data. yData’s result at 0.56 sits precisely on this boundary, meaning teams using yData for sensitive health or financial data should budget for additional privacy auditing.

## Developer Experience and Integration

The integration story matters as much as model quality for teams shipping production systems. Evaluation criteria include SDK maturity, documentation quality, cloud versus on-premise deployment options, and compatibility with existing MLOps stacks.

### SDK and API Design

Gretel provides a Python SDK, REST API, and CLI, with the Python SDK reaching version 1.0 in October 2024. Its API uses a declarative configuration model: users define a YAML or Python dict specifying the synthesizer type, privacy parameters, and output constraints, then submit jobs to Gretel’s managed cloud or a self-hosted Gretel Worker. The SDK handles batching, retries, and progress polling. Mostly AI offers a Python client library and REST API, with a focus on interactive data exploration through its web UI before programmatic generation. Its API is stateless: users upload source data, configure synthesizer parameters, and download results. yData’s Fabric SDK provides the most pandas-native experience, with synthetic data generation fitting into existing DataFrame pipelines as a `.fit()` and `.sample()` pattern. For teams already using pandas profiling and data quality tooling, this reduces context-switching overhead.

### Deployment and Infrastructure

Gretel’s cloud offering is hosted on AWS us-east-1 and eu-west-1, with pricing at US$2.00 per 100,000 synthetic records generated for tabular data as of February 2025. Self-hosted deployment uses Kubernetes Helm charts with GPU support for ACTGAN training; a single A10G instance can generate approximately 500,000 records per hour. Mostly AI operates a managed cloud on AWS and Azure, with pricing at €1.80 per 100,000 synthetic records. Its self-hosted option runs on Docker Compose or Kubernetes, with minimum hardware requirements of 16 GB RAM and 4 vCPUs for tabular workloads. yData Fabric is primarily a self-hosted library with no managed cloud option. It installs via pip and runs on any Python 3.10+ environment, with GPU acceleration optional via CUDA 12.1. The absence of a managed service means teams absorb infrastructure management costs but avoid per-record pricing, making yData economically attractive at very high volumes.

## Total Cost of Ownership at Production Scale

Pricing comparisons require defining a realistic production workload. Consider a mid-market insurance company generating synthetic claims data: 50 million rows across 35 columns, refreshed monthly, with differential privacy at epsilon=1.0, and a requirement for on-premise deployment to satisfy data residency requirements.

### Annual Cost Breakdown

Gretel’s self-hosted enterprise license costs US$45,000 per year for up to 10 million synthetic records per month, with additional blocks of 10 million records at US$3,000 per month. At 50 million records per month, the annual cost reaches US$45,000 base plus US$144,000 in overage fees, totaling US$189,000. This pricing was confirmed in Gretel’s Q1 2025 rate card published 6 January 2025.

Mostly AI’s self-hosted enterprise license is priced at €42,000 per year with unlimited record generation, as published in their January 2025 pricing update. Infrastructure costs for the required 32 GB RAM, 8 vCPU instance on AWS (r6i.xlarge) add approximately US$2,500 per year on a 1-year reserved instance, bringing total annual cost to roughly €42,000 plus US$2,500.

yData Fabric’s enterprise license costs US$12,000 per year for unlimited record generation, per pricing published November 2024. Infrastructure requirements are lower due to the library’s lighter resource footprint: a 16 GB RAM, 4 vCPU instance (approximately US$1,200 per year reserved) suffices for 50 million rows. Total annual cost: approximately US$13,200. The trade-off is the absence of formal differential privacy guarantees and managed infrastructure support.

### Training Time and Compute

Generating 50 million synthetic records with differential privacy at epsilon=1.0 on comparable hardware (single NVIDIA A10G, 24 GB VRAM): Gretel’s ACTGAN completes the job in 4.2 hours, Mostly AI’s synthesizer in 3.1 hours, and yData’s Adaptive Synthesizer in 2.8 hours without DP (yData lacks native DP support). These figures come from a comparative benchmark conducted by an independent MLOps consultancy and published on 5 February 2025 on their public blog. The 1.1-hour delta between Gretel and Mostly AI translates to approximately US$1.52 in GPU cloud costs per generation run at AWS on-demand pricing of US$1.38 per A10G-hour, a negligible difference for monthly batch jobs but material for teams iterating on data quality during development.

## Recommendations

Teams evaluating synthetic data tools in February 2025 should make decisions based on their specific regulatory exposure, data modality mix, and volume requirements. Five actionable takeaways emerge from this comparison.

First, if differential privacy with provable epsilon bounds is a hard requirement—as it increasingly becomes for GDPR-compliant ML pipelines and healthcare deployments—Gretel and Mostly AI are the only viable options. yData’s empirical privacy approach may not survive a regulatory audit without supplementary documentation and external privacy engineering review.

Second, for sequential and time-series data workloads exceeding 100 time steps per sequence, Mostly AI’s 0.94 autocorrelation preservation materially outperforms Gretel’s 0.89 and yData’s 0.86. Teams building customer lifetime value models or predictive maintenance systems on sensor data should prioritize this metric.

Third, at volumes above 30 million synthetic records per month, yData’s US$12,000 annual license with unlimited generation creates a compelling cost argument, but only if the organization can accept the absence of formal DP guarantees and the higher MIA AUC-ROC of 0.56.

Fourth, teams already standardized on pandas-centric MLOps workflows will find yData Fabric’s API the most natural integration point, while teams requiring managed infrastructure and compliance certifications (SOC 2 Type II, HIPAA BAA) should default to Gretel or Mostly AI’s cloud offerings.

Fifth, budget for a privacy audit regardless of tool selection. Even Gretel’s 0.52 MIA AUC-ROC and epsilon=1.0 DP guarantees require validation on your specific data distribution. Allocate 40-60 engineering hours for running holdout-based membership inference tests, evaluating column-level fidelity on your production schemas, and documenting the privacy-utility trade-off for your compliance team before committing to a 12-month enterprise license.
