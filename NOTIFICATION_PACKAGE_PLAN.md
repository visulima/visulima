# Plan: `@visulima/notification` — multi-channel notification package

> A reusable, ESM-only, edge-ready, **infra-free** multi-channel notification library, modeled on
> `@visulima/email`'s architecture. Channels: **SMS, Push, Chat, In-app, Webhook**. The **email**
> channel delegates to `@visulima/email` (no duplication).
>
> Status: design / not yet implemented. Date: 2026-06-20.

---

## 1. Why & positioning

Research (Novu, notifme-sdk, Knock, Courier, Apprise, web-push, node-pushnotifications) shows the
ecosystem splits into:

1. **SaaS platforms** (Knock, Courier) — typed SDK clients to a hosted API; not self-hostable.
2. **One heavy OSS platform** (Novu) — self-hostable but needs MongoDB + 2×Redis + S3 (~6 services).
3. **Lightweight libs** (notifme-sdk = dormant Flow/CJS; web-push, node-notifier = single-channel).

**The unserved niche** = a maintained, **ESM-only, fully type-safe, tree-shakeable, edge-native,
infra-free send primitive** sitting between dormant notifme-sdk and Novu's cluster. No library ships
this today. `@visulima/email` already proves the exact pattern works (26 providers, subpath exports,
optional peers, middleware/queue/webhooks/events). We extend that pattern to other channels.

**Explicit non-goals for v1** (the orchestration layer Novu/Knock/Courier monetize):
hosted dashboard, delivery analytics UI, visual workflow builder. We ship the typed send primitive +
optional, also-infra-free modules (queue, digest, preferences) — all code-first.

---

## 2. Decisions locked (from user)

| Fork          | Decision                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Package shape | **Single package** `@visulima/notification`, subpath exports per provider (mirror `@visulima/email`). |
| v1 channels   | **SMS, Push, Chat, In-app, Webhook** (all).                                                           |
| Email channel | **Delegate to `@visulima/email`** via optional peer dep — a thin adapter, zero duplication.           |

---

## 3. Email-provider gap (parallel deliverable for `@visulima/email`)

Cross-referencing `@visulima/email`'s 26 real senders against Novu (20) + notifme (~7) + Courier (50+),
the **missing email providers** to add to `@visulima/email` (separate, smaller workstream):

| Provider                         | Source ref          | Transport                 | Priority | Notes                                                                              |
| -------------------------------- | ------------------- | ------------------------- | -------- | ---------------------------------------------------------------------------------- |
| **SparkPost**                    | Novu + notifme      | HTTPS REST                | **High** | Most-cited gap; in two reference libs.                                             |
| **Netcore** (Pepipost)           | Novu                | HTTPS REST                | Med      | `emailapi.netcorecloud.net`.                                                       |
| **Outlook365 / Microsoft Graph** | Novu (`outlook365`) | Graph `sendMail` (OAuth2) | Med      | Can reuse existing SMTP+OAuth2 middleware, but Graph API is the modern path.       |
| **EmailJS**                      | Novu (`emailjs`)    | SMTP wrapper              | Low      | Thin — likely covered by existing `smtp`/`nodemailer`; add only if there's demand. |
| **Braze**                        | Novu                | HTTPS REST (campaigns)    | Low      | Engagement platform, not a pure transactional sender; arguably out of scope.       |

Novu's `email-webhook` ≈ existing `@visulima/email` `http` wrapper → **not** a real gap.

**Recommendation:** add **SparkPost + Netcore + Outlook365 (Graph)** to `@visulima/email`; defer
EmailJS/Braze unless requested. Each follows the existing `defineProvider` contract — see
`packages/email/email/src/providers/resend/provider.ts` as the template.

---

## 4. Package layout (mirrors `@visulima/email`)

