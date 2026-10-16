<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="disposable-email-domains" />

</a>

<h3 align="center">A regularly updated list of disposable and temporary email domains.</h3>

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

## Install

```sh
npm install @visulima/disposable-email-domains
```

```sh
yarn add @visulima/disposable-email-domains
```

```sh
pnpm add @visulima/disposable-email-domains
```

## Contributing Sources

<!-- START_PLACEHOLDER_CONTRIBUTING -->

| Repository | Domains | Success | Performance |
|------------|---------|---------|-------------|
| disposable/disposable-email-domains | 98,735 | ✅ | 0.56s (1.5 MB) |
| willwhite/freemail | 88,162 | ✅ | 0.50s (1.3 MB) |
| FGRibreau/mailchecker | 56,512 | ✅ | 0.12s (848.5 KB) |
| wesbos/burner-email-providers | 27,277 | ✅ | 0.07s (388.0 KB) |
| groundcat/disposable-email-domain-list | 21,453 | ✅ | 0.10s (329.4 KB) |
| 7c/fakefilter | 10,648 | ✅ | 0.05s (146.3 KB) |
| sublime-security/static-files | 10,522 | ✅ | 0.29s (144.0 KB) |
| disposable-email-domains/disposable-email-domains | 9,892 | ✅ | 0.17s (139.8 KB) |
| eser/sanitizer-svc | 3,855 | ✅ | 0.24s (48.9 KB) |
| unkn0w/disposable-email-domain-list | 3,616 | ✅ | 0.02s (45.7 KB) |
| MattKetmo/EmailChecker | 2,515 | ✅ | 0.17s (32.4 KB) |
| GeroldSetz/emailondeck.com-domains | 1,121 | ✅ | 0.09s (15.4 KB) |
| castle/disposable-email-domains | 1,000 | ✅ | 0.19s (13.2 KB) |
| jespernissen/disposable-maildomain-list | 982 | ✅ | 0.11s (12.6 KB) |
| TheDahoom/disposable-email | 18 | ✅ | 0.17s (234 B) |

<!-- END_PLACEHOLDER_CONTRIBUTING -->
<!-- START_PLACEHOLDER_LAST_UPDATED -->

_Last updated: 2026-10-16_

<!-- END_PLACEHOLDER_LAST_UPDATED -->

## Usage

### Basic Usage

```typescript
import { isDisposableEmail, areDisposableEmails } from "@visulima/disposable-email-domains";

// Check if an email is disposable
if (isDisposableEmail("user@mailinator.com")) {
    console.log("Disposable email detected!");
}

// Check multiple emails at once
const emails = ["user@mailinator.com", "test@guerrillamail.com", "valid@example.com"];
const results = areDisposableEmails(emails);

results.forEach((isDisposable, email) => {
    console.log(`${email}: ${isDisposable ? "disposable" : "valid"}`);
});
```

### Provider whitelist (baked into the list)

