---
title: "AI Real Estate Valuation: Zillow Zestimate vs Redfin Estimate vs Custom AVMs in 2025"
description: "A quiet recalibration is under way in how residential property gets priced. On 15 March 2024 the US National Association of Realtors agreed to settle the Sit…"
category: "Industry Verticals"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:59:17Z"
modDatetime: "2026-05-18T08:59:17Z"
readingTime: 10
tags: ["Industry Verticals"]
---

A quiet recalibration is under way in how residential property gets priced. On 15 March 2024 the US National Association of Realtors agreed to settle the Sitzer-Burnett class-action lawsuit for US$418 million and, more consequentially, to eliminate the long-standing cooperative compensation rule. Effective 17 August 2024, MLS listings across most of the country no longer carry a blanket buyer-agent commission offer. For the first time in decades, the price embedded in a listing does not bake in a 5-6% total commission split. That single regulatory change ripples straight into automated valuation models (AVMs). When the Zestimate on 123 Maple Drive says US$542,300, it is drawing on a training corpus of comparables whose recorded sale prices included commissions that no longer exist in the same form. Meanwhile, institutional buyers and iBuyers are running their own custom AVMs on the same property and arriving at numbers that diverge by 3-8%. For a US$500,000 home, that gap is US$15,000-40,000, real money for a buyer calculating a down payment or a founder deciding whether to liquidate personal real estate to extend runway. The question is no longer whether AVMs work. It is which model family, trained on which data cut, reflects the post-settlement market accurately enough to act on.

## The AVM Landscape in Early 2025

### Zillow Zestimate: Reach, Recency, and the Commission Blind Spot

Zillow’s public-facing Zestimate covers more than 104 million US homes. In a technical disclosure last updated 6 November 2024, Zillow states the current model has a national median error rate of 2.1% for on-market homes and 6.9% for off-market homes. The on-market figure is competitive. The off-market figure matters more than it looks because post-settlement, a larger share of homes that will transact in 2025 sat off-market when the buyer started evaluating them.

The Zestimate architecture, as described in Zillow’s published engineering notes, is an ensemble that blends a gradient-boosted tree model with a convolutional neural network trained on listing photographs and a separate geospatial model that ingests lot boundaries, flood-zone polygons, and school-attendance zones. Photographs are processed through a ResNet-derived backbone that Zillow has not re-versioned publicly since mid-2023. The photo model was originally trained to price the visual amenity of a kitchen remodel at roughly US$12,000-18,000 depending on market. That figure was calibrated against pre-settlement comps where the recorded sale price included a 2.5-3% buyer-agent commission. The model has no explicit commission-channel feature, so it cannot strip out the commission component from its training labels. A Zillow economist noted in a 26 September 2024 blog post that the company is “monitoring” the commission change but has not yet released a retrofitted model.

For a buyer in Austin, Texas, in February 2025, the practical implication is that a Zestimate on a 3-bedroom off-market home may lag the post-settlement clearing price by roughly the legacy buyer-agent commission embedded in the comps, about 2.4-3.1% depending on the submarket. That is not a rounding error. It is the difference between a 20% down payment clearing mortgage insurance thresholds and falling short.

### Redfin Estimate: Brokerage Data and the Active-Listing Bias

Redfin’s Estimate covers approximately 92 million homes and reports a current median error rate of 1.9% for active listings and 6.3% for off-market homes, per Redfin’s 2024 Q3 shareholder letter published 7 November 2024. The active-listing error is marginally lower than Zillow’s. Redfin attributes the edge to its brokerage data pipeline: because Redfin agents close roughly 70,000 transactions per year, the model ingests listing-agent notes, inspection-report flags, and time-on-market signals that a pure MLS-scraping model cannot see.

The Redfin Estimate model is a gradient-boosted tree with a feature set that includes days-on-market, list-price-to-sale-price ratio history for the specific listing agent, and a proprietary “Hot Homes” score that predicts the probability of an offer within 14 days. The model retrains nightly. That cadence is fast enough to absorb the commission-rule change as it shows up in new closed-sale records. By late February 2025, roughly six months of post-settlement transactions will have flowed into the training set, enough for the model to begin unlearning the old commission-inflated labels. Redfin’s chief economist stated in a 16 December 2024 market update that the company expects the estimate error on off-market homes to tighten by 0.5-0.8 percentage points through Q2 2025 as more post-August-2024 sales are ingested.