```
packages/notification/notification/
├── src/
│   ├── index.ts                     # core barrel
│   ├── types.ts                     # NotificationOptions, NotificationResult, Receipt, Recipient, FeatureFlags
│   ├── notification.ts              # createNotification() — core send facade (mirror Mail)
│   ├── notification-message.ts      # fluent builder (mirror MailMessage)
│   ├── errors/
│   │   ├── notification-error.ts    # extends @visulima/error VisulimaError (mirror EmailError)
│   │   └── required-option-error.ts
│   ├── channels/                    # channel abstraction layer (NEW vs email)
│   │   ├── channel.ts               # Channel interface + defineChannel()
│   │   ├── sms/                     # SMS channel: payload shape + provider contract
│   │   ├── push/
│   │   ├── chat/
│   │   ├── inapp/
│   │   ├── webhook/
│   │   └── email/                   # adapter -> @visulima/email (optional peer)
│   ├── providers/
│   │   ├── provider.ts              # Provider<...> interface + defineProvider() (mirror email)
│   │   ├── utils/                   # address/payload/retry helpers (port from email/providers/utils)
│   │   ├── <sms providers>/         # twilio, vonage, plivo, sns, messagebird, telnyx, sinch, ...
│   │   ├── <push providers>/        # fcm, apns, expo, onesignal, web-push
│   │   ├── <chat providers>/        # slack, discord, ms-teams, telegram, whatsapp, mattermost
│   │   ├── <inapp providers>/       # memory-store, unstorage-store
│   │   ├── webhook/                 # generic outbound webhook
│   │   ├── failover/  roundrobin/   # multi-provider strategy wrappers (port from email)
│   │   ├── opentelemetry/  mock/    # observability + test
│   ├── routing/                     # NEW: channel-sequence routing (email->push->sms), gating pipeline
│   ├── template-engines/            # pluggable renderer (handlebars/liquid/react) — optional peers
│   ├── middleware/                  # retry, rate-limit, circuit-breaker, logging, dedupe, suppression, telemetry, events
│   ├── queue/                       # durable queue (memory default; bullmq/pg-boss/sqs/unstorage adapters)
│   ├── webhooks/                    # inbound delivery-status verifiers (twilio, slack, fcm, ...)
│   ├── events/                      # lifecycle event bus: queued/sent/delivered/failed/read/interacted
│   ├── preferences/                 # NEW: per-recipient per-channel opt-in/out (infra-free, pluggable store)
│   └── utils/                       # result type, message-id, validation
├── __tests__/
├── package.json
├── project.json                     # tags: ["notification","type:package","category:communication"]
├── packem.config.ts                 # copy email's (runtime:node, oxc dts, requireCJS)
├── vitest.config.ts
└── .releaserc.json
```

---

## 5. Core API (consistent with `@visulima/email`)

### Provider contract (per-channel `sendMessage`, ported from email's `defineProvider`)

```ts
// src/providers/provider.ts
export interface Provider<OptionsT = unknown, PayloadT = NotificationOptions> {
    readonly id: string; // "twilio", "slack", "fcm"
    readonly channel: ChannelType; // "sms" | "push" | "chat" | "inapp" | "webhook" | "email"
    features?: FeatureFlags; // capability flags -> drives gating/validation
    initialize(): MaybePromise<void>;
    isAvailable(): MaybePromise<boolean>;
    send(payload: PayloadT): MaybePromise<Result<NotificationResult>>;
    // optional: validateCredentials, parseEventBody (webhook->status), isTokenInvalid (push), shutdown
}
export const defineProvider = <O, P>(f: (o?: O) => Provider<O, P>) => f; // mirror email
```

### Channel abstraction (NEW — the multi-channel seam email doesn't need)

Logical channel decoupled from concrete provider → enables per-channel provider fallback **and**
channel-sequence routing. Per-channel payloads are a **discriminated union** (notifme model) for
compile-time type safety per channel _and_ per provider.

