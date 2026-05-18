---
title: "California AI Bill SB-1047 Requirements for Deployers in 2025"
description: "California’s Senate Bill 1047, the Safe and Secure Innovation for Frontier Artificial Intelligence Models Act, cleared the legislature on August 28, 2024 and…"
category: "Regulation & Compliance"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:35:30Z"
modDatetime: "2026-05-18T08:35:30Z"
readingTime: 10
tags: ["Regulation & Compliance"]
---

California’s Senate Bill 1047, the Safe and Secure Innovation for Frontier Artificial Intelligence Models Act, cleared the legislature on August 28, 2024 and landed on Governor Gavin Newsom’s desk with a September 30, 2024 signature deadline. It did not arrive quietly. The bill drew opposition from eight California congressional representatives, venture capital firm Andreessen Horowitz, and AI researchers who argued that its pre-harm liability framework would criminalize open-source model release and drive frontier compute out of the state. Supporters—including two of the three “godfathers of AI,” Geoffrey Hinton and Yoshua Bengio—countered that a model capable of causing mass casualties or $500 million in cyberattack damages deserves at least the regulatory scrutiny of a new pharmaceutical.

For deployers, the operational reality crystallized on January 1, 2025, when the bill’s compliance provisions took effect. Any developer who trains a covered model—or any entity that deploys or makes available a covered model or covered model derivative—must now satisfy a cascade of documentation, shutdown, audit, and reporting requirements. The bill’s scope is not limited to California-headquartered companies. It applies to any developer doing business in California or whose model is used in California, which in practice means any AI company with U.S. users. Noncompliance carries civil penalties up to $10 million for a first violation and $30 million for subsequent violations, calculated per violation per day. For startups operating on seed-stage burn rates, a single enforcement action is existential.

The text that follows is a plain-language operational breakdown of what SB-1047 actually demands of deployers in 2025, which models trigger coverage, and where the compliance burden falls hardest.

## The Coverage Threshold: What Triggers SB-1047

The bill does not regulate all AI models. It draws a bright line around “covered models,” defined by two cumulative criteria: training compute cost and fine-tuning capability. Understanding whether your model crosses that line is the first compliance gate.

### The $100 Million Compute Test

A model is covered if it was trained using more than 10^26 integer or floating-point operations and the training cost exceeds $100 million, as measured by the developer’s reasonable assessment of cloud compute market prices at the time of training. The bill’s drafters pegged this threshold to the estimated cost of training GPT-4-class models as of early 2024, and the text explicitly ties the dollar figure to a compute volume rather than letting inflation erode the standard over time.

The $100 million figure is not hypothetical. Training runs at that scale are already public: Meta reported that its Llama 3.1 405B model required approximately 39.3 million GPU-hours on H100-80GB clusters, which at prevailing reserved-instance pricing of roughly $2.50 per GPU-hour places the training cost around $98 million, just below the threshold but within the margin of measurement error. Any model trained with a larger compute budget—GPT-4o, Claude 3.5 Opus, or Gemini Ultra-class runs—would almost certainly trigger coverage.

### The $10 Million Fine-Tuning Gateway

A second path to coverage exists for fine-tuned derivatives. If a developer uses more than 3×10^25 operations to fine-tune an existing covered model—roughly one-third the compute of the full training threshold—and the fine-tuning cost exceeds $10 million, the resulting derivative is itself a covered model. This provision closes the obvious loophole of taking an open-weight covered model, spending a modest fraction of the original training budget on domain-specific fine-tuning, and claiming exemption. It also means that a deployer who licenses a base model and performs substantial adaptation may independently become a “developer” under the bill, inheriting the full compliance burden.

## The Five Obligations for Deployers

Once a model is covered, SB-1047 imposes five distinct obligations on deployers. “Deployer” is defined broadly: any person or entity that makes a covered model or covered model derivative available for use in California or by California residents, whether via API, on-premises deployment, or open-weight release. The obligations stack; satisfying one does not excuse another.

### 1. The Written Safety and Security Protocol

