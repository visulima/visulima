<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="email-verifier" />

</a>

<h3 align="center">Mailer-free email address verification and enrichment: syntax, MX/SMTP probing, disposable/free/role detection, catch-all, provider & secure-email-gateway classification, typo suggestions, and a 0–100 quality score.</h3>

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

`@visulima/email-verifier` validates and enriches an email address without
pulling in a mail-sending stack. It mirrors the surface of commercial APIs like
[emailable](https://emailable.com): syntax + domain + SMTP verification,
catch-all / mailbox-full / greylist handling, disposable / free / role / no-reply
detection, sub-address (tag) parsing, character & Unicode-symbol analysis,
provider & Secure-Email-Gateway classification, misspelled-domain suggestions,
name parsing, and a transparent 0–100 quality score — all aggregated into one
`EmailVerificationReport`.

> It is **mailer-free**: it does not depend on `@visulima/email`, so a
> validation-only consumer never installs the 25 provider adapters.

## Install

```sh
npm install @visulima/email-verifier
```

```sh
yarn add @visulima/email-verifier
```

```sh
pnpm add @visulima/email-verifier
```

## Usage

```ts
import { verifyEmail } from "@visulima/email-verifier";

const report = await verifyEmail("john.doe@gmail.com");

report.state; // "deliverable" | "risky" | "undeliverable" | "unknown"
report.reason; // e.g. "accepted_email"
report.score; // 0–100
report.free; // true
report.provider?.display; // "Google"
report.name; // { firstName: "John", lastName: "Doe", fullName: "John Doe", confidence: "high" }
```

> **Network caveat:** SMTP verification connects to the recipient's mail server on
> port 25. Many networks block outbound 25 and many servers tarpit or refuse
> verification probes, so treat a `deferred`/`unknown` result as inconclusive
> rather than undeliverable. Pass `{ offline: true }` to skip all network checks.

### À la carte checks

Every check and enrichment is also exported on its own subpath so you only pull
in what you need:

```ts
import { validateSyntax } from "@visulima/email-verifier/checks/syntax";
import { checkMxRecords } from "@visulima/email-verifier/checks/mx";
import { verifySmtp } from "@visulima/email-verifier/checks/smtp";
import { checkDisposable } from "@visulima/email-verifier/checks/disposable";
import { checkFree } from "@visulima/email-verifier/checks/free";
import { isRoleAccount, isNoReply } from "@visulima/email-verifier/checks/role";
import { detectTag } from "@visulima/email-verifier/checks/tag";
import { analyzeCharacters } from "@visulima/email-verifier/checks/character";
import { analyzeSymbols } from "@visulima/email-verifier/checks/symbol";
import { enrichProvider } from "@visulima/email-verifier/enrich/provider";
import { suggestEmailTypo } from "@visulima/email-verifier/enrich/typo";
import { parseName } from "@visulima/email-verifier/enrich/name";
import { scoreReport } from "@visulima/email-verifier/score";
```

### Scoring

The score is a transparent additive model over a 100-point baseline. Every weight
is overridable:

```ts
import { verifyEmail } from "@visulima/email-verifier";

const report = await verifyEmail("info@example.com", {
    weights: { role: 40, free: 0 },
});
```

## Related

- [`@visulima/disposable-email-domains`](https://github.com/visulima/visulima/tree/main/packages/email/disposable-email-domains) — disposable-domain list (used by `checks/disposable`).
- [`@visulima/free-email-domains`](https://github.com/visulima/visulima/tree/main/packages/email/free-email-domains) — free-provider domain list (used by `checks/free`).
- [`@visulima/email-provider-mx`](https://github.com/visulima/visulima/tree/main/packages/email/email-provider-mx) — MX-host → provider/SEG map (used by `enrich/provider`).
- [`@visulima/email`](https://github.com/visulima/visulima/tree/main/packages/email/email) — the mail-sending library (send-side validation only).

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima email-verifier is open-sourced software licensed under the [MIT][license]

[typescript-badge]: https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white "typescript"
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-badge]: https://img.shields.io/npm/l/@visulima/email-verifier?color=blueviolet&style=for-the-badge "license"
[license]: LICENSE.md "license"
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/email-verifier?logo=npm&style=for-the-badge&labelColor=333333&color=476ad3 "npm downloads"
[npm-downloads]: https://www.npmjs.com/package/@visulima/email-verifier "npm downloads"
[chat-badge]: https://img.shields.io/discord/677851225179ita68409?color=7289da&label=Discord&logo=discord&logoColor=ffffff&style=for-the-badge "chat"
[chat]: https://discord.gg/J8GxgQ7Xv5 "chat"
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge "PRs welcome"
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md "PRs welcome"
