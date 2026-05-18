---
title: "AI HR Tools: Workday AI vs HireVue vs Pymetrics and NYC Law 144 Bias Audit Requirements"
description: "As of July 5, 2023, New York City’s Local Law 144 began full enforcement. The law mandates that any employer using an automated employment decision tool (AED…"
category: "Industry Verticals"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:56:36Z"
modDatetime: "2026-05-18T08:56:36Z"
readingTime: 11
tags: ["Industry Verticals"]
---

As of July 5, 2023, New York City’s Local Law 144 began full enforcement. The law mandates that any employer using an automated employment decision tool (AEDT) in hiring or promotion must subject that tool to an independent bias audit, publish a summary of the results, and notify candidates. The enforcement date arrived after a 2.5-year rulemaking period that started with the law’s passage in December 2021, and it triggered a compliance scramble across the HR tech sector. The Department of Consumer and Worker Protection (DCWP) can now levy fines of up to US$1,500 per violation, with each day a tool remains non-compliant counting as a separate violation. For a mid-size company processing 2,000 applications per month through an unaudited screening tool, the exposure runs into seven figures annually.

The three vendors most frequently cited in enterprise RFPs for AI-driven screening, video interviewing, and candidate assessment—Workday, HireVue, and Pymetrics—have each responded differently to the audit requirement. Workday’s HiredScore acquisition and its ML-driven resume scoring, HireVue’s video-based competency models, and Pymetrics’ neuroscience-grounded games all fall squarely within the law’s definition of an AEDT. The law defines an AEDT as any computational process that uses machine learning, statistical modeling, data analytics, or AI to generate a score, classification, or recommendation that substantially replaces human decision-making. The “substantially replaces” threshold is the operative phrase: if a recruiter merely rubber-stamps a model’s “recommended” pile, the tool is in scope.

This article examines each vendor’s technical architecture, the specific bias metrics their published audits disclose, and the operational friction of maintaining compliance across jurisdictions. The analysis draws on the vendors’ own bias audit summaries filed with the DCWP, technical documentation, and the statutory text of Local Law 144. All pricing is as of August 2024, and model versions are pinned where disclosed.

## Workday AI: HiredScore, Resume Scoring, and the Audit Gap

Workday’s AI hiring stack rests on two components: the proprietary ML models embedded in Workday Recruiting, and the HiredScore platform acquired in April 2023 for a reported US$620 million. HiredScore’s core function is to ingest a company’s historical hiring data—resumes, interview scores, offer acceptances, tenure outcomes—and train a model that scores new applicants against the profile of previously successful hires. The output is a percentile rank that recruiters use to prioritize review. Workday disclosed in its Q2 FY2025 earnings call on August 22, 2024 that HiredScore has been deployed across 1,200+ enterprise tenants, with a median time-to-fill reduction of 11 days.

### Model Architecture and Training Data

HiredScore is not a single model but a family of tenant-specific models. Each deployment trains on the customer’s own historical applicant-tracking data, typically 2-5 years of records. The feature set includes structured fields (years of experience, education level, skills taxonomy matches) and unstructured text embeddings from resumes and job descriptions. Workday has not publicly disclosed the embedding model version, but technical documentation references a proprietary transformer-based encoder fine-tuned on enterprise HR corpora. The key point for bias audits: the training data is the customer’s own hiring history. If a company historically hired 85% male engineers, the model will learn that pattern unless explicit mitigation is applied.

### Bias Audit Status Under NYC Law 144

Workday published a bias audit summary for its HiredScore AEDT on June 28, 2023, conducted by the independent auditor Holistic AI. The audit evaluated the tool’s scoring across sex categories (male, female) and race/ethnicity categories (Asian, Black, Hispanic, White) using the selection rate ratio (SRR) metric. The Uniform Guidelines on Employee Selection Procedures define an SRR below 0.80—the “four-fifths rule”—as prima facie evidence of adverse impact. The HiredScore audit reported SRRs ranging from 0.82 to 1.14 across all intersectional groups, meaning no category fell below the 0.80 threshold. However, the audit covered a single customer deployment in the financial services sector. Workday explicitly states that results will vary by tenant, and the audit summary is not a blanket certification. For customers deploying HiredScore in NYC, Workday requires a separate tenant-level audit, which it facilitates through its auditor partner at a cost of US$15,000-25,000 per audit cycle.

### Operational Reality

The tenant-specific audit requirement creates a procurement bottleneck. A company evaluating Workday AI for NYC hiring must budget not only the platform cost but also the audit cost and a 6-8 week lead time for the auditor to access training data, run the analysis, and produce the public summary. Workday’s HiredScore pricing as of August 2024 starts at US$85 per employee per year for the base module, with the bias audit facilitation add-on at US$10,000 flat fee per year. For a 500-employee company, the annual cost lands at US$52,500 before any implementation fees. The platform does not provide real-time bias monitoring; the audit is a point-in-time snapshot that must be refreshed annually under DCWP guidance.

