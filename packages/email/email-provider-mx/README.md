<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="email-provider-mx" />

</a>

<h3 align="center">Classify the email provider (mailbox host or secure email gateway) behind an MX record.</h3>

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

`@visulima/email-provider-mx` is a tiny, static, hand-curated lookup that turns an MX hostname into the mail provider behind it. It distinguishes **mailbox hosts** (Google Workspace, Microsoft 365, Zoho, Fastmail, Proton, Yandex), **free consumer webmail** (Yahoo, iCloud, GMX, Mail.ru, Mail.com, Web.de), and **Secure Email Gateways / SEGs** (Proofpoint, Mimecast, Barracuda, Cisco, Trend Micro, Sophos, Forcepoint, Symantec/MessageLabs, Cloudflare Area 1).

There are **no network calls** — it is pure data plus suffix matching. Pair it with your own DNS resolver (`dns.resolveMx`, a DoH client, etc.) to feed it MX records.

## Install

```sh
npm install @visulima/email-provider-mx
```

```sh
yarn add @visulima/email-provider-mx
```

```sh
pnpm add @visulima/email-provider-mx
```

## Usage

### Classify a single MX host

```typescript
import { classifyMx } from "@visulima/email-provider-mx";

classifyMx("aspmx.l.google.com");
// → { provider: "google", type: "mailbox", display: "Google Workspace" }

classifyMx("mx0a-00000000.pphosted.com");
// → { provider: "proofpoint", type: "seg", display: "Proofpoint" }

classifyMx("mail.example.com"); // → undefined (unknown host)
```

Matching is case-insensitive, ignores a trailing dot, and only matches on a dot
boundary, so `notgoogle.com` does **not** match `google.com`. The most specific
(longest) known suffix wins, so `tenant.mail.protection.outlook.com` resolves to
Microsoft 365.

### Classify a set of MX records

Feed it the records from a DNS lookup. They are sorted by ascending priority and
the first recognized record wins — which is usually the primary MX. Secure Email
Gateways are typically published as the lowest-priority (primary) MX, so this
surfaces the gateway fronting the mailbox host.

```typescript
import { resolveMx } from "node:dns/promises";

import { classifyMxRecords } from "@visulima/email-provider-mx";

const records = await resolveMx("example.com");
// e.g. [{ exchange: "mx0a-00000000.pphosted.com", priority: 10 }, …]

classifyMxRecords(records);
// → { provider: "proofpoint", type: "seg", display: "Proofpoint" }
```

### Detect a Secure Email Gateway

```typescript
import { isSecureEmailGateway } from "@visulima/email-provider-mx";

isSecureEmailGateway("eu-smtp-inbound-1.mimecast.com"); // → true
isSecureEmailGateway("aspmx.l.google.com"); // → false
```

## API Reference

#### `classifyMx(mxHost)`

Classifies a single MX hostname.

- **Parameters:**
    - `mxHost` (string): The MX hostname (e.g. the `exchange` field of a DNS MX record)
- **Returns:** `MxProviderInfo | undefined` — `{ provider, type, display }`, or `undefined` if the host is not recognized

#### `classifyMxRecords(records)`

Classifies a set of MX records, returning the provider of the primary
(lowest-priority) recognized record.

- **Parameters:**
    - `records` (`{ exchange: string; priority: number }[]`): The MX records to classify
- **Returns:** `MxProviderInfo | undefined`

#### `isSecureEmailGateway(mxHost)`

Reports whether an MX hostname belongs to a known Secure Email Gateway.

- **Parameters:**
    - `mxHost` (string): The MX hostname
- **Returns:** `boolean`

### Types

```typescript
type MxProviderType = "free" | "mailbox" | "seg";

interface MxProviderInfo {
    provider: string; // stable identifier, e.g. "google"
    type: MxProviderType; // "mailbox" | "free" | "seg"
    display: string; // human-friendly label, e.g. "Google Workspace"
}
```

The raw curated dataset is also exported as `MX_PROVIDERS` (with the `patterns`
each provider matches) for advanced use. It is deep-frozen and immutable: the
matcher builds its lookup index once at load time, so pushing or editing entries
has no effect. Copy the array if you need a customizable variant.

### A note on classification

Classification is by MX host, which cannot always separate a free consumer tier
from a paid business tier on the same infrastructure. For example, consumer
Gmail (`gmail-smtp-in.l.google.com`) and Google Workspace
(`aspmx.l.google.com`) both resolve under `google.com`, so both classify as
Google `mailbox`. The dataset is curated from the registrable MX host suffixes
documented at <https://www.suped.com/learn/email-deliverability/how-can-i-identify-the-smtp-provider-from-an-mx-record>.

## Related

- [@visulima/email](https://github.com/visulima/visulima/tree/main/packages/email/email) — multi-provider email library.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima email-provider-mx is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/email-provider-mx?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/email-provider-mx?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/email-provider-mx
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
