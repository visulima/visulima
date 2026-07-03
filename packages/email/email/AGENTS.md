# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/email` is a multi-provider email library: a single `Mail` facade (`createMail`) drives 25+ provider adapters (SMTP, AWS SES, Resend, SendGrid, Mailgun, Postmark, Brevo, Mailjet, Mailtrap, Mailpace, Mailersend, Mandrill, Postal, Azure, Infobip, Scaleway, AhaSend, Mailomat, Sweego, Plunk, ZeptoMail, Nodemailer, Mailcrab, plus `mock`, `http`, `failover`, `roundrobin`, `opentelemetry` wrappers) and 5 template engines (Handlebars, MJML, react-email, vue-email, html-to-text). Also ships DKIM / S/MIME crypto and lightweight send-side validation (syntactic email validation, send-option validation, provider feature-support checks). Nx tag: `category:communication`.

> **Note:** address _verification & enrichment_ (MX/SMTP probing, disposable/free/role detection, catch-all, provider classification, quality score) lives in the standalone, mailer-free **`@visulima/email-verifier`** package — it was moved out of here so a validation-only consumer doesn't pull the 25 provider adapters. Only `./validation/validate-email`, `validate-email-options` (internal), and `./validation/check-feature-support` remain here.

## Architecture

- **Subpath exports are the contract.** Each provider lives at `./providers/<name>`, each template engine at `./template/<name>`, each validator at `./validation/<name>`, plus targeted `./utils/*` and `./crypto` entry points. The barrel `src/index.ts` deliberately exports only the core (`Mail`, `MailMessage`, `defineProvider`, errors, shared types) — provider-specific code is **not** re-exported from root to keep tree-shaking honest. When adding a provider or engine, register its subpath in `package.json#exports`.
- **Provider contract:** see `src/providers/provider.ts`. New adapters should be authored with `defineProvider(...)` and live under `src/providers/<name>/`.
- **Optional peer deps are the norm.** Every heavyweight integration is an optional peer: `nodemailer` (>=7), `@react-email/render`, `@vue-email/render`, `handlebars`, `mjml`, `pkijs`, `asn1js`, `@opentelemetry/api`. Only import them from inside the matching subpath module so consumers who don't use that provider/engine don't pay for the dep. Mirror any new optional integration in both `peerDependencies` and `peerDependenciesMeta` (with `optional: true`).
    - Reminder (per `project_api_platform_zod_v4_blocker` memory): packem inlines optional-peer type namespaces — if d.ts emit breaks for a new optional peer, treat that peer as non-optional rather than fighting the bundler.
- **Hard dependencies (always installed):** `html-to-text`, `ical-generator`, `lru-cache`, `mime`. Don't move these to peers without a migration plan.
- **Crypto module** (`./crypto`): DKIM signer + S/MIME sign/encrypt — depends on the optional `pkijs` + `asn1js` peers. Keep the public surface in `src/crypto/index.ts` in sync with `dist/crypto/index.d.ts` consumers.

## Related

- `@visulima/email-verifier` — standalone address verification & enrichment (the moved MX/SMTP/disposable/role/free/score surface). Depends on the `@visulima/disposable-email-domains`, `@visulima/free-email-domains`, and `@visulima/email-provider-mx` data packages — none of which this package pulls anymore.
- Implicit Nx deps (`project.json`): `filesystem/fs`, `filesystem/path`.