```ts
const notify = createNotification({
    sms: twilioProvider({ accountSid, authToken, from }),
    push: fcmProvider({ serviceAccount }),
    chat: slackProvider({ token }),
    email: emailChannel(mail), // <- wraps a configured @visulima/email Mail instance
})
    .use(retryMiddleware({ retries: 3 }))
    .use(rateLimitMiddleware({ rate: 100 }));

// Send to one logical recipient across channels
for await (const receipt of notify.send({
    to: { sms: "+1555...", email: "u@x.com", push: ["tok1"], slack: "C123" },
    channels: {
        sms: { text: "Your code is 123" },
        email: { subject: "Code", html: "<p>123</p>" }, // -> @visulima/email
        push: { title: "Code", body: "123" },
    },
})) {
    /* Receipt discriminated union, same shape as email */
}
```

### Routing / fallback (two axes — Courier's model is the most expressive)

- **Provider-within-channel:** `failover` / `roundrobin` wrappers (port directly from email).
- **Channel-sequence:** `best_of` (first success) / `all` (broadcast) — `src/routing/`.
- **Typed retryable-vs-terminal** error classification (408/429/≥5xx/network = retry; 4xx auth = terminal).
- **Gating pipeline** upstream of send: condition → capability (`features`) → preference → send-window.

### Result / errors / middleware