The limitation is coverage depth. In markets where Redfin’s brokerage share is below 5%, the model reverts to MLS-only features and its error rate widens toward 8-9% off-market. A buyer in a Redfin-thin market such as Birmingham, Alabama, or Buffalo, New York, is effectively using a different, weaker model than a buyer in Seattle or San Diego.

### Custom AVMs: Institutional-Grade Precision at a Cost

Institutional buyers, iBuyers, and a growing number of proptech startups do not rely on Zillow or Redfin. They build custom AVMs on top of MLS bulk-data licenses, county assessor records, and private datasets such as rent-roll data from single-family rental operators. These models are typically XGBoost or LightGBM ensembles with 400-800 features, trained on 5-10 years of transaction history for a single MSA. The best-performing custom AVMs achieve a median absolute percentage error of 1.3-1.8% for on-market homes and 3.5-5.0% for off-market homes in their target MSAs, according to a benchmark study by HouseCanary published 12 January 2025 that compared 14 institutional AVMs across 22 US metro areas.

The cost structure is the barrier. An MLS bulk-data license for a mid-sized MSA runs US$1,200-3,000 per month. A clean, deduplicated training pipeline requires a data engineer spending 20-40 hours per MSA. Cloud compute for nightly retraining on 500,000-2,000,000 rows costs roughly US$400-900 per month on AWS SageMaker or an equivalent platform. The all-in cost for a single-MSA custom AVM is US$3,000-6,000 per month before any model-risk governance or compliance overhead. That is trivial for a fund deploying US$50 million in a market. It is prohibitive for an individual homebuyer.

What has changed in 2025 is that a layer of “AVM-as-a-service” vendors, including HouseCanary, Clear Capital, and Quantarium, now offer per-report pricing at US$25-75 per property. These vendors run custom models on their own MLS licenses and sell the output. The median error rates they quote are in the 2.0-3.5% range for off-market homes, splitting the difference between public AVMs and fully bespoke institutional models. For a homebuyer evaluating three properties, spending US$75-225 on third-party AVMs is a rational hedge against a US$15,000-40,000 mispricing.

## What the Models Actually See (and Miss)

### The Commission Contamination Problem

Every AVM trained on pre-August-2024 transaction data has a label problem. The recorded sale price in the MLS is the contract price, not the net-to-seller price. The buyer-agent commission, typically 2.4-3.1% of the sale price, was paid by the seller out of the contract price and is therefore baked into the label the model learns to predict. When the cooperative compensation rule was eliminated, the economic incidence of the buyer-agent fee shifted. In a growing share of 2025 transactions, the buyer pays their agent directly, and the contract price is lower by roughly the amount of the former commission. A model trained on pre-settlement data will systematically overestimate the contract price of a post-settlement transaction by 2-3%.

The magnitude varies by market. In Seattle, where buyer-agent commissions averaged 2.5% pre-settlement, the overestimate is roughly US$20,000 on a US$800,000 home. In New York City, where co-op transactions dominate and commissions were already structured differently, the effect is smaller, closer to 1.0-1.5%. A custom AVM trained only on post-August-2024 data avoids the contamination entirely. Zillow and Redfin are in an intermediate state, with a growing but still minority share of post-settlement transactions in their training sets as of February 2025.

### The iBuyer Signal Leakage

Opendoor and Offerpad paused purchasing in most markets through 2023 and re-entered selectively in Q3 2024. When an iBuyer makes an offer on a home, that offer price is not recorded in the MLS, but the eventual resale price is. An AVM trained on MLS data that includes iBuyer resales is learning from labels that reflect the iBuyer’s renovation spend, holding costs, and margin target, not the market-clearing price of an unrenovated home. A 2024 academic study by researchers at the University of Texas at Austin, published in the Journal of Real Estate Finance and Economics on 3 October 2024, found that iBuyer resales in Phoenix and Atlanta closed at a 4.2-5.8% premium relative to comparable non-iBuyer transactions, controlling for renovation quality. An AVM that does not flag iBuyer-resale comps will import that premium into its estimate. Custom AVMs typically filter out iBuyer transactions from the training set or include an iBuyer flag as a feature with a negative coefficient. Public AVMs do not disclose their treatment of iBuyer comps.

### Photograph-Driven Overfitting in Hot Markets

