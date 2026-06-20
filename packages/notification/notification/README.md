<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="notification" />

</a>

<h3 align="center">A reusable, ESM-only, edge-ready multi-channel notification library with SMS, push, chat, in-app and webhook providers</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

`@visulima/notification` is the multi-channel sibling of [`@visulima/email`](https://visulima.com/packages/email): one
typed facade drives many channel providers (SMS, push, chat, in-app, webhook) and the email channel delegates straight to
`@visulima/email`. It is **infra-free** (no Redis/Mongo/dashboard required), **ESM-only**, **tree-shakeable** (import only
the providers you use), and **edge-ready** — every native provider is built on `fetch` with zero Node built-ins, so it
runs unmodified on Cloudflare Workers, Vercel Edge, Deno and Bun.

## Install

```sh
npm install @visulima/notification
```

```sh
yarn add @visulima/notification
```

```sh
pnpm add @visulima/notification
```

## Usage

### Multi-channel send

```typescript
import { createNotification } from "@visulima/notification";
import { twilioProvider } from "@visulima/notification/providers/twilio";
import { slackProvider } from "@visulima/notification/providers/slack";
import { fcmProvider } from "@visulima/notification/providers/fcm";

const notify = createNotification({
    sms: twilioProvider({ accountSid: "AC…", authToken: "…", from: "+15555550100" }),
    chat: slackProvider({ token: "xoxb-…", defaultChannel: "C123" }),
    push: fcmProvider({ projectId: "my-app", getAccessToken: async () => getGoogleToken() }),
});

// Each present channel is delivered in parallel; you get one receipt per channel.
const receipts = await notify.send({
    sms: { to: "+15555550100", text: "Your code is 123" },
    chat: { text: "🚀 Deploy finished" },
    push: { to: ["device-token"], title: "Deploy", body: "Finished" },
});

for (const receipt of receipts) {
    if (receipt.successful) {
        console.log(`${receipt.channel}: ${receipt.messageId}`);
    } else {
        console.error(`${receipt.channel} failed:`, receipt.errorMessages);
    }
}
```

### Single-channel send

```typescript
const receipt = await notify.sendToChannel("sms", { to: "+15555550100", text: "Hi" });
```

### Batch send with bounded concurrency

```typescript
for await (const receipts of notify.sendMany(messages, { concurrency: 10 })) {
    // receipts for one message
}
```

## Channels & providers

Providers are imported from `@visulima/notification/providers/<name>` so unused integrations are tree-shaken away.

| Channel      | Providers                                                       |
| ------------ | --------------------------------------------------------------- |
| **SMS**      | `twilio`, `vonage`, `plivo`, `messagebird`, `telnyx`, `sns`     |
| **Push**     | `fcm`, `expo`, `web-push`, `apns`                               |
| **Chat**     | `slack`, `discord`, `msteams`, `telegram`                       |
| **In-app**   | `inAppProvider` (memory or unstorage store)                     |
| **Webhook**  | `webhook`                                                       |
| **Email**    | `emailChannel(...)` → wraps a `@visulima/email` `Mail` instance |
| **Wrappers** | `failover`, `roundrobin`, `opentelemetry`, `mock`               |

> **Cloudflare / edge note:** nearly every provider is `fetch` + Web Crypto only and runs on **Cloudflare Workers**,
> Vercel Edge, Deno and Bun — including **AWS SNS** (Web Crypto SigV4) and **web-push** (Web Crypto VAPID + RFC 8291).
> FCM accepts a `getAccessToken` callback so you bring your own OAuth token without a Node-only SDK. The only **Node-only**
> pieces are **APNs** (`node:http2`) and the **bullmq / pg-boss / sqs** queue adapters — import those from a Node runtime.
> See the [runtime matrix](https://visulima.com/docs/packages/notification/installation#runtime-support).

## Writing a provider

Every provider implements the same contract; author one with `defineProvider`:

```typescript
import { defineProvider } from "@visulima/notification";

export const myProvider = defineProvider<MyConfig, SmsPayload>((config) => ({
    id: "my-provider",
    channel: "sms",
    features: { batchSending: false },
    initialize: () => {},
    isAvailable: () => Boolean(config?.apiKey),
    send: async (payload) => {
        // … return { success: true, data: { messageId, channel: "sms", provider: "my-provider", sent: true, timestamp: new Date() } }
    },
}));
```

## Failover & round-robin

Wrap several same-channel providers to gain resilience or load balancing:

```typescript
import { failoverProvider } from "@visulima/notification/providers/failover";
import { roundRobinProvider } from "@visulima/notification/providers/roundrobin";

const sms = failoverProvider([twilioProvider({ … }), vonageProvider({ … })]); // try Twilio, fall back to Vonage
const balanced = roundRobinProvider([plivoProvider({ … }), telnyxProvider({ … })]);

const notify = createNotification({ sms });
```

## Routing (channel fallback & broadcast)

`route(...)` adds channel-sequence delivery and a gate, on top of per-channel provider failover:

```typescript
import { route } from "@visulima/notification/routing";

// best-of: try sms, then push, then email — stop at the first success
await route(notify, message, { order: ["sms", "push", "email"], mode: "best-of" });

// all: broadcast to every present channel in parallel
await route(notify, message, { mode: "all" });
```

## Preferences

Honour per-subscriber, per-channel opt-outs (critical sends bypass them):

```typescript
import { MemoryPreferenceStore, preferencesGate } from "@visulima/notification/preferences";

const prefs = new MemoryPreferenceStore();
prefs.set("user-1", { channels: { sms: false } });

await route(notify, message, { gate: preferencesGate(prefs) });
await route(notify, message, { gate: preferencesGate(prefs, { critical: true }) }); // bypasses opt-outs
```

## Middleware

Cross-cutting concerns compose around every send (first registered = outermost):

```typescript
import { retryMiddleware, rateLimitMiddleware, circuitBreakerMiddleware, dedupeMiddleware, loggingMiddleware } from "@visulima/notification/middleware";

notify
    .use(loggingMiddleware())
    .use(retryMiddleware({ retries: 3 }))
    .use(rateLimitMiddleware({ rate: 100, interval: 1000 }))
    .use(circuitBreakerMiddleware({ threshold: 5 }))
    .use(dedupeMiddleware({ ttl: 60_000 }));
```

## Queue & worker

Decouple enqueue from delivery with a durable queue and a retrying worker:

```typescript
import { MemoryQueue, createQueueWorker } from "@visulima/notification/queue";

const queue = new MemoryQueue();
queue.enqueue({ sms: { to: "+15555550100", text: "Hi" } });

const worker = createQueueWorker(queue, notify, { maxAttempts: 5 });
worker.start(); // or `await worker.drain()` to process all due jobs once
```

Back the queue with [unstorage](https://unstorage.unjs.io) for Redis/filesystem/KV persistence:

```typescript
import { UnstorageQueue } from "@visulima/notification/queue/unstorage";
import { createStorage } from "unstorage";

const queue = new UnstorageQueue(createStorage());
```

## In-app inbox

```typescript
import { inAppProvider } from "@visulima/notification/channels/inapp";

const inapp = inAppProvider();
const notify = createNotification({ inapp });

await notify.sendToChannel("inapp", { to: "user-1", title: "Welcome", body: "Thanks for joining" });

const store = inapp.getInstance();
await store.unreadCount("user-1"); // 1
await store.list("user-1");
await store.markAllRead("user-1");
```

## Email channel

The email channel delegates to a configured [`@visulima/email`](https://visulima.com/packages/email) `Mail` instance, so
you reuse its 29 providers, templates and deliverability tooling:

```typescript
import { createMail } from "@visulima/email";
import { resendProvider } from "@visulima/email/providers/resend";
import { createNotification } from "@visulima/notification";
import { emailChannel } from "@visulima/notification/channels/email";

const mail = createMail(resendProvider({ apiKey: "re_…" }));
const notify = createNotification({ email: emailChannel(mail) });

await notify.sendToChannel("email", { from: "noreply@app.com", to: "user@x.com", subject: "Hi", html: "<p>Hello</p>" });
```

## Events

Subscribe to lifecycle events and build a timeline:

```typescript
import { NotificationEventBus, MemoryEventStore } from "@visulima/notification/events";

const bus = new NotificationEventBus();
bus.on("sent", (event) => console.log(event.messageId));
bus.on("*", (event) => store.append(event));
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima notification is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/notification?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/notification?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/notification
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
