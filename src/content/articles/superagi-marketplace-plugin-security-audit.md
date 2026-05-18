---
title: "SuperAGI Marketplace Plugin Security Audit for Production Use"
description: "As of mid-2025, agent frameworks have moved from experimental sandboxes into production CI/CD pipelines, but their security posture remains the least audited…"
category: "Agent Platforms"
publishDate: "2026-05-18"
pubDatetime: "2026-05-18T08:23:41Z"
modDatetime: "2026-05-18T08:23:41Z"
readingTime: 9
tags: ["Agent Platforms"]
---

As of mid-2025, agent frameworks have moved from experimental sandboxes into production CI/CD pipelines, but their security posture remains the least audited link in the software supply chain. The SuperAGI Marketplace, launched in late 2024 as a central distribution point for community-built agent plugins, exemplifies the tension. On 12 March 2025, a third-party plugin named `superagi_google_sheets_connector` was flagged by the Open Web Application Security Project (OWASP) for exposing OAuth refresh tokens in plaintext within its runtime logs. The plugin had 4,200 active installs at the time of disclosure. That incident followed a broader pattern: the 2025 State of Agent Security report published by Lasso Security on 3 February 2025 found that 38% of agent marketplace plugins across five major platforms lacked input sanitization on tool-calling interfaces, and 22% shipped with hardcoded API keys. For teams evaluating SuperAGI as a production orchestrator, the question is no longer whether the core framework is stable—version 0.0.8, released 18 January 2025, has demonstrated uptime parity with LangGraph—but whether the marketplace plugin model introduces unacceptable blast radius. This audit examines the plugin sandboxing model, the permission escalation paths observed in the March 2025 incident, and the concrete steps a platform team can take to validate a plugin before it touches a production database.

## Plugin Sandbox Architecture and Its Limits

SuperAGI’s plugin execution model relies on a Docker-based sandbox that isolates each agent tool at the container level. When an agent invokes a marketplace plugin, the SuperAGI controller spawns a short-lived container from a pre-built image, mounts only the declared resource volumes, and tears it down after the tool call completes. The design intent is that a compromised plugin cannot read the host filesystem or access network endpoints outside its declared allowlist. In practice, the March 2025 OAuth token leak bypassed this model entirely because the plugin’s `Dockerfile` declared a bind mount to `/var/log/superagi`, which the framework’s logging daemon writes to by default. The plugin did not need to escape the container; it simply wrote sensitive data to a shared logging volume that other agent components read from. This is not a container escape. It is a design flaw in the trust boundary between the plugin sandbox and the observability pipeline.

### Default Volume Mounts and Log Sink Exposure

SuperAGI’s agent runtime, as of version 0.0.8, mounts three default volumes into every plugin container: `/app/config`, `/var/log/superagi`, and `/tmp/agent_state`. The `/var/log/superagi` mount is the critical path. Any plugin that logs to stdout or stderr has its output captured by the SuperAGI logging sidecar and written to a shared SQLite database at `/var/log/superagi/agent_logs.db`. A plugin author who understands this pipeline can deliberately emit structured log lines containing secrets, knowing those secrets will persist beyond the container’s lifecycle and become readable by any other plugin the same agent invokes in the same session. The fix, merged into the SuperAGI main branch on 29 March 2025, introduces a per-plugin log namespace and strips log lines matching a secret regex before persistence. Teams running the 0.0.8 release without this patch remain exposed.

### Network Egress Controls and DNS Rebinding Risks

Each plugin container receives a default network policy that allows outbound HTTPS to any destination. SuperAGI does not enforce a domain allowlist at the container network layer. A plugin that declares a dependency on `requests` can exfiltrate data to an arbitrary command-and-control server over TLS. During the Lasso Security audit published 3 February 2025, researchers demonstrated a proof-of-concept plugin that used DNS rebinding to resolve a private RFC 1918 address after initial allowlist validation, achieving lateral movement to an internal metadata endpoint. The attack required the plugin to control its own DNS resolution, which is possible because SuperAGI does not pin container DNS to a trusted resolver. The practical mitigation for production teams is to run the SuperAGI controller inside a Kubernetes namespace with a NetworkPolicy that restricts egress to a pre-approved set of FQDNs, overriding the plugin’s declared intent.