Both Zillow and Redfin use listing photographs as model inputs. In a hot market where homes are staged professionally and photographed with wide-angle lenses, the photo model learns to associate high-quality photography with higher sale prices. That correlation is real but partly spurious: the same home photographed with an iPhone 12 by the owner would not command the same model-estimated value. Zillow’s own research, presented at a 2023 internal engineering symposium and summarized in a public blog post on 14 September 2023, found that the photo model added roughly 1.2 percentage points of error reduction in coastal markets but increased error by 0.4-0.7 percentage points in markets where listing-photo quality varies widely. The net effect is that Zestimates in markets like San Francisco, where virtually every listing has professional photography, are more stable than in markets like Cleveland, where photo quality is heterogeneous. A buyer evaluating a Cleveland home with amateur photos should mentally add a 1-3% uncertainty band to the Zestimate, not because the model is broken but because the photo feature is operating outside its reliable range.

## Building vs. Buying Valuation Intelligence in 2025

### The Off-the-Shelf Stack

For an individual homebuyer or a founder evaluating a single property, the pragmatic stack in February 2025 is: pull the Zestimate and Redfin Estimate, note the spread between them, and order one or two paid AVMs from HouseCanary or Clear Capital at US$25-75 each. If the spread between the public estimates is less than 3%, the property is likely in a liquid, well-comped market and the public estimates are reasonably reliable. If the spread exceeds 5%, the property is in a market where the models are struggling with thin comps, unique features, or the commission transition, and a paid AVM is worth the cost. This stack costs under US$150 and takes 30 minutes.

### The Custom-AVM Path

For a proptech startup or a small fund making 10-50 acquisitions per year in a single MSA, the custom-AVM path is economically rational at transaction volumes above roughly US$5 million per year. The build involves: (1) license MLS bulk data for the target MSA, (2) ingest county assessor records and geocode to parcel level, (3) train an XGBoost or LightGBM model with 400-800 features including time-on-market, list-price history, assessor square footage, lot-size irregularity, flood-zone designation, school-attendance boundary, and a post-August-2024 date flag, (4) backtest on a rolling 12-month holdout set, and (5) deploy nightly retraining on AWS SageMaker or a comparable platform. The median error rate achievable with this approach is 1.3-1.8% on-market and 3.5-5.0% off-market, per the HouseCanary benchmark cited above. The build takes 4-8 weeks of engineering time and costs US$3,000-6,000 per month to operate.

### The Commission-Adjustment Heuristic

For buyers who want a quick adjustment to public AVMs without building a custom model, a simple heuristic is defensible through mid-2025. Take the Zestimate or Redfin Estimate and multiply by 0.975 for markets where the pre-settlement buyer-agent commission averaged 2.5%. For markets where it averaged 3.0%, multiply by 0.97. This is a blunt instrument. It assumes the full commission is coming out of the contract price, which will not be true in every transaction. But it is directionally correct and backed by the economic logic of the settlement. A buyer who applies this heuristic to a US$500,000 Zestimate arrives at US$487,500, a US$12,500 haircut that approximates the commission component the model has not yet unlearned.

## What to Do with This Information

First, treat any AVM estimate dated before August 2024 as stale. The commission-rule change is a structural break in the time series, and models trained across that break are blending two different economic regimes. If a Zestimate or Redfin Estimate is the only data point, apply the commission-adjustment heuristic of 0.97-0.975 and treat the result as a central estimate with a ±3% uncertainty band.

Second, for any transaction above US$500,000, spend the US$75-225 on one or two paid AVMs from vendors whose models are trained on post-August-2024 data. The cost is less than 5 basis points of the transaction value. The information gain, measured as error reduction from 6-7% to 2-3.5% off-market, is worth roughly US$15,000-25,000 on a US$500,000 home.

Third, if you are building a custom AVM, flag iBuyer-resale comps explicitly. Do not let Opendoor’s renovation spend and margin target contaminate your training labels. A simple binary feature for iBuyer involvement, with a negative coefficient, is a low-effort fix that the public AVMs have not disclosed implementing.

Fourth, do not use photograph-driven estimates as a primary valuation signal in markets with heterogeneous photo quality. In a Cleveland or a Birmingham, the photo model is adding noise, not signal. Rely on the non-photo features or use a paid AVM that discloses its photo-model treatment.

Fifth, monitor the error-rate disclosures that Zillow and Redfin publish quarterly. When the off-market median error rate drops below 5% for either model, that is the signal that the commission transition has been substantially absorbed into the training data. Until then, the buyer’s edge lies in knowing what the models do not yet know.
