---
title: "AI Legal Document Review: Harvey vs Casetext CoCounsel vs GPT-4o for Contract Analysis"
description: "Generative AI’s move into legal document review stopped being a curiosity in late 2024. It became a procurement question. The trigger was the October 2024 up…"
category: "Industry Verticals"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:52:57Z"
modDatetime: "2026-05-18T08:52:57Z"
readingTime: 8
tags: ["Industry Verticals"]
---

Generative AI’s move into legal document review stopped being a curiosity in late 2024. It became a procurement question. The trigger was the October 2024 update to the American Bar Association’s Formal Opinion 512, which clarified that lawyers must apply “competence and diligence” when using AI tools, including verifying outputs, understanding the technology’s limitations, and billing clients appropriately. That opinion, published 16 October 2024, shifted the conversation from “can AI help with contract review?” to “which AI tool meets the duty-of-competence bar, and what does it actually cost per document?”

At the same time, law firm economics changed. The 2025 Am Law 100 rate survey, released in January 2025, showed median partner billing rates crossing US$1,200 per hour for the first time, with associate rates averaging US$680. A tool that shaves 45 minutes off a 30-page lease review saves roughly US$510 in associate time, per document. If a firm reviews 200 leases per quarter, the annual arithmetic becomes material. The question is no longer whether to adopt AI review, but which system produces the fewest errors per page, integrates with existing matter-management workflows, and generates a defensible audit trail.

Three options dominate the 2025 conversation: Harvey, built on OpenAI’s infrastructure and fine-tuned for legal workflows; Casetext CoCounsel, now a Thomson Reuters product with access to Westlaw and Practical Law data; and a baseline stack using GPT-4o directly, which some firms have configured into custom review pipelines. This article benchmarks them on contract clause extraction, red-flag detection, and cost per 100 pages, using publicly available data and pricing as of March 2025.

## Accuracy and Clause Extraction: Structured Output Benchmarks

Legal document review breaks into two distinct tasks: extracting structured data from unstructured text (parties, dates, governing law, indemnity caps), and flagging anomalous or risky clauses against a playbook. Accuracy on extraction is table stakes. If a tool misses a survival-period clause in an M&A agreement, the downstream liability is not theoretical.

### Extraction Precision on Standard Commercial Leases

A December 2024 benchmark by Legaltech Hub tested three systems on a corpus of 200 anonymized commercial leases, each 25–40 pages. The task was to extract 18 predefined fields, including base rent, escalation formula, renewal option window, and assignment restrictions. The results:

- **Harvey (model: gpt-4o-2024-08 via Harvey’s legal-tuned pipeline)**: 96.2% field-level accuracy. Most errors occurred on leases with handwritten addenda or scanned PDFs with OCR artifacts. Harvey’s output included per-field confidence scores and a link back to the source clause in the original document.
- **Casetext CoCounsel (model: gpt-4o-2024-08 with Westlaw grounding)**: 94.7% field-level accuracy. CoCounsel’s errors clustered on fields requiring cross-referencing with statutory definitions—for example, distinguishing between “gross lease” and “modified gross lease” where the lease text was ambiguous.
- **Baseline GPT-4o (gpt-4o-2024-08, zero-shot with a 2,000-token system prompt)**: 88.3% field-level accuracy. The baseline struggled with multi-page clause dependencies, such as rent abatement provisions spread across a lease and an attached rider. It also hallucinated a governing-law field on 3 of 200 documents when the lease was silent.

The 8-percentage-point gap between the purpose-built tools and the baseline is significant in a production context. For a 200-lease review, Harvey’s error rate translates to roughly 14 missed or incorrect fields; the baseline produces approximately 42.

### Red-Flag Detection on M&A Due Diligence

A separate test, published by the Singapore Academy of Law’s Future Law Lab on 15 January 2025, evaluated red-flag detection on 50 M&A due diligence documents, including share purchase agreements, disclosure letters, and transitional service agreements. The benchmark defined 12 red-flag categories: uncapped indemnities, non-compete clauses exceeding 3 years, change-of-control consent requirements, and others.

- Harvey correctly identified 89 of 94 planted red flags (94.7% recall), with 3 false positives.
- CoCounsel identified 87 of 94 (92.6% recall), with 2 false positives. The misses were concentrated on red flags requiring jurisdictional knowledge of Singapore’s Companies Act, where Westlaw’s primarily US and UK corpus provided less grounding.
- GPT-4o baseline identified 78 of 94 (83.0% recall), with 11 false positives—flagging standard-market clauses as anomalous because the prompt lacked sufficient deal-context parameters.

Precision matters as much as recall. A tool that flags 20 false positives per document forces a human reviewer to spend time dismissing non-issues, eroding the time-savings case. Harvey’s false-positive rate was 0.06 per document; the baseline was 0.22.

## Pricing and Unit Economics: Per-Document and Per-Seat Models

Pricing structures diverged significantly in early 2025, and the choice between them determines whether AI review is viable for a solo practitioner versus a 500-lawyer firm.

### Harvey’s Seat-Based Model

As of March 2025, Harvey charges US$2,400 per seat per year for its core legal review module, with a minimum 5-seat commitment (US$12,000 annual floor). Document processing is unlimited within the seat license, subject to a fair-use cap of 10,000 pages per seat per month. For a 20-lawyer practice group reviewing 500 lease pages per lawyer per month, the effective per-page cost is approximately US$0.04, assuming the seats are fully utilized.

Harvey also offers a consumption-based API tier for firms building custom integrations, priced at US$0.08 per page for the first 50,000 pages per month, dropping to US$0.05 per page above 100,000 pages. This tier launched in November 2024 and is aimed at firms with in-house engineering teams.

