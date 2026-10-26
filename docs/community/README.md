# E&S Risk Management Core

**A traceable working record for environmental and social evidence, assessments, actions and monitoring.**

Environmental and social assignments connect original documents, changing requirements, professional judgments and work that continues after a report is issued. This core helps a practitioner follow a finding back to its evidence, carry an action into later monitoring and hand over an inspectable project history.

This is the Community edition of E&S Review for `categori-se/es-risk-management-core`. Application-owned source is licensed under [Apache-2.0](../../LICENSE). It runs on infrastructure you control. Installed manual workflows need no categori.se account, subscription or AI provider. Third-party components retain their own notices and terms.

## What you can do

| Work | The connected record |
| --- | --- |
| Scope an assignment | Client mandate, engagement, applicable editions, reporting period and review responsibilities. |
| Organize permitted evidence | Exact originals and versions, source rights, page or cell citations, extraction limits and contradictory evidence. |
| Assess and explain | Applicability, coverage, findings, uncertainty and reasons supporting each professional judgment. |
| Follow actions and monitoring | Owners, deadlines, closure evidence, incidents, observations and later reporting periods. |
| Review and issue | Human review, approved baselines, editable reports and exact issued-file identities. |
| Preserve and hand over | Audit history, permitted originals, export manifests and a fresh restore. |

Projects provide continuing context; engagements keep each assignment and its evidence in scope. Compact lists and file-browser navigation make originals, decisions and outputs easy to inspect. Optional AI proposes material for review; the practitioner retains responsibility for applicability, conclusions and approval.

## Start locally

Install [Node.js 24.22.1 or later](https://nodejs.org/en/download), then run from the directory containing `package.json`:

```sh
npm ci --omit=dev --omit=optional --ignore-scripts
npm start -- --data /absolute/path/to/private-workspace
```

Open <http://127.0.0.1:4173>. Create a project and engagement, import permitted documents, inspect exact versions, record findings and actions, and issue a reviewed report. `/engagements` holds assignment work; `/lifecycle` connects existing projects with components and financing. Keep the process running while working.

To explore four small synthetic studies, stop the server and use a new data directory:

```sh
npm run demo:seed -- --data /absolute/path/to/new-synthetic-workspace
npm start -- --data /absolute/path/to/new-synthetic-workspace
```

The seed command contacts no model and imports no real project or institutional original. `npm run test:installation` checks installed source and a synthetic workflow with fresh restore and account-denial checks. `npm test` exercises included workflows; `npm run demo:rehearse` repeats the synthetic consultancy journey. Simulated review actors are labelled and grant no professional acceptance.

## Choose the operating profile

| Profile | Included scope | Boundary |
| --- | --- | --- |
| Local Node or Linux container | Manual workflows, SQLite records, immutable files and portable exports. | One trusted computer owner; data stays outside the source directory or image. |
| Optional authenticated API | Inspectable service, authorization and customer deployment references; optional dependencies. | Requires your identity, storage, IAM and actual deployment acceptance. |
| Optional processing | Local PDF/OCR/spatial tools, Python parsers and Office rendering, when explicitly installed. | Native tools and fonts are absent from the minimal container. |
| Optional AI | Explicitly configured local or compatible external route. | Source permissions, sensitivity, budget and human review apply; no model or credential is bundled. |

Local accounts partition one owner's custody. Reviewer names record attribution; they do not authenticate separate users. Other users on the same operating-system instance can reach a TCP loopback service. Use the authenticated profile or separate devices/VMs for mutually untrusted users; keep this local listener off the public internet.

## Guides and contribution

Read [installation and recovery](install.md), [Linux containers](container.md), [architecture](architecture.md), [security boundaries](security.md), [extensions](extensions.md), [customer AWS reference](customer-aws.md) and the [authenticated profile](authenticated-profile.md). Prepare a scoped evaluation with the [ten-task protocol](../consultancy-readiness/practitioner-protocol.md), [onboarding and exit checklist](../consultancy-readiness/client-onboarding.md) and [security briefing](../consultancy-readiness/security-briefing.md).

See [contributing](../../CONTRIBUTING.md) for reproducible synthetic examples and contribution rights, and [security reporting](../../SECURITY.md) for private vulnerability disclosure. The generated `community-source-manifest.json` identifies every included file and transformation. Source originals, research capture/reference histories, client data, deployment credentials and Git history are excluded from that export. Provenance registries start empty and accept permitted user-owned metadata; publication reads use the local origin or an explicitly configured customer AWS API.

## Credits and readiness

The core builds on open-source maintainers and categori.se shared components. [Technology acknowledgements](../../ACKNOWLEDGEMENTS.md) identify actual default dependencies, optional tools and preserved notices. Component licences remain applicable; the application licence and institutional references grant no rights to publications or client material.

Professional standards mappings, AI assessment quality and actual practitioner/client acceptance remain separate qualification work. Public standards references establish neither source permissions nor current compliance. Use authorized materials, inspect originals and preserve uncertainty and correction history. The package supports controlled local evaluation; its tests certify neither a confidential managed service nor a professional conclusion.