Common email providers (Gmail, Yahoo, Outlook, etc.) from the [email-providers](https://github.com/derhuerst/email-providers) package are filtered **at list-generation time** — they are removed from the published `domains.json` before it ships, so they can never be flagged as disposable. This is _not_ a runtime allowlist: there is no provider-whitelist parameter at call time. If you need a runtime escape hatch for a specific domain, use the `allowDomains` option below.

```typescript
import { isDisposableEmail } from "@visulima/disposable-email-domains";

// Common providers are absent from the list, so they are never flagged
isDisposableEmail("user@gmail.com"); // false
isDisposableEmail("user@yahoo.com"); // false
isDisposableEmail("user@outlook.com"); // false

// Disposable emails are still detected
isDisposableEmail("user@mailinator.com"); // true - disposable
```

### Custom domains

You can provide custom disposable domains to check on top of the built-in list. Custom domains use the same wildcard/subdomain semantics as the built-in list (a custom `custom-disposable.com` also matches `sub.custom-disposable.com`):

```typescript
import { isDisposableEmail, areDisposableEmails } from "@visulima/disposable-email-domains";

const customDomains = new Set(["custom-disposable.com", "temp-mail.org"]);

// Legacy form: pass a Set directly
if (isDisposableEmail("user@custom-disposable.com", customDomains)) {
    console.log("Custom disposable email detected!");
}

// Options-object form (equivalent)
isDisposableEmail("user@custom-disposable.com", { customDomains });

// Batch check with custom domains
const results = areDisposableEmails(["user@custom-disposable.com", "user@example.com"], customDomains);
```

### Runtime allowlist (`allowDomains`)

If a legitimate customer domain wrongly ends up in the list, allowlist it at runtime without forking. The allowlist is checked **before** the disposable list and wins over both the built-in list and `customDomains`. It also honours subdomain matching:

```typescript
import { isDisposableEmail } from "@visulima/disposable-email-domains";

const allowDomains = new Set(["legit-customer.com"]);

isDisposableEmail("user@legit-customer.com", { allowDomains }); // false, even if it's in the list
isDisposableEmail("user@mail.legit-customer.com", { allowDomains }); // false (subdomain)
```

### Bare-domain checks

If you already have a domain (e.g. from an MX lookup or a parsed signup form), use `isDisposableDomain` / `extractDomain` directly instead of fabricating an `x@domain` address:

```typescript
import { isDisposableDomain, extractDomain } from "@visulima/disposable-email-domains";

isDisposableDomain("mailinator.com"); // true
extractDomain("User@Example.COM"); // "example.com"
```

### Edge / browser / bundled runtimes

For Cloudflare Workers, Next.js middleware/edge and other bundles, import from the `/edge` subpath. It exports the same API as the main entry, but ships the list inside your bundle and registers it for you, so there is no filesystem access and no `setDomains` call:

```typescript
import { isDisposableEmail } from "@visulima/disposable-email-domains/edge";

isDisposableEmail("user@mailinator.com"); // true, no setup
```

The list is about 2.8 MB (about 0.9 MB gzipped) of your bundle and cannot be tree-shaken, which is why it is a separate entry: use `/edge` only where you need it, and use the main entry with `setDomains` if you supply your own list.

**Using the main entry instead?** By default the package reads `dist/domains.json` from disk via `node:fs`, the first time a lookup needs it. That is not possible in Cloudflare Workers, Next.js middleware/edge, or bundles that relocate `index.js` away from the data file. Importing the package is safe everywhere, but when the loader cannot read the list nothing matches the built-in list (only `customDomains` you pass per call still match) and a single warning is logged.

Inject the list once at startup with `setDomains` and, since disposable detection is often a signup gate, call `assertListLoaded()` at startup so a missed or failed load throws instead of failing open (`isListLoaded()` is the non-throwing check):

```typescript
import { setDomains, isDisposableEmail } from "@visulima/disposable-email-domains";
import domains from "@visulima/disposable-email-domains/domains";

setDomains(domains);

isDisposableEmail("user@mailinator.com"); // true — no filesystem access
```

On Node you can also call `await preload()` once at startup to move the synchronous read+parse of the multi-megabyte list off the request hot path, and `isListLoaded()` to detect the degraded fail-open state (e.g. a missing/corrupt data file):

```typescript
import { preload, isListLoaded } from "@visulima/disposable-email-domains";

await preload();

if (!isListLoaded()) {
    // The built-in list failed to load — disposable detection is disabled.
}
```

### Raw domain list (`./domains`)

The raw, sorted array of disposable domains is the default export of the `./domains` subpath. It is a plain ES module, so no JSON import attribute is needed:

```typescript
import domains from "@visulima/disposable-email-domains/domains";

console.log(domains.length); // number of disposable domains
```

## API Reference

### Functions

All check functions accept either a `Set<string>` of additional disposable domains (legacy) or an options object:

```typescript
interface DisposableEmailOptions {
    /** Domains that should never be treated as disposable (wins over everything, supports subdomains). */
    allowDomains?: Set<string>;
    /** Extra disposable domains to check on top of the built-in list (supports subdomains). */
    customDomains?: Set<string>;
}
```

#### `isDisposableEmail(email, options?)`

Checks if an email address is from a disposable email service.

- **Parameters:**
    - `email` (string): The email address to check
    - `options?` (`Set<string>` | `DisposableEmailOptions`): A set of additional disposable domains, or an options object
- **Returns:** `boolean` — True if the email is from a disposable domain
- **Features:**
    - Case-insensitive matching
    - Wildcard/subdomain matching (e.g., `subdomain.33mail.com` matches `33mail.com`) for built-in, custom, and allowlisted domains

#### `areDisposableEmails(emails, options?)`

Checks multiple email addresses at once. Returns a Map for efficient lookups.

- **Parameters:**
    - `emails` (string[]): Array of email addresses to check
    - `options?` (`Set<string>` | `DisposableEmailOptions`): A set of additional disposable domains, or an options object
- **Returns:** `Map<string, boolean>` — Map of email to boolean indicating if it's disposable

#### `isDisposableDomain(domain, options?)`

Like `isDisposableEmail` but accepts a bare domain rather than a full email address.

#### `extractDomain(email)`

Returns the normalized (lowercased, trimmed) domain of an email address, or `undefined` if the address is invalid.

#### `setDomains(domains)`

Injects the disposable-domain list explicitly, bypassing the Node filesystem loader. Use in edge/browser/bundled runtimes (see [Edge / browser / bundled runtimes](#edge--browser--bundled-runtimes)).

#### `preload()`

Eagerly loads the built-in list (Node) so the first check does not stall the event loop. Returns a `Promise<void>`.

#### `isListLoaded()`

Returns `true` once the built-in list is loaded; `false` if it has not been accessed yet or failed to load (missing/corrupt data file). Useful to detect the degraded fail-open state.

### How It Works

1. **Domain List**: The package maintains a regularly updated list of disposable email domains from multiple trusted sources (see Contributing Sources above).

2. **Provider whitelist**: Common email providers from the [email-providers](https://github.com/derhuerst/email-providers) package are filtered out **when the list is generated**, so they are simply absent from the published list. There is no runtime provider-whitelist mechanism; use `allowDomains` for per-call exceptions.

3. **Wildcard Matching**: The package supports wildcard matching by checking parent domains. For example, `subdomain.33mail.com` will match `33mail.com` if it's in the disposable list.

4. **Custom & allow domains**: You can supply additional disposable domains (`customDomains`) or a runtime allowlist (`allowDomains`), both with subdomain matching.

## Related

- [@visulima/email](https://github.com/visulima/visulima/tree/main/packages/email/email) — multi-provider email library that re-exports this check at `@visulima/email/validation/disposable-email-domains`.

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

The visulima disposable-email-domains is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/disposable-email-domains?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/disposable-email-domains?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/disposable-email-domains
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/902465130518949899.svg?style=for-the-badge
[chat]: https://discord.gg/eajEZvk2PG
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
