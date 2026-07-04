<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="free-email-domains" />

</a>

<h3 align="center">A regularly updated list of free email service provider domains.</h3>

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
npm install @visulima/free-email-domains
```

```sh
yarn add @visulima/free-email-domains
```

```sh
pnpm add @visulima/free-email-domains
```

## Contributing Sources

<!-- START_PLACEHOLDER_CONTRIBUTING -->

| Repository | Domains | Success | Performance |
|------------|---------|---------|-------------|
| willwhite/freemail | 4.462 | ✅ | 0.11s (61.8 KB) |

<!-- END_PLACEHOLDER_CONTRIBUTING -->
<!-- START_PLACEHOLDER_LAST_UPDATED -->

_Last updated: 2026-07-03_

<!-- END_PLACEHOLDER_LAST_UPDATED -->

## Usage

### Basic Usage

```typescript
import { isFreeEmail, areFreeEmails } from "@visulima/free-email-domains";

// Check if an email is from a free provider
if (isFreeEmail("user@gmail.com")) {
    console.log("Free email provider detected!");
}

// Check multiple emails at once
const emails = ["user@gmail.com", "test@yahoo.com", "ceo@my-company.com"];
const results = areFreeEmails(emails);

results.forEach((isFree, email) => {
    console.log(`${email}: ${isFree ? "free provider" : "custom/corporate"}`);
});
```

### Custom domains

You can provide custom free-provider domains to check on top of the built-in list. Custom domains use the same wildcard/subdomain semantics as the built-in list (a custom `my-free-mail.com` also matches `sub.my-free-mail.com`):

```typescript
import { isFreeEmail, areFreeEmails } from "@visulima/free-email-domains";

const customDomains = new Set(["my-free-mail.com", "regional-webmail.com"]);

// Legacy form: pass a Set directly
if (isFreeEmail("user@my-free-mail.com", customDomains)) {
    console.log("Custom free email detected!");
}

// Options-object form (equivalent)
isFreeEmail("user@my-free-mail.com", { customDomains });

// Batch check with custom domains
const results = areFreeEmails(["user@my-free-mail.com", "user@example.com"], customDomains);
```

### Runtime allowlist (`allowDomains`)

If one of your own domains wrongly ends up in the list, allowlist it at runtime without forking. The allowlist is checked **before** the free list and wins over both the built-in list and `customDomains`. It also honours subdomain matching:

```typescript
import { isFreeEmail } from "@visulima/free-email-domains";

const allowDomains = new Set(["my-own-domain.com"]);

isFreeEmail("user@my-own-domain.com", { allowDomains }); // false, even if it's in the list
isFreeEmail("user@mail.my-own-domain.com", { allowDomains }); // false (subdomain)
```

### Bare-domain checks

If you already have a domain (e.g. from an MX lookup or a parsed signup form), use `isFreeDomain` / `extractDomain` directly instead of fabricating an `x@domain` address:

```typescript
import { isFreeDomain, extractDomain } from "@visulima/free-email-domains";

isFreeDomain("gmail.com"); // true
extractDomain("User@Example.COM"); // "example.com"
```

### Edge / browser / bundled runtimes

By default the package reads `dist/domains.json` from disk via `node:fs`. That does not work in Cloudflare Workers, Next.js middleware/edge, Deno, or bundles that relocate `index.js` away from the data file. For those environments, import the list statically and inject it once at startup with `setDomains`:

```typescript
import { setDomains, isFreeEmail } from "@visulima/free-email-domains";
import domains from "@visulima/free-email-domains/domains" with { type: "json" };

setDomains(domains);

isFreeEmail("user@gmail.com"); // true — no filesystem access
```

On Node you can also call `await preload()` once at startup to move the synchronous read+parse of the list off the request hot path, and `isListLoaded()` to detect the degraded state (e.g. a missing/corrupt data file):

```typescript
import { preload, isListLoaded } from "@visulima/free-email-domains";

await preload();

if (!isListLoaded()) {
    // The built-in list failed to load — free-provider detection is disabled.
}
```

### Raw domain list (`./domains`)

The raw, sorted array of free-provider domains is exported from the `./domains` subpath. In Node ESM you must use a JSON import attribute:

```typescript
import domains from "@visulima/free-email-domains/domains" with { type: "json" };

console.log(domains.length); // number of free-provider domains
```

## API Reference

### Functions

All check functions accept either a `Set<string>` of additional free domains (legacy) or an options object:

```typescript
interface FreeEmailOptions {
    /** Domains that should never be treated as free (wins over everything, supports subdomains). */
    allowDomains?: Set<string>;
    /** Extra free-provider domains to check on top of the built-in list (supports subdomains). */
    customDomains?: Set<string>;
}
```

#### `isFreeEmail(email, options?)`

Checks if an email address is from a free email service.

- **Parameters:**
    - `email` (string): The email address to check
    - `options?` (`Set<string>` | `FreeEmailOptions`): A set of additional free domains, or an options object
- **Returns:** `boolean` — True if the email is from a free-provider domain
- **Features:**
    - Case-insensitive matching
    - Wildcard/subdomain matching (e.g., `mail.gmail.com` matches `gmail.com`) for built-in, custom, and allowlisted domains

#### `areFreeEmails(emails, options?)`

Checks multiple email addresses at once. Returns a Map for efficient lookups.

- **Parameters:**
    - `emails` (string[]): Array of email addresses to check
    - `options?` (`Set<string>` | `FreeEmailOptions`): A set of additional free domains, or an options object
- **Returns:** `Map<string, boolean>` — Map of email to boolean indicating if it's a free-provider address

#### `isFreeDomain(domain, options?)`

Like `isFreeEmail` but accepts a bare domain rather than a full email address.

#### `extractDomain(email)`

Returns the normalized (lowercased, trimmed) domain of an email address, or `undefined` if the address is invalid.

#### `setDomains(domains)`

Injects the free-domain list explicitly, bypassing the Node filesystem loader. Use in edge/browser/bundled runtimes (see [Edge / browser / bundled runtimes](#edge--browser--bundled-runtimes)).

#### `preload()`

Eagerly loads the built-in list (Node) so the first check does not stall the event loop. Returns a `Promise<void>`.

#### `isListLoaded()`

Returns `true` once the built-in list is loaded; `false` if it has not been accessed yet or failed to load (missing/corrupt data file). Useful to detect the degraded state.

### How It Works

1. **Domain List**: The package maintains a regularly updated list of free email provider domains sourced from the [email-providers](https://github.com/derhuerst/email-providers) dataset and additional community-maintained lists (see Contributing Sources above).

2. **Wildcard Matching**: The package supports wildcard matching by checking parent domains. For example, `mail.gmail.com` will match `gmail.com` if it's in the free list.

3. **Custom & allow domains**: You can supply additional free domains (`customDomains`) or a runtime allowlist (`allowDomains`), both with subdomain matching.

## Related

- [@visulima/disposable-email-domains](https://github.com/visulima/visulima/tree/main/packages/email/disposable-email-domains) — the sibling package for disposable / temporary email domains.

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

The visulima free-email-domains is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/free-email-domains?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/free-email-domains?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/free-email-domains
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