Reuse email's exact shapes: `Result<T>`, `Receipt` discriminated union, `Middleware =
(opts, next) => Promise<Result>` composed outermost-first, `NotificationError extends VisulimaError`.

---

## 6. Provider catalog for v1 (start small, expand like email did)

Ship a credible core, not all 60. Each is a pure-HTTP/`fetch` provider where possible → **edge-native**.

| Channel      | v1 providers                                 | Later                                                 |
| ------------ | -------------------------------------------- | ----------------------------------------------------- |
| **SMS**      | twilio, vonage, plivo, aws-sns, messagebird  | telnyx, sinch, infobip, clickatell, termii, ...       |
| **Push**     | fcm (HTTP v1), apns (HTTP/2), expo, web-push | onesignal, pushpad, pusher-beams                      |
| **Chat**     | slack, discord, ms-teams, telegram           | whatsapp-business, mattermost, rocket-chat            |
| **In-app**   | memory-store, unstorage-store                | + `@visulima/notification/react` feed hooks (post-v1) |
| **Webhook**  | generic outbound webhook                     | —                                                     |
| **Email**    | `emailChannel()` adapter → `@visulima/email` | —                                                     |
| **Wrappers** | failover, roundrobin, opentelemetry, mock    | http                                                  |

**Edge constraint:** SMTP/`net`/`tls` cannot run on Workers/Edge. Every native provider must be
`fetch`-only. SMTP-only email stays inside `@visulima/email` (already node-runtime); the notification
package itself remains edge-deployable.

---

## 7. package.json shape (copy email's conventions)

```jsonc
{
    "name": "@visulima/notification",
    "type": "module",
    "sideEffects": false,
    "dependencies": { "lru-cache": "catalog:prod", "mime": "catalog:prod" },
    "peerDependencies": {
        "@visulima/email": "workspace:*", // optional — only for email channel
        "@opentelemetry/api": "^1 || ^2",
        "firebase-admin": "...",
        "@parse/node-apn": "...",
        "web-push": "...",
        "twilio": "...",
        "@slack/web-api": "...",
        "unstorage": "^1.13.0",
        "handlebars": "catalog:peer",
        "liquidjs": "^10",
    },
    "peerDependenciesMeta": {
        /* ALL marked optional: true */
    },
}
```

- Subpath exports: `./providers/<name>`, `./channels/<name>`, `./middleware`, `./queue`,
  `./queue/<backend>`, `./webhooks`, `./events`, `./routing`, `./preferences`, `./template/<engine>`,
  `./test`, `./utils/result`.
- Heavy provider SDKs are **lazy-imported** inside async methods (email's pattern) — keep bundle honest.
- `project.json` tags: `["notification","type:package","category:communication"]`;
  `implicitDependencies: ["filesystem/fs","filesystem/path"]` (+ `email/email` if email channel ships).
- Build: copy `packem.config.ts` verbatim (runtime:node, oxc dts, requireCJS builtinNodeModules).
- Watch out (from repo memory): packem dup `__cjs_getBuiltinModule` helper bug; `prefer-destructuring`
  eslint autofix breaks isolatedDeclarations; pre-commit **skips** eslint → run `eslint .` manually.

---

## 8. Phased implementation

**Phase 0 — Scaffold (½ day).** Create `packages/notification/notification` with package.json,
project.json, packem/vitest/tsconfig copied from email. Port `provider.ts` (`defineProvider`),
`types.ts`, `errors/`, `utils/result`, `utils/provider-base` from email. Empty `index.ts`. Confirm
`pnpm --filter @visulima/notification build` + `lint:types` pass.

**Phase 1 — Core engine + channel abstraction (1–2 days).** `createNotification()`, channel registry,
`NotificationMessage` builder, discriminated-union payload types, `Receipt`/`Result`, the middleware
composer (port from email). One **mock** provider + tests proving send/sendMany.

**Phase 2 — SMS channel + providers (2 days).** Twilio first (full test as reference), then vonage,
plivo, aws-sns, messagebird. Per-provider `features`, validation, retry. Webhook status verifiers.

**Phase 3 — Chat + Push (2–3 days).** Chat: slack, discord, ms-teams, telegram (all webhook/fetch,
edge-friendly — easiest). Push: fcm, web-push, expo, apns (apns needs HTTP/2 → node runtime).

**Phase 4 — Routing, middleware, queue, events (2 days).** failover/roundrobin wrappers, channel-
sequence routing + gating pipeline, port retry/rate-limit/circuit-breaker/dedupe/suppression/telemetry
middleware + event bus + queue (memory + unstorage/bullmq) from email.

**Phase 5 — Email channel adapter (½ day).** `emailChannel(mail)` wrapping `@visulima/email`
(optional peer). Multi-channel send incl. email end-to-end test.

**Phase 6 — In-app + preferences (1–2 days).** In-app store (memory + unstorage), preferences module
(pluggable store, opt-in/out, critical override). React feed hooks deferred to a follow-up.

**Phase 7 — Docs, website, release (1 day).** README + per-provider docs; add `category:communication`
to project.json so `apps/web` auto-discovers it; optional `packages-metadata.json` entry;
`.releaserc.json`; verify `attw`/`publint`.

**Parallel workstream — email providers.** Add **SparkPost, Netcore, Outlook365** to `@visulima/email`
(§3). Independent of the notification package; can land first as quick wins.

---

## 9. Open questions / risks

1. **Recipient model.** Single `to` object keyed by channel vs a `Subscriber` abstraction (Novu-style
   with stored channel identifiers). v1 = simple `to` object; subscriber store can be a later module.
2. **In-app inbox UI.** Out of scope for v1 (store only). A `@visulima/notification-react` companion
   (feed/popover hooks, Knock/Novu style) is a natural follow-up package.
3. **apns/SMTP node-only.** Document clearly which providers are edge-safe vs node-only (capability
   matrix in README), since "edge-native" is the headline differentiator.
4. **Naming.** `@visulima/notification` (singular) matches `@visulima/email`. Confirm before scaffolding.
5. **Template sharing.** Email templating lives in `@visulima/email/template/*`. Decide whether the
   notification package re-exposes a shared renderer or keeps its own thin one for chat/push bodies.

---

## 10. Reference files (the templates to copy)

- Provider contract: `packages/email/email/src/providers/provider.ts`
- Example provider: `packages/email/email/src/providers/resend/provider.ts`
- Core facade: `packages/email/email/src/mail.ts`
- Builder: `packages/email/email/src/mail-message.ts`
- Middleware composer + built-ins: `packages/email/email/src/middleware/`
- Queue/webhooks/events: `packages/email/email/src/{queue,webhooks,events}/`
- Build/test config: `packages/email/email/{packem.config.ts,vitest.config.ts,project.json}`

```

```
