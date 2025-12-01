<div align="center">
  <h3>visulima disposable-email-domains</h3>
  <p>
  A regularly updated list of disposable and temporary email domains.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

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

| Repository                                        | Domains | Success | Performance      |
| ------------------------------------------------- | ------- | ------- | ---------------- |
| kslr/disposable-email-domains                     | 112.551 | ✅      | 0.14s (1.7 MB)   |
| FGRibreau/mailchecker                             | 55.864  | ✅      | 0.33s (838.4 KB) |
| wesbos/burner-email-providers                     | 27.284  | ✅      | 0.20s (388.1 KB) |
| groundcat/disposable-email-domain-list            | 27.120  | ✅      | 0.30s (401.7 KB) |
| disposable/disposable-email-domains               | 26.697  | ✅      | 0.42s (375.5 KB) |
| sublime-security/static-files                     | 10.523  | ✅      | 0.10s (144.0 KB) |
| 7c/fakefilter                                     | 8.975   | ✅      | 0.04s (128.9 KB) |
| disposable-email-domains/disposable-email-domains | 4.932   | ✅      | 0.10s (62.3 KB)  |
| willwhite/freemail                                | 4.462   | ✅      | 0.04s (61.8 KB)  |
| eser/sanitizer-svc                                | 3.855   | ✅      | 0.09s (48.9 KB)  |
| unkn0w/disposable-email-domain-list               | 3.617   | ✅      | 0.03s (45.8 KB)  |
| MattKetmo/EmailChecker                            | 2.515   | ✅      | 0.02s (32.4 KB)  |
| GeroldSetz/emailondeck.com-domains                | 1.121   | ✅      | 0.09s (15.4 KB)  |
| jespernissen/disposable-maildomain-list           | 1.024   | ✅      | 0.02s (13.2 KB)  |
| TheDahoom/disposable-email                        | 18      | ✅      | 0.08s (234 B)    |

<!-- END_PLACEHOLDER_CONTRIBUTING -->
<!-- START_PLACEHOLDER_LAST_UPDATED -->

_Last updated: 2025-12-01T11:40:49.150Z_

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

### Whitelist Protection

This package automatically whitelists common email providers (like Gmail, Yahoo, Outlook, etc.) from the [email-providers](https://github.com/derhuerst/email-providers) package. This ensures that legitimate email providers are never incorrectly flagged as disposable, even if they appear in the disposable domains list.

```typescript
import { isDisposableEmail } from "@visulima/disposable-email-domains";

// Common email providers are automatically whitelisted
isDisposableEmail("user@gmail.com"); // false - whitelisted
isDisposableEmail("user@yahoo.com"); // false - whitelisted
isDisposableEmail("user@outlook.com"); // false - whitelisted

// Disposable emails are still detected
isDisposableEmail("user@mailinator.com"); // true - disposable
```

### Custom Domains

You can provide custom disposable domains to check against:

```typescript
import { isDisposableEmail, areDisposableEmails } from "@visulima/disposable-email-domains";

const customDomains = new Set(["custom-disposable.com", "temp-mail.org"]);

// Check with custom domains
if (isDisposableEmail("user@custom-disposable.com", customDomains)) {
    console.log("Custom disposable email detected!");
}

// Batch check with custom domains
const emails = ["user@custom-disposable.com", "user@example.com"];
const results = areDisposableEmails(emails, customDomains);

results.forEach((isDisposable, email) => {
    console.log(`${email}: ${isDisposable ? "disposable" : "valid"}`);
});
```

## API Reference

### Functions

#### `isDisposableEmail(email, customDomains?)`

Checks if an email address is from a disposable email service. Common email providers (Gmail, Yahoo, Outlook, etc.) are automatically whitelisted and will never be flagged as disposable.

- **Parameters:**
    - `email` (string): The email address to check
    - `customDomains?` (Set<string>): Optional set of additional disposable domains to check
- **Returns:** `boolean` - True if the email is from a disposable domain
- **Features:**
    - Case-insensitive matching
    - Supports wildcard matching (e.g., `subdomain.33mail.com` matches `33mail.com`)
    - Automatically whitelists common email providers

#### `areDisposableEmails(emails, customDomains?)`

Checks multiple email addresses at once. Returns a Map for efficient lookups.

- **Parameters:**
    - `emails` (string[]): Array of email addresses to check
    - `customDomains?` (Set<string>): Optional set of additional disposable domains to check
- **Returns:** `Map<string, boolean>` - Map of email to boolean indicating if it's disposable
- **Features:**
    - Batch processing for better performance
    - Same whitelist protection as `isDisposableEmail`

### How It Works

1. **Domain List**: The package maintains a regularly updated list of disposable email domains from multiple trusted sources (see Contributing Sources above).

2. **Whitelist Protection**: Common email providers from the [email-providers](https://github.com/derhuerst/email-providers) package are automatically whitelisted. This ensures legitimate providers like Gmail, Yahoo, and Outlook are never incorrectly flagged as disposable.

3. **Wildcard Matching**: The package supports wildcard matching by checking parent domains. For example, `subdomain.33mail.com` will match `33mail.com` if it's in the disposable list.

4. **Custom Domains**: You can provide additional disposable domains to check against, useful for domain-specific blocklists.

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima disposable-email-domains is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/disposable-email-domains?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/disposable-email-domains/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/disposable-email-domains/v/latest "npm"
