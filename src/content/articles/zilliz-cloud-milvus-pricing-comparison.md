---
title: "Zilliz Cloud Milvus Pricing Comparison with Self-Hosted on EKS"
description: "The cost of running a vector database in production has shifted under the feet of engineering teams in the past twelve months. AWS raised its standard EKS co…"
category: "Vector Databases"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:48:01Z"
modDatetime: "2026-05-18T08:48:01Z"
readingTime: 11
tags: ["Vector Databases"]
---

The cost of running a vector database in production has shifted under the feet of engineering teams in the past twelve months. AWS raised its standard EKS control plane fee from $0.10 to $0.12 per hour in April 2024, a 20% increase that barely registered in isolation but compounds meaningfully when layered with the node, storage, and data transfer costs of a self-hosted Milvus deployment. At the same time, Zilliz Cloud revised its CU (compute unit) pricing tiers in January 2025, introducing a reserved capacity discount that shaves 30% off the on-demand rate for annual commitments. The net effect is that the break-even point between managed and self-hosted Milvus has moved. Teams that last ran the numbers in mid-2023 are operating on stale assumptions. This article recalculates that break-even for a realistic production workload on EKS, using the Zilliz Cloud pricing page as of February 2025 and AWS us-east-1 list prices as of the same date, so that technical buyers can make a decision anchored to current data rather than outdated blog posts.

## Infrastructure Footprint of a Self-Hosted Milvus Cluster on EKS

A production-grade Milvus deployment is not a single binary. The architecture spans eight microservices: a root coordinator, query coordinator, data coordinator, index coordinator, proxy, query node, data node, and index node. These are typically packaged into four Kubernetes workload groups: coordinators, proxies, query nodes, and data/index nodes. Each group has distinct compute and memory requirements, and undersizing any one of them leads to query timeouts or index build failures.

### Baseline Cluster Topology for 10M 768-Dimensional Vectors

For a workload of 10 million vectors at 768 dimensions with IVF_FLAT indexing and a target recall of 95%, the minimum stable topology observed in community benchmarks and Zilliz’s own published reference architectures (Milvus 2.4.x documentation, October 2024) is:

- **Coordinators + Proxies**: 2 × c6i.xlarge (4 vCPU, 8 GiB) for redundancy, deployed across two AZs.
- **Query Nodes**: 2 × c6i.2xlarge (8 vCPU, 16 GiB) to hold the indexed data in memory. With 10M vectors at 768 dimensions using float32, the raw vector data is approximately 28.8 GB. IVF_FLAT index overhead pushes working memory to roughly 35 GB, which fits across two 16 GiB nodes with headroom for query burst.
- **Data/Index Nodes**: 2 × c6i.2xlarge (8 vCPU, 16 GiB) for index builds and compaction. Index construction is CPU-intensive; undersizing here extends index build time from minutes to hours.
- **Meta Storage**: AWS RDS PostgreSQL db.t4g.medium (2 vCPU, 4 GiB, 20 GB gp3) for metadata coordination. Milvus uses etcd for service discovery and PostgreSQL for metadata persistence.
- **Object Storage**: S3 Standard with 100 GB initial allocation for binlogs, delta logs, and index files. Milvus writes WAL segments to S3 via MinIO or direct S3 SDK calls.
- **Message Queue**: A self-managed Pulsar cluster or AWS MSK. The reference architecture uses Pulsar with 3 × t3.medium nodes for a small workload. MSK with 2 × kafka.t3.small brokers is a managed alternative but adds broker costs.

### Monthly EKS and Compute Costs

The EKS control plane at $0.12/hour costs $86.40 per month per cluster. A single-cluster deployment avoids multiplying this charge.

EC2 compute for the eight instances (2 coordinators/proxies, 2 query nodes, 2 data/index nodes, plus 2 for Pulsar) totals 8 instances. On-demand pricing in us-east-1 as of February 2025:

- c6i.xlarge: $0.17/hour → 2 instances × 730 hours × $0.17 = $248.20/month
- c6i.2xlarge: $0.34/hour → 4 instances × 730 hours × $0.34 = $992.80/month
- t3.medium (Pulsar): $0.0416/hour → 2 instances × 730 hours × $0.0416 = $60.74/month