### CoCounsel’s Bundled and Standalone Pricing

Casetext CoCounsel’s pricing, updated in February 2025, is US$250 per user per month when bundled with a Westlaw Precision subscription, or US$350 per user per month standalone. There is no page-based cap; usage is governed by a reasonable-use policy that Thomson Reuters declined to quantify in writing when we asked on 3 March 2025. For a firm already paying for Westlaw Precision (which runs US$180–US$400 per attorney per month depending on firm size), the incremental cost of adding CoCounsel is US$250 per user per month. For a 20-lawyer group, that is US$60,000 per year incremental, or US$96,000 including the Westlaw component.

### GPT-4o Baseline: Build-Your-Own Economics

A firm building an in-house review pipeline on GPT-4o (gpt-4o-2024-08) faces OpenAI API costs of US$2.50 per 1 million input tokens and US$10.00 per 1 million output tokens, as of the 6 March 2025 pricing page. A 30-page lease averages roughly 22,000 tokens input and 1,500 tokens output per extraction run. That yields a raw API cost of approximately US$0.07 per document. Adding a human-in-the-loop review interface, prompt-engineering time, and ongoing maintenance, a realistic fully loaded per-document cost for a custom pipeline is US$0.30–US$0.50, based on interviews with three legal engineering teams published in Artificial Lawyer on 20 February 2025.

The build-your-own approach offers flexibility but shifts the compliance burden onto the firm. Formal Opinion 512 requires that lawyers understand the technology they use. A custom pipeline means the firm must document its testing methodology, error rates, and update cadence—work that Harvey and CoCounsel absorb as part of their subscription.

## Integration, Audit Trail, and the Duty of Competence

Accuracy and cost are necessary but insufficient criteria. The ABA’s October 2024 opinion explicitly states that lawyers must “ensure that the use of AI tools is consistent with their professional obligations, including the duties of competence, confidentiality, communication, and supervision.” This translates into two concrete requirements: the tool must integrate with existing matter-management systems to avoid creating silos of unreviewed AI output, and it must produce an audit trail that shows what the AI did, what the human reviewer changed, and why.

### Audit Trail Granularity

Harvey logs every clause extraction with a timestamp, the model version used (currently gpt-4o-2024-08), the confidence score, and a diff between the AI output and the human reviewer’s final entry. This audit log is exportable as a CSV or PDF and is designed to be attached to a matter file. CoCounsel provides a similar “review history” feature, but as of March 2025, it does not expose the model version in the export; it shows only “CoCounsel AI engine.” This may be acceptable for most matters, but in litigation where opposing counsel challenges the use of AI, the inability to cite a specific model version could become an issue.

### Document Management System Integration

Harvey integrates natively with iManage and NetDocuments, the two dominant DMS platforms in Am Law 200 firms. CoCounsel integrates with the Thomson Reuters ecosystem—Westlaw, Practical Law, and HighQ—but does not yet have a direct iManage connector as of March 2025, requiring documents to be uploaded manually or via a HighQ intermediary. For firms standardized on iManage, this adds a step to the review workflow. The GPT-4o baseline has no native integrations; firms must build their own connectors, which typically takes 2–4 weeks of engineering time according to the Artificial Lawyer interviews.

## What the Benchmarks Do Not Capture

No current benchmark measures the “time-to-competence” for a new user. Harvey’s interface assumes legal training and uses standard practice-group terminology; a first-year associate can produce useful outputs within an hour. CoCounsel’s interface is broader, covering legal research and deposition summarization in addition to document review, which adds complexity but also utility beyond the contract-review use case. The GPT-4o baseline requires a user who can write effective system prompts and understand token limits—a skill set not yet common in most law firms.

Also absent from benchmarks is the handling of non-English documents. The Singapore Academy of Law test included 10 documents in Mandarin Chinese with English translations. Harvey and the GPT-4o baseline performed comparably on the Chinese originals (both around 91% extraction accuracy), while CoCounsel required pre-translation, as its legal grounding is English-only. For firms with cross-border practices in Asia or the Middle East, this is a material differentiator.

## Actionable Takeaways

1. **If your firm already pays for Westlaw Precision, start with CoCounsel.** The incremental US$250 per user per month is the lowest-friction path to AI-assisted review, and the Westlaw grounding provides citation-backed outputs that simplify the ABA 512 compliance narrative. Accept the limitation that model version is not exposed in exports, and plan to supplement with manual verification for high-stakes matters.

2. **If your firm uses iManage and reviews more than 5,000 pages per month, evaluate Harvey on the API tier.** At US$0.05 per page above 100,000 pages, the unit economics beat both the seat license and the build-your-own baseline, and the iManage integration eliminates a manual upload step that introduces error risk.

3. **Do not deploy a raw GPT-4o pipeline for production legal review unless you have dedicated legal engineering headcount.** The 88.3% extraction accuracy and 0.22 false-positive-per-document rate are not defensible under ABA 512 without a documented testing and remediation framework. The build cost is real: budget US$15,000–US$25,000 in engineering time for a basic pipeline, plus US$500–US$1,000 per month in ongoing prompt maintenance as model behavior shifts across OpenAI updates.

4. **Request a model-version guarantee in your vendor contract.** Both Harvey and CoCounsel update their underlying models periodically. A clause requiring 30 days’ notice before a model change, and the ability to pin a specific model version for up to 90 days, gives your firm time to re-validate accuracy on your own document corpus before the update hits production. As of March 2025, Harvey offers this in its enterprise tier; CoCounsel does not, but Thomson Reuters has indicated it is “under consideration” for a mid-2025 release.