Every deployer must maintain a written safety and security protocol that is “separate and distinct from any other policies or procedures.” The protocol must specify:

- The deployer’s administrative, technical, and physical controls for preventing unauthorized access to the model.
- The deployer’s procedures for evaluating whether the model poses a hazardous capability, defined as the ability to enable a “critical harm”—mass casualties, at least $500 million in damages via cyberattack or CBRN incident, or comparable severity.
- The deployer’s process for implementing a full shutdown capability.

The protocol must be updated at least annually, and the deployer must designate a senior officer responsible for its maintenance. For venture-backed startups with fewer than 50 employees, this creates an immediate personnel requirement: someone with sufficient organizational authority must own the document, and that person’s name appears on a compliance record discoverable in any enforcement action.

### 2. The Shutdown Capability

SB-1047 requires deployers to implement and maintain “the capability to promptly enact a full shutdown” of any covered model or covered model derivative they control. The bill does not define “promptly” in milliseconds or seconds, but the legislative record from the August 2024 floor debates indicates an expectation of under one hour from decision to effective cessation.

For API-deployed models behind a commercial endpoint, a shutdown is architecturally straightforward: revoke API keys, disable the inference endpoint, and halt further token generation. For open-weight models distributed via Hugging Face or similar repositories, the shutdown requirement is harder to interpret. Once model weights are downloaded to third-party infrastructure, the original deployer has no technical mechanism to force cessation. The bill addresses this indirectly: the deployer must demonstrate that it has the capability to shut down the model “under its control,” not models running on third-party hardware. In practice, this means maintaining infrastructure-level access controls and documented runbooks, not building remote kill switches into distributed weights.

### 3. The Annual Third-Party Audit

Beginning January 1, 2026, each deployer must commission an annual audit by an independent auditor. The auditor must evaluate:

- The deployer’s compliance with its own safety and security protocol.
- The deployer’s compliance with the shutdown capability requirement.
- The deployer’s recordkeeping and reporting practices.

The auditor must produce a written report, and the deployer must retain it for at least seven years. The bill does not specify auditor qualifications in detail, but it requires that the auditor be “independent,” meaning no financial interest in the deployer and no involvement in the development or deployment of the model being audited. For the 2025 calendar year, the audit requirement is prospective; the first audit covering 2025 compliance must be completed by January 1, 2027. Deployers who go to market in Q1 2025 should begin identifying qualified auditors immediately, as the pool of firms with both AI safety domain expertise and independence from major AI developers is small and likely to become capacity-constrained.

### 4. Incident Reporting Within 72 Hours

If a covered model or derivative is involved in an “AI safety incident”—defined as an event that demonstrably increases the risk of a critical harm—the deployer must report it to the California Attorney General within 72 hours of discovery. The report must describe the incident, the hazardous capability implicated, and the steps taken to prevent recurrence.

The 72-hour clock starts when the deployer “knows or reasonably should have known” of the incident. This constructive-knowledge standard means that inadequate monitoring is not a defense. A deployer who ships a model without sufficient logging to detect misuse could be found in violation for failing to report an incident it should have caught. For startups building their first production monitoring stack, this imposes a minimum observability requirement that goes beyond standard application performance management.

### 5. Reasonable Assurance of Downstream Compliance

Any deployer who provides a covered model to a downstream deployer—whether via commercial license, open-weight release, or API—must obtain “reasonable assurance” that the downstream entity will comply with the bill’s requirements. The bill suggests contractual representations as a safe harbor, but it does not limit the obligation to contracts alone. A deployer who releases open weights with no downstream controls whatsoever likely fails this standard.

For open-source AI companies, this is the bill’s most contentious provision. The original August 2024 draft contained language that critics read as imposing liability on open-weight developers for downstream misuse they could not prevent. The final text softened this to a “reasonable assurance” standard, but the ambiguity leaves substantial enforcement discretion to the Attorney General and creates uncertainty for companies whose business model depends on unrestricted weight distribution.

## What SB-1047 Does Not Require