EC2 subtotal: $1,301.74/month. Adding the EKS control plane ($86.40) brings the compute total to $1,388.14/month.

### Storage and Data Transfer

RDS PostgreSQL db.t4g.medium with 20 GB gp3 storage: $0.073/hour compute + $0.08/GB-month storage. Compute: $53.29/month. Storage: 20 × $0.08 = $1.60/month. RDS total: $54.89/month.

S3 Standard at $0.023/GB-month for the first 50 TB: 100 GB × $0.023 = $2.30/month. PUT/GET requests for WAL operations add approximately $5/month for this workload size based on Milvus’s write-ahead patterns.

Pulsar requires 100 GB gp3 EBS volumes per broker for journal storage: 2 × 100 GB × $0.08/GB-month = $16.00/month.

Data transfer within the same AZ is free. Cross-AZ traffic between the two AZs for query and data node communication is approximately 50 GB/month for a read-heavy workload. At $0.01/GB, that adds $0.50/month. Egress to the internet for client queries varies by application but is excluded from this baseline.

### Operational Labor

Self-hosting Milvus on EKS requires ongoing engineering time. A conservative estimate based on community surveys (Milvus User Survey 2024, published September 2024) is 8-12 hours per month for version upgrades, index tuning, Pulsar maintenance, and incident response. At a fully loaded engineering cost of $100/hour, that is $800-$1,200/month. This article uses $1,000/month as the midpoint.

### Total Self-Hosted Monthly Cost

| Line Item | Monthly Cost |
|---|---|
| EC2 compute (8 instances) | $1,301.74 |
| EKS control plane | $86.40 |
| RDS PostgreSQL | $54.89 |
| S3 storage + requests | $7.30 |
| EBS for Pulsar | $16.00 |
| Cross-AZ data transfer | $0.50 |
| Operational labor (midpoint) | $1,000.00 |
| **Total** | **$2,466.83** |

This figure excludes reserved instance discounts. Applying a 1-year RI commitment to the c6i instances reduces EC2 by roughly 30%, bringing the total to approximately $2,076/month. The analysis below uses both on-demand and RI-adjusted numbers.

## Zilliz Cloud Pricing for an Equivalent Workload

Zilliz Cloud abstracts the infrastructure into compute units (CUs). A CU bundles vCPU, memory, and the Milvus software layer. The service offers Standard, Enterprise, and Bring Your Own Cloud (BYOC) plans. The Standard plan is the closest comparison to a self-hosted deployment on EKS.

### CU Sizing for 10M Vectors

Zilliz Cloud’s capacity calculator (February 2025) maps a 10M-vector dataset at 768 dimensions to a cluster with 8 CUs for the query+data plane and 2 CUs for the coordinator+proxy layer, totaling 10 CUs. The CUs are provisioned on AWS infrastructure and include the equivalent of the query nodes, data nodes, index nodes, coordinators, and proxies from the self-hosted topology. Object storage (S3-compatible) and metadata storage are included in the CU price; there are no separate RDS or S3 line items.

### On-Demand vs. Reserved Pricing

As of the January 2025 pricing update, Zilliz Cloud Standard plan CUs in us-east-1 cost:

- On-demand: $0.40/CU-hour
- Annual reserved: $0.28/CU-hour (30% discount)

For 10 CUs running 730 hours/month:

- On-demand: 10 × 730 × $0.40 = $2,920.00/month
- Annual reserved: 10 × 730 × $0.28 = $2,044.00/month

The annual reserved plan requires a 12-month commitment. The on-demand plan can be scaled down or terminated at any time.

### Included Components

The CU price includes the Milvus software, all underlying EC2 instances, metadata storage, object storage, message queue, monitoring, and the managed control plane. There is no separate charge for S3, RDS, or Pulsar/MSK. Data transfer within the Zilliz Cloud VPC is included. Internet egress is charged at $0.05/GB after the first 10 GB free per month, which is comparable to AWS egress pricing.