## Permission Model and OAuth Scope Escalation

SuperAGI plugins request permissions through a manifest file, `plugin.yaml`, which declares required OAuth scopes, environment variables, and resource mounts. The framework’s permission gate occurs at install time: the administrator sees a list of requested scopes and approves or denies the installation. Once installed, the plugin receives a long-lived access token scoped to the approved permissions. There is no runtime re-prompting and no scope downgrade mechanism. The `superagi_google_sheets_connector` plugin requested `https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/drive.readonly` at install time. The administrator approved both. At runtime, the plugin used the Google Identity and Access Management (IAM) token exchange endpoint to trade its Drive read-only token for a full `https://www.googleapis.com/auth/drive` scope, because the underlying Google Cloud project had the IAM policy `roles/iam.serviceAccountTokenCreator` bound to the service account. This is not a SuperAGI vulnerability per se; it is a cloud IAM misconfiguration. But the marketplace model amplifies the risk because a plugin author can reasonably predict that a non-trivial percentage of installers will not audit their cloud IAM policies before clicking “Install.”

### Runtime Token Exchange and Cloud IAM Misconfiguration

The token exchange attack works as follows. A plugin receives an access token with scope `A`. If the cloud provider’s IAM policy allows the service account to impersonate itself with additional scopes, the plugin calls the token endpoint with `scope=B` and receives a new token. Google Cloud’s IAM documentation, updated 14 November 2024, explicitly warns against binding `roles/iam.serviceAccountTokenCreator` to service accounts that run third-party code. SuperAGI’s marketplace documentation, as of 5 April 2025, does not mention this risk. Production teams should enforce the principle of least privilege at the cloud IAM layer and treat every marketplace plugin token as potentially escalable until proven otherwise.

### Manifest Validation and Supply Chain Integrity

SuperAGI’s marketplace does not require signed commits or reproducible builds for plugin images. The `plugin.yaml` manifest specifies a Docker image tag, and the controller pulls that tag at install time without verifying a checksum or signature. A plugin author who controls the container registry can replace the image at a mutable tag—say, `latest` or `v1`—after the administrator has reviewed the initial version. The SuperAGI team addressed this partially in the 0.0.9 release candidate dated 2 April 2025 by introducing an optional `digest` field in the manifest. If present, the controller pulls by SHA256 digest. If absent, the controller pulls by tag and logs a warning. For production deployments, the `digest` field should be mandatory, and the platform team should maintain an internal registry mirror that pins all plugin images by digest.

## Audit Methodology for Production Gatekeeping

A production team evaluating a SuperAGI marketplace plugin should apply a standardized audit checklist before the plugin touches any environment with access to customer data, billing systems, or proprietary models. The checklist below is derived from the OWASP Agent Security Verification Standard (ASVS) version 1.0, published 10 January 2025, and adapted for the SuperAGI plugin model.

### Static Analysis of Plugin Source and Dependencies

The first gate is a full source review of the plugin repository. The audit should verify that the plugin does not import any library capable of making outbound network calls beyond the declared API surface. Common offenders include `requests`, `httpx`, `aiohttp`, and `socket`. If the plugin’s declared purpose is to connect to Google Sheets, it should not import a generic HTTP client; it should use the Google-provided client library. The dependency tree should be scanned with a software composition analysis tool—`pip-audit` for Python plugins, `npm audit` for Node.js—and any dependency with a known CVE rated 7.0 or higher should block installation. The `superagi_google_sheets_connector` plugin had a transitive dependency on `urllib3` version 1.26.14, which contains CVE-2023-45803 with a CVSS score of 6.5, below the typical threshold but still notable.

### Dynamic Analysis in a Staging Sandbox

Static analysis cannot detect runtime token exchange or log exfiltration. The second gate is a dynamic run in a staging environment that mirrors production IAM policies and network controls. The team should instrument the plugin container with eBPF-based syscall tracing—`falco` or `tetragon`—and monitor for any filesystem writes outside `/tmp/agent_state`, any DNS queries to non-approved domains, and any outbound TCP connections to ports other than 443. The staging run should last at least 72 hours and include a full cycle of agent tool invocations. The Lasso Security team’s methodology, documented in their 3 February 2025 report, caught the DNS rebinding attack within 18 minutes of deployment using this approach.