Understanding the bill’s limits is as operationally important as understanding its mandates. Several requirements that deployers might expect are absent.

### No Pre-Release Government Approval

SB-1047 does not require deployers to submit models for government approval before release. The bill pointedly avoids creating a licensing regime or a pre-market review process. This distinguishes it from the EU AI Act’s conformity assessment requirements for high-risk systems and from the FDA-style approval framework that some early bill drafts contemplated.

### No Mandatory Compute Caps

The bill does not cap training compute or restrict the size of models that can be developed. It regulates the deployment of large models, not their creation. A company can train a model using 10^27 operations inside California without triggering SB-1047 obligations, provided the model is never deployed or made available for use. This is a narrow carve-out—research labs that train frontier models for publication without release can operate outside the bill’s scope—but for any commercially oriented AI company, the deployment trigger is unavoidable.

### No Private Right of Action

Enforcement is vested exclusively in the California Attorney General. SB-1047 does not create a private right of action for individuals harmed by AI systems. Competitors cannot sue for noncompliance; users cannot bring class actions under the bill. This limits the litigation exposure to a single government enforcement channel, though the penalty amounts—$10 million for a first violation, $30 million for subsequent violations—are calibrated to deter even well-capitalized defendants.

## The Compliance Calendar: Key Dates for 2025-2027

The bill’s obligations phase in over a multi-year window. Deployers should calendar these dates:

- **January 1, 2025**: The bill’s operative provisions take effect. Any deployer of a covered model or derivative must have a written safety and security protocol in place, a designated responsible officer, and a shutdown capability.
- **January 1, 2026**: The annual audit requirement begins. Deployers must engage an independent auditor to evaluate compliance for the 2025 calendar year, with the first audit report due by January 1, 2027.
- **January 1, 2027**: The first audit reports are due. Deployers who have not completed their 2025 compliance audit by this date are in violation.
- **Ongoing**: Incident reports are due within 72 hours of discovery of any AI safety incident, with no phase-in period. The obligation is live as of January 1, 2025.

The 24-month gap between the bill’s effective date and the first audit deadline is a deliberate compliance ramp. Deployers who use 2025 to build their safety infrastructure, document their protocols, and engage auditors will face a manageable transition. Those who wait until Q4 2026 to begin will find the auditor pool fully booked and their compliance posture indefensible.

## Actionable Takeaways for Deployers

First, determine whether your model is covered. If your training run cost less than $100 million and your fine-tuning cost less than $10 million, SB-1047 does not apply to you. Document your compute usage and cost estimates now, because the burden of proving non-coverage in an enforcement action falls on the deployer. A dated internal memo with cloud billing data is worth more than a post-hoc justification.

Second, if you are covered, write the safety and security protocol this quarter. Do not treat it as a compliance checkbox. The protocol is the foundational document from which your shutdown capability, audit readiness, and incident response procedures all flow. Designate your responsible officer, draft the document, and run a tabletop exercise against a hypothetical incident before the end of Q1 2025.

Third, begin auditor outreach in Q2 2025, even though the first audit report is not due until January 2027. The pool of qualified independent auditors is small, and demand will spike as the deadline approaches. A retainer agreement signed in 2025 locks in capacity and gives the auditor time to understand your model architecture and deployment patterns before the formal evaluation begins.

Fourth, instrument your deployment for incident detection. The 72-hour reporting clock starts when you “reasonably should have known” of an incident. If your monitoring stack cannot surface anomalous model behavior within that window, you are structurally noncompliant. At minimum, log all prompts and completions for covered models, implement automated anomaly detection on output distributions, and establish an on-call rotation that can triage potential safety incidents around the clock.

Fifth, if you distribute open-weight derivatives of a covered model, obtain contractual representations from downstream deployers regarding their own SB-1047 compliance. This does not eliminate your risk—the Attorney General will evaluate reasonableness holistically—but it creates a paper trail that demonstrates good-faith effort. For companies whose entire distribution strategy depends on unrestricted open release, the legal uncertainty around this provision warrants a privileged conversation with counsel before the next major model drop.