## HireVue: Video Interviewing Models and the Explainability Tradeoff

HireVue shifted its product strategy in 2021, discontinuing facial analysis features after sustained criticism from researchers and the Electronic Privacy Information Center. The current platform, as of HireVue’s August 2024 product documentation, relies on structured interview assessments: candidates record video responses to standardized questions, and a set of ML models evaluates the content of those responses against a competency framework. The models transcribe speech via a third-party ASR engine (HireVue has not publicly named the provider), then run the transcript through NLP classifiers trained to detect evidence of competencies like “collaboration,” “problem-solving,” and “resilience.” The output is a competency score on a 1-5 scale per dimension.

### Technical Architecture: What the Models Actually Score

HireVue’s models do not analyze tone, facial expression, or speech cadence—a point the company emphasizes in its compliance documentation. The classifiers are trained on a corpus of 2 million+ interview responses, labeled by industrial-organizational psychologists against HireVue’s competency taxonomy. The model version in production as of August 2024 is internally designated HV-Core-2024.03, a BERT-based architecture with a classification head per competency. The company reports that the model achieves a Cohen’s kappa of 0.61-0.73 against human psychologist ratings, depending on the competency. This is moderate agreement; a kappa above 0.60 is generally considered acceptable in behavioral assessment, but it means the model disagrees with human raters roughly 27-39% of the time.

### Bias Audit and NYC Law 144 Compliance

HireVue published its bias audit on July 3, 2023, conducted by O’Neil Risk Consulting & Algorithmic Auditing (ORCAA). The audit tested for adverse impact across race/ethnicity and sex for each competency score. Using the SRR at the 0.80 threshold, the audit found no adverse impact for 14 of 16 competency-score combinations. Two competencies—one in a retail customer service model and one in an entry-level sales model—showed SRRs of 0.76 and 0.74 for Black female candidates, falling below the four-fifths threshold. HireVue’s public summary notes that these competencies have been flagged for retraining and that customers using the affected models received notification. The audit did not test for intersectional impact beyond sex and race/ethnicity; age and disability status were not evaluated.

### Pricing and Audit Maintenance

HireVue’s enterprise pricing as of August 2024 starts at US$35,000 per year for up to 1,000 video interviews, with volume tiers that reduce the per-interview cost to approximately US$18 at 10,000+ interviews. The bias audit is included in the platform fee; HireVue does not charge separately for the audit summary. However, the audit covers HireVue’s base models only. Any custom competency models trained on a customer’s own data require a separate audit, which HireVue quotes at US$12,000-18,000 per model. The company commits to annual re-audits of its base models, with the next cycle due July 2025.

## Pymetrics: Neuroscience Games and the Disparate Impact Challenge

Pymetrics, acquired by Harver in 2022, takes a fundamentally different approach: candidates play a series of 12 neuroscience-based games that measure cognitive and emotional traits—attention, risk tolerance, fairness perception, memory, and others. The platform then compares a candidate’s trait profile to a “success profile” built from the company’s top-performing employees in the target role. The output is a fit score. Pymetrics’ technical differentiation is that the games themselves are model-agnostic data collection instruments; the ML component is the matching algorithm that maps trait profiles to job performance.

### Bias Audit Architecture: The “De-Biasing by Design” Claim

Pymetrics has published more bias audit documentation than either Workday or HireVue. The company’s core claim is that its matching algorithm applies an adversarial de-biasing procedure at training time: it removes features that are predictive of protected class membership while retaining features predictive of job performance. The technical paper describing this procedure, authored by Pymetrics’ data science team and published in the ACM Conference on Fairness, Accountability, and Transparency (FAccT) in 2021, reports that the procedure reduces the gender classification accuracy of the trait profile to 52-55%—near chance—while retaining 89-94% of the predictive power for job performance, depending on the role category.

### NYC Law 144 Audit Results

Pymetrics’ bias audit, published June 15, 2023 and conducted by the audit firm BABL AI, evaluated the platform’s fit scores across sex, race/ethnicity, and the intersection of the two. The audit used SRR and a secondary metric, the standardized mean difference (SMD) in fit scores across groups. An SMD above 0.20 is considered a small effect, above 0.50 medium, and above 0.80 large. The audit reported SMD values ranging from 0.08 to 0.19 for sex, and 0.11 to 0.24 for race/ethnicity, with the highest SMD of 0.24 observed for Black candidates in a financial analyst success profile. No SMD exceeded 0.25. All SRRs fell above 0.85. The audit covered Pymetrics’ US customer base in aggregate, not individual tenants, which Pymetrics argues is valid because the matching algorithm uses the same de-biasing procedure across deployments.

