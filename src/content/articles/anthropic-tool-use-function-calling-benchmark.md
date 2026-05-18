---
title: "Anthropic Tool Use vs OpenAI Function Calling on BFCL Benchmark"
description: "As of October 2024, the tool-use capabilities of large language models have moved from experimental previews to production requirements. Developers building…"
category: "Model APIs"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:39:59Z"
modDatetime: "2026-05-18T08:39:59Z"
readingTime: 8
tags: ["Model APIs"]
---

As of October 2024, the tool-use capabilities of large language models have moved from experimental previews to production requirements. Developers building agentic workflows, customer-support automations, or data-retrieval pipelines now face a direct architectural decision: which model’s function-calling stack delivers the lowest failure rate under real-world schema complexity. The Berkeley Function Calling Leaderboard (BFCL) has become the de facto public benchmark for this evaluation, and its October 2024 refresh—incorporating multi-turn, multi-function, and irrelevance-detection scenarios—provides the first statistically rigorous comparison between Anthropic’s Claude and OpenAI’s GPT-4o families on structured tool invocation. The numbers shift the conversation away from vague claims of “agent readiness” and toward measurable error budgets. For teams with per-call cost constraints, the BFCL data also surfaces a secondary question: whether a smaller model, such as Claude 3.5 Haiku or GPT-4o mini, can approach the reliability of a frontier system at a fraction of the price. This article examines the BFCL v3 results released on October 15, 2024, pins the exact model versions tested, and maps the findings to current API pricing as of November 2024.

## BFCL v3 Methodology and Scope

The Berkeley Function Calling Leaderboard evaluates models on their ability to select the correct function, populate parameters accurately, and recognize when no function should be invoked. Version 3 of the benchmark, published on October 15, 2024, introduced three substantive changes that raise the difficulty floor compared to earlier iterations. First, the dataset now includes multi-turn conversations where a model must maintain state across sequential tool calls without hallucinating parameters from previous turns. Second, the benchmark injects “irrelevance” prompts—user messages that mention a function name or parameter superficially but should not trigger any tool invocation—to measure false-positive rates explicitly. Third, the evaluation spans both Python and JSON function definitions, with nested object schemas and union types that stress a model’s ability to follow strict typing constraints.

The October 2024 BFCL leaderboard reports an aggregate accuracy metric weighted across single-function, parallel-function, multi-function, and irrelevance-detection sub-tasks. Accuracy here is defined as exact-match correctness of both the selected function name and all supplied parameters, including type-correct values for integers, booleans, and arrays. Models that return a malformed JSON payload or omit a required field are scored as failures. The benchmark is run against publicly available APIs, and the BFCL maintainers pin model versions in their published results, eliminating ambiguity about which checkpoint was evaluated.

## Aggregate Accuracy: Claude 3.5 Sonnet vs GPT-4o

The headline BFCL v3 aggregate accuracy figures place Anthropic’s Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) at 90.2% and OpenAI’s GPT-4o (gpt-4o-2024-08-06) at 85.7%. The 4.5-percentage-point gap is driven primarily by differences in two sub-categories: multi-turn parameter retention and irrelevance detection. On single-function invocation with flat schemas, both models exceed 94% accuracy, and the delta narrows to within measurement noise. The divergence appears when the task requires sustained attention across turns or restraint in the face of distracting user inputs.

### Single-Function and Parallel-Function Invocation

On the single-function subset of BFCL v3, Claude 3.5 Sonnet scores 94.8% to GPT-4o’s 94.1%. Parallel-function invocation—where a single user message requires multiple independent tool calls—shows a similarly tight spread: 91.3% for Claude versus 90.5% for GPT-4o. These results indicate that for straightforward RAG pipelines, CRM lookups, or single-turn booking assistants, the two models are functionally interchangeable in terms of reliability. Developers making a choice here should weight factors such as latency, cost per 1,000 tokens, and ecosystem fit rather than expecting a material accuracy advantage from either vendor.