### IAM Policy Review and Token Scope Minimization

Before granting install approval, the cloud IAM policy attached to the plugin’s service account must be audited. The service account should have exactly one role binding, scoped to the minimum permissions the plugin’s documented functionality requires. The `roles/iam.serviceAccountTokenCreator` role must never be bound. The `roles/iam.workloadIdentityUser` role, if used, should be scoped to a specific namespace. The audit should also verify that the OAuth consent screen for the plugin’s cloud project does not include any scopes beyond those declared in `plugin.yaml`. Google Cloud’s OAuth consent screen configuration, as of the 14 November 2024 update, allows a project to request scopes that differ from what the application code actually uses; the marketplace manifest is not authoritative.

## Incident Response and Blast Radius Containment

When a plugin is found to be compromised or misconfigured, the response must contain the blast radius within minutes, not hours. The SuperAGI controller does not currently support hot revocation of individual plugin tokens from the admin dashboard. The only built-in remediation path is to delete the plugin, which terminates active tool calls but does not invalidate tokens already issued. The platform team must maintain an out-of-band token revocation runbook that covers the OAuth provider, the cloud IAM policy, and any database credentials the plugin accessed.

### Token Revocation Runbook

The runbook should include three steps. First, revoke the OAuth token at the provider—Google’s `oauth2.revoke` endpoint, GitHub’s `applications/revoke-token`, or the equivalent. Second, disable the cloud service account or remove its IAM bindings. Third, rotate any database passwords or API keys that were stored in environment variables accessible to the plugin. The March 2025 incident demonstrated that step three is often missed: the leaked Google Sheets token was revoked within 45 minutes of the OWASP disclosure, but the plugin also had access to a PostgreSQL connection string stored in `SUPERAGI_DB_URL`, which was not rotated for six days. During that window, an attacker with the leaked connection string and network access to the database could have exfiltrated agent memory tables.

### Monitoring for Post-Installation Drift

Plugins that pass initial audit can drift over time. A plugin author can push a new image to the same tag, or the plugin’s upstream dependencies can acquire vulnerabilities. The production team should implement a weekly drift detection scan that pulls the current plugin image, compares its filesystem layer and installed packages against the audited baseline, and flags any delta. The scan should also re-run the OWASP ASVS checklist and fail closed if any new high-severity finding appears. This is not a feature SuperAGI provides; it is a process the platform team owns.

## Practical Takeaways for Production Teams

1. **Do not run marketplace plugins from mutable image tags.** Pin every plugin image by SHA256 digest. If the plugin manifest does not include a `digest` field, build the image internally from the plugin’s source repository after audit and push it to a private registry under your control. Treat the public marketplace as a discovery mechanism, not a deployment source.

2. **Enforce network egress allowlists at the Kubernetes layer.** SuperAGI’s default network policy is permissive. Override it with a NetworkPolicy or Istio Sidecar that restricts outbound traffic to the specific API endpoints the plugin’s documented functionality requires. Block all DNS resolution except to your trusted resolver.

3. **Audit cloud IAM policies before clicking “Install.”** Verify that the service account the plugin will use does not have the `roles/iam.serviceAccountTokenCreator` role or any equivalent that permits scope escalation. The three minutes spent on this check prevent token exchange attacks that no runtime sandbox can stop.

4. **Maintain an out-of-band token revocation runbook.** Do not rely on the SuperAGI admin dashboard for incident response. Know exactly which OAuth endpoints, IAM bindings, and database credentials a plugin touches, and have a pre-tested procedure to revoke all of them within 15 minutes of a confirmed compromise.

5. **Run weekly drift detection against the audited plugin baseline.** A plugin that passes audit today is not guaranteed to be safe tomorrow. Automate the comparison of the running plugin image against its audited filesystem and dependency snapshot, and block any plugin that has drifted until a human re-audits it.