### Cost and Compliance Footprint

Pymetrics pricing as of August 2024 is US$60 per candidate assessed, with volume discounts to US$35 per candidate at 5,000+ assessments per year. There is no separate platform fee. The bias audit is included and updated annually. Pymetrics’ audit summary is the most detailed of the three vendors, running 18 pages with full intersectional breakdowns. However, the adversarial de-biasing approach has a known limitation: it can only mitigate bias along dimensions explicitly included in the adversarial objective. If a protected characteristic correlates with a trait that the procedure does not flag—for example, socioeconomic status proxied through device type or response latency—the model may still produce disparate impact. Pymetrics’ audit does not test for proxy variables, and the DCWP has not yet issued guidance on whether proxy testing is required under Law 144.

## The Compliance Stack: What Buyers Actually Need to Maintain

Beyond the initial audit, NYC Law 144 imposes ongoing obligations that affect the total cost of ownership for any AI HR tool. The three requirements are: (1) an annual bias audit with public summary, (2) a notice to candidates at least 10 business days before the tool is used, and (3) an opt-out mechanism allowing candidates to request an alternative evaluation process. The notice requirement is the most operationally complex: it must specify the tool being used, the job qualifications and characteristics it assesses, the data it collects, and the candidate’s right to request an accommodation. For a company using multiple AEDTs—say, Workday for resume screening and HireVue for video interviews—each tool requires a separate notice.

### Audit Scope and the Multi-Tool Problem

A company running Workday HiredScore for screening, HireVue for first-round interviews, and Pymetrics for final-round assessment has three separate bias audits to maintain, three public summaries to host, and three notice workflows to implement. The audits are not interchangeable. Workday’s audit covers resume scoring; it says nothing about video interview competency models or game-based trait profiling. The DCWP has confirmed in its FAQ published June 2023 that each AEDT requires its own audit, even if the tools are used in sequence for the same role. For a company hiring 200 roles per year in NYC, the compliance overhead—audit fees, legal review of summaries, candidate notice management—runs US$40,000-70,000 annually above the tooling costs, based on quotes from three employment law firms specializing in AI compliance as of Q3 2024.

### Jurisdictional Expansion

NYC Law 144 is not an isolated regulation. California’s Civil Rights Council released draft modifications to its employment regulations in March 2024 that would require automated decision system audits for hiring tools, with a proposed effective date of January 2026. The EU AI Act, which entered into force on August 1, 2024, classifies AI systems used in employment as “high-risk” and requires conformity assessments, bias monitoring, and human oversight. Companies buying AI HR tools in 2024 are effectively buying into a multi-jurisdictional compliance regime. A vendor’s NYC audit does not satisfy EU requirements, and the EU’s mandate for “human oversight” is more prescriptive than NYC’s “alternative evaluation process” opt-out. Buyers should price in the cost of maintaining separate compliance artifacts for each jurisdiction where they hire.

## What to Do Now

1. **Request the actual audit summary, not the marketing claim.** All three vendors publish their bias audits publicly. Read the SRR and SMD tables, note which protected categories were tested, and check whether the audit covers the specific model version and role type you will deploy. A financial services audit does not generalize to a retail hiring workflow.

2. **Budget for tenant-specific audits if you customize.** Workday and HireVue both require separate audits for custom models trained on your data. Pymetrics’ aggregate audit may suffice if you use its standard matching algorithm, but any customization to the success profile triggers a new audit. Confirm audit scope and cost in the vendor contract, not in a follow-up email.

3. **Implement the candidate notice workflow before you turn the tool on.** The 10-business-day notice requirement is a hard deadline. Build the notice into your ATS workflow at the point of application, not as a separate email sequence. Include the specific tool name, the traits it assesses, and the opt-out mechanism. A generic “AI may be used in this process” notice does not satisfy the DCWP.

4. **Plan for multi-jurisdictional compliance from day one.** If you hire in NYC and have any presence in the EU or California, structure your vendor agreements to include audit rights that satisfy both NYC Law 144 and the EU AI Act’s high-risk requirements. The EU requires a fundamental rights impact assessment in addition to the bias audit; no US vendor currently provides this as a standard deliverable. Factor in legal review costs of US$15,000-25,000 per jurisdiction per year for a mid-size deployment.

5. **Monitor for proxy variable enforcement.** The current NYC audits do not test for bias introduced by proxy variables—features that correlate with protected characteristics without explicitly encoding them. The DCWP has signaled through its 2023 rulemaking commentary that it may expand audit requirements to include proxy testing in future rule updates. When negotiating vendor contracts, include a clause requiring the vendor to update its audit methodology to match regulatory changes at no additional cost for the contract term.