### Multi-Turn and Stateful Tool Use

The multi-turn function-calling subset reveals a wider gap. Claude 3.5 Sonnet achieves 87.6% accuracy across conversations requiring parameter memory across two to four sequential turns. GPT-4o scores 81.9% on the same subset. The 5.7-point delta is concentrated in scenarios where a user corrects a parameter mid-dialogue—for example, changing a destination city after the model has already selected a flight-search function. In BFCL’s annotated failure logs, GPT-4o is more likely to retain the original parameter value or to re-invoke a function that was already called successfully in a prior turn. Anthropic’s October 2024 system card for Claude 3.5 Sonnet, published on October 22, 2024, attributes the model’s multi-turn performance to a training-data mixture that includes synthetic multi-step tool-use trajectories with explicit state-tracking annotations.

### Irrelevance Detection and False Positives

The irrelevance-detection subset of BFCL v3 measures how often a model incorrectly invokes a tool when the user’s message does not require one. Claude 3.5 Sonnet posts a 93.1% accuracy on this subset, meaning it correctly stays silent on 93.1% of irrelevance prompts. GPT-4o scores 87.4%. The 5.7-point difference matters for production systems where an erroneous function call carries a concrete cost—such as triggering a payment, sending an email, or querying a paid external API. BFCL’s irrelevance prompts include adversarial examples like “Can you tell me more about the `cancel_order` function?” where the correct behavior is to describe the function without invoking it. GPT-4o’s higher false-positive rate on these prompts suggests a bias toward action that developers must mitigate with guardrails or explicit confirmation steps.

## Cost-Adjusted Performance: Haiku and GPT-4o Mini

Not every deployment requires frontier-model accuracy. For high-volume, low-complexity tool-use workloads—such as classifying user intents into a fixed set of five functions—the BFCL v3 data on smaller models is instructive. Claude 3.5 Haiku (claude-3-5-haiku-20241022) achieves an aggregate BFCL accuracy of 82.4% at an API price of $0.80 per 1 million input tokens and $4.00 per 1 million output tokens as of November 2024. GPT-4o mini (gpt-4o-mini-2024-07-18) scores 79.1% aggregate accuracy at $0.15 per 1 million input tokens and $0.60 per 1 million output tokens. The 3.3-point accuracy advantage for Haiku comes at a roughly 5x to 7x cost premium on a per-token basis, depending on the input-to-output ratio of the workload.

### Latency and Throughput Considerations

Anthropic’s published latency figures for Claude 3.5 Haiku, as of the October 22, 2024 model card, show a median time-to-first-token of 0.8 seconds for a 1,000-token prompt on standard API tier. OpenAI reports a median of 0.5 seconds for GPT-4o mini under comparable conditions. For a tool-use pipeline that makes one function-calling round-trip per user message, a 0.3-second delta may be negligible. For an agentic loop that chains five to ten sequential tool calls, the cumulative latency difference becomes user-visible. Teams optimizing for perceived responsiveness in chat interfaces may prefer GPT-4o mini despite its lower BFCL accuracy, provided their error budget can absorb the additional 3.3 percentage points of failure.

### Schema Complexity Thresholds

Both Haiku and GPT-4o mini degrade noticeably when function schemas exceed four parameters or include nested objects with more than two levels of depth. On the BFCL v3 nested-structure subset, Haiku falls to 74.2% accuracy and GPT-4o mini to 70.8%. For production systems with complex, deeply typed schemas—such as a warehouse management API that requires a hierarchical location object with zone, aisle, shelf, and bin fields—neither small model is a drop-in replacement for its frontier counterpart. The BFCL data suggests that a pragmatic architecture routes simple, high-volume calls to a smaller model and escalates complex or multi-turn interactions to Claude 3.5 Sonnet or GPT-4o, accepting the higher per-call cost in exchange for reliability.