### Operational Labor Reduction

Zilliz Cloud handles version upgrades, index tuning, node recovery, and scaling operations. The operational labor line item drops from $1,000/month to approximately $100/month for account management and monitoring configuration. This is a direct saving of $900/month.

### Total Zilliz Cloud Monthly Cost

| Plan | CU Cost | Egress (est.) | Operational Labor | Total |
|---|---|---|---|---|
| On-demand | $2,920.00 | $5.00 | $100.00 | $3,025.00 |
| Annual reserved | $2,044.00 | $5.00 | $100.00 | $2,149.00 |

## Break-Even Analysis: Self-Hosted vs. Zilliz Cloud

The comparison hinges on whether the self-hosted deployment uses on-demand or reserved EC2 instances, and whether the Zilliz Cloud deployment uses on-demand or annual reserved CUs.

### Self-Hosted On-Demand vs. Zilliz On-Demand

Self-hosted on-demand total: $2,466.83/month. Zilliz on-demand total: $3,025.00/month. Zilliz Cloud is $558.17/month more expensive, a 22.6% premium over self-hosting. For teams that cannot commit to reserved instances and need full flexibility, self-hosting remains cheaper on pure infrastructure spend.

### Self-Hosted with 1-Year RI vs. Zilliz Annual Reserved

Self-hosted with RI: $2,076.00/month. Zilliz annual reserved: $2,149.00/month. Zilliz Cloud is $73.00/month more expensive, a 3.5% premium. At this level, the cost difference is within the margin of error for data transfer and storage fluctuations. The two options are effectively at parity on monthly spend.

### Hidden Costs That Shift the Equation

Three factors tilt the comparison in practice:

**Index build time.** Self-hosted Milvus on c6i.2xlarge instances builds an IVF_FLAT index for 10M 768-dim vectors in approximately 45 minutes according to Milvus 2.4 benchmark results published in the Milvus GitHub repository (October 2024). Zilliz Cloud’s managed index pipeline completes the same build in roughly 20 minutes due to optimized instance selection and parallelization. For workloads that re-index frequently (e.g., daily batch updates), the faster build time translates to lower query latency during rebuild windows and reduced compute overlap. This is an operational benefit not captured in monthly cost.

**Scaling events.** Self-hosted clusters require manual intervention to add query nodes when QPS exceeds capacity. Zilliz Cloud’s auto-scaling, available on the Enterprise plan but not the Standard plan compared here, adds 15-20% to the CU cost but eliminates the risk of query degradation during traffic spikes. For teams on the Standard plan, scaling is still a manual CU adjustment but does not require instance provisioning or Kubernetes node group changes.

**Multi-region replication.** Self-hosting Milvus across two regions doubles the infrastructure cost and adds cross-region data transfer at $0.02/GB. Zilliz Cloud’s BYOC plan supports multi-region replication with a 1.5× CU multiplier per region, which is simpler to operate but requires the BYOC pricing tier. This comparison is beyond the scope of a single-region deployment but becomes the dominant cost factor for global applications.

## When Self-Hosting Makes Sense

Self-hosting on EKS remains the right choice for teams with specific constraints.

### Existing Kubernetes Investment

Teams already running production workloads on EKS with established GitOps pipelines, monitoring stacks, and on-call rotations can absorb Milvus without incremental platform cost. The EKS control plane fee is already paid. The operational labor for Milvus is incremental to an existing Kubernetes operations team, and the effective marginal cost of adding Milvus is lower than the $1,000/month midpoint used here. For a team with 20 existing EKS clusters, adding Milvus to one of them does not increase the control plane bill.

### Data Residency and Compliance Requirements

Self-hosting provides full control over data locality, encryption key management, and audit logging. Zilliz Cloud’s Standard plan encrypts data at rest and in transit but does not offer customer-managed KMS keys or VPC peering. The Enterprise and BYOC plans add these features but at higher CU rates. Teams subject to SOC 2 Type II or HIPAA compliance may find self-hosting necessary until Zilliz Cloud completes its HIPAA attestation, which is listed as “in progress” on the Zilliz trust page as of February 2025.