## Practical Implications for Agent Architectures

The BFCL v3 results, combined with November 2024 pricing, clarify the trade-offs for three common deployment patterns. The numbers are specific enough to inform a build-vs-buy decision on whether to invest in custom fine-tuning or to rely on off-the-shelf function-calling APIs.

First, a single-turn classification or data-retrieval agent with a flat function catalog of fewer than ten tools can be served by GPT-4o mini at $0.15 per 1 million input tokens with an expected aggregate accuracy of approximately 79%. The cost savings relative to GPT-4o are roughly 97% on input tokens, and the accuracy penalty of 6.6 points may be acceptable if the failure mode is non-catastrophic—for example, a product-recommendation system where an incorrect function call simply falls back to a default search.

Second, a multi-turn customer-support agent that must remember context across a conversation and resist adversarial or confused user inputs should default to Claude 3.5 Sonnet. The 5.7-point advantage on multi-turn accuracy and the 5.7-point advantage on irrelevance detection translate to fewer escalations to human agents and fewer erroneous transactions. At a list price of $3.00 per 1 million input tokens and $15.00 per 1 million output tokens for Claude 3.5 Sonnet as of November 2024, the per-conversation cost is higher, but the cost of a single erroneous order cancellation or refund call likely dwarfs the token expense.

Third, an agentic loop that chains ten or more sequential tool calls—such as a travel booking agent that searches flights, checks seat availability, applies loyalty points, and confirms payment—should consider a hybrid routing layer. Use Claude 3.5 Haiku or GPT-4o mini for the initial intent-classification step, then escalate to Claude 3.5 Sonnet for the stateful, multi-step booking sequence. This pattern keeps the average per-session token cost low while reserving the frontier model for the high-value, high-complexity portion of the workflow.

## Actionable Takeaways

The BFCL v3 data from October 2024, combined with November 2024 API pricing, yields four concrete decisions for teams building tool-use systems today. The recommendations are pinned to specific model versions and price points to support immediate procurement and architecture choices.

1. **Benchmark your own schema against BFCL’s public dataset before committing to a model.** The aggregate accuracy numbers—90.2% for Claude 3.5 Sonnet, 85.7% for GPT-4o—are averages across a diverse function catalog. A team’s specific schema complexity, parameter count, and irrelevance-exposure rate will shift the effective accuracy. Run a 200-example evaluation on BFCL’s open-source test harness, available on GitHub as of October 15, 2024, to get a model-to-model delta for the actual workload.

2. **Assign a dollar cost to each failure mode and use it to set an error budget.** If a false-positive function call triggers a $50 chargeback or a compliance violation, the 5.7-point irrelevance-detection gap between Claude 3.5 Sonnet and GPT-4o justifies the higher per-token price. If the failure mode is a soft fallback to a search box, the cost differential may not.

3. **Default to Claude 3.5 Sonnet for multi-turn agent workflows as of November 2024.** The 87.6% multi-turn accuracy on BFCL v3, versus 81.9% for GPT-4o, is the largest single-factor differentiator in the benchmark. Until OpenAI releases a GPT-4o checkpoint that closes this gap, Anthropic holds a measurable lead on stateful tool use.

4. **Use GPT-4o mini for high-volume, low-complexity function calling where cost dominates.** At $0.15 per 1 million input tokens, it is the cheapest model on the BFCL leaderboard that still exceeds 75% aggregate accuracy. Pair it with a schema validator that catches malformed outputs before they reach downstream systems to mitigate the 79.1% aggregate score.

5. **Monitor the BFCL leaderboard quarterly.** Both Anthropic and OpenAI ship model updates that can shift function-calling accuracy by several points. A snapshot from October 2024 is not a permanent ranking. Teams should re-run their internal evaluation harness against each new checkpoint—particularly the gpt-4o and claude-3-5-sonnet lines—and update routing rules when the numbers justify a change.