### Workloads With Highly Variable Query Patterns

Self-hosted Milvus on EC2 spot instances can reduce compute costs by 60-70% for fault-tolerant workloads. Spot instances are not available on Zilliz Cloud. A self-hosted cluster using spot instances for query nodes and on-demand for coordinators and data nodes can achieve a monthly compute cost below $800, which undercuts Zilliz annual reserved pricing by more than 50%. The trade-off is the risk of spot interruptions during index builds, which requires careful state management.

## When Zilliz Cloud Is the Better Choice

Zilliz Cloud’s value proposition sharpens for teams without dedicated infrastructure engineers.

### Small Engineering Teams

For teams of 2-5 engineers where no one has deep Kubernetes operational experience, the $900/month labor savings from Zilliz Cloud’s managed operations outweighs the on-demand premium. The 3.5% annual reserved premium is negligible compared to the opportunity cost of diverting engineering time from product development to database administration. A 2024 survey by VectorDBBench (published August 2024) found that self-hosted Milvus users reported an average of 2.3 production incidents per quarter related to index out-of-memory errors or Pulsar partition skew, each requiring 2-4 hours to resolve. Eliminating that incident load has value beyond the hourly labor rate.

### Rapid Prototyping and Variable Workloads

Zilliz Cloud’s on-demand plan allows teams to spin up a production-grade Milvus cluster in under 10 minutes and tear it down when a prototype concludes. Self-hosting requires Terraform modules, Helm charts, and at least a day of configuration even with the Milvus Operator. For a 3-month proof-of-concept, the self-hosted setup cost in engineering time alone exceeds the Zilliz Cloud premium for the entire period.

### Predictable Budgeting

The annual reserved plan fixes the vector database cost at $2,044/month for 12 months, independent of AWS price changes, instance availability, or data transfer fluctuations. Self-hosted costs are exposed to EC2 spot market volatility, S3 request pricing changes, and the risk of misconfigured auto-scaling that generates unexpected compute charges. For finance teams that prefer fixed infrastructure line items, the Zilliz Cloud annual reserved plan provides budget certainty that self-hosting cannot match.

## Actionable Takeaways

1. **Run the numbers with your actual vector count and dimensions.** The 10M-vector benchmark here is a reference point. A deployment with 50M vectors at 1,536 dimensions will push query node memory requirements beyond c6i.2xlarge into c6i.4xlarge territory, shifting the break-even. Use the Zilliz Cloud CU calculator and the AWS Pricing Calculator with your specific parameters before deciding.

2. **Factor operational labor at your actual loaded cost.** If your team’s effective engineering rate is $150/hour and you expect 15 hours/month of Milvus maintenance, self-hosting adds $2,250/month in labor, making Zilliz Cloud annual reserved cheaper by roughly $100/month. If you have a dedicated platform team that manages Kubernetes as a shared service, the incremental labor may be near zero, and self-hosting wins on cost.

3. **Commit to annual reserved on whichever path you choose.** The 30% discount on Zilliz Cloud annual reserved and the comparable AWS 1-year RI discount for EC2 both require 12-month commitments. Month-to-month pricing on either side carries a significant premium. The decision between self-hosted and managed should be made with a 12-month horizon; switching costs mid-year erase the reserved discounts.

4. **Evaluate the BYOC plan if compliance is the blocker.** Zilliz Cloud’s BYOC plan deploys the managed Milvus software inside your own AWS account, giving you control over VPC configuration, KMS keys, and audit trails. Pricing is custom-quoted but typically runs 20-40% above the Enterprise plan. For teams that need compliance controls and want to avoid Kubernetes operations, BYOC is the middle ground worth pricing out.

5. **Test index build performance with your own data before committing.** The 45-minute vs. 20-minute index build difference cited here is from published benchmarks on uniform random vectors. Real-world embeddings from models like text-embedding-3-large or Cohere Embed v3 have different clustering properties that affect build time. Run a benchmark with 1M of your own vectors on both a self-hosted dev cluster and a Zilliz Cloud trial before signing an annual contract.
