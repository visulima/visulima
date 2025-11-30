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

## Usage

### Basic Usage

```typescript
import { isDisposableEmail, isDisposableDomain, getDomainList, getDomainCount } from "@visulima/disposable-email-domains";

// Check if an email is disposable
if (isDisposableEmail("user@mailinator.com")) {
    console.log("Disposable email detected!");
}

// Check if a domain is disposable
if (isDisposableDomain("mailinator.com")) {
    console.log("Disposable domain detected!");
}

// Get all domains as an array
const domains = getDomainList();
console.log(`Total domains: ${domains.length}`);

// Get domain count
const count = getDomainCount();
console.log(`There are ${count} disposable email domains`);
```

### Custom Domains

You can provide custom disposable domains to check against:

```typescript
import { isDisposableEmail, isDisposableDomain } from "@visulima/disposable-email-domains";

const customDomains = new Set(["custom-disposable.com", "temp-mail.org"]);

// Check with custom domains
if (isDisposableEmail("user@custom-disposable.com", customDomains)) {
    console.log("Custom disposable email detected!");
}

if (isDisposableDomain("temp-mail.org", customDomains)) {
    console.log("Custom disposable domain detected!");
}
```

### Domain Metadata

Get detailed information about a specific domain:

```typescript
import { getDomainMetadata } from "@visulima/disposable-email-domains";

const metadata = getDomainMetadata("mailinator.com");

if (metadata) {
    console.log("Domain:", metadata.domain);
    console.log("First seen:", metadata.firstSeen);
    console.log("Last seen:", metadata.lastSeen);
    console.log("Sources:", metadata.sources);
}
```

### Search Domains

Search for domains matching a pattern:

```typescript
import { searchDomains } from "@visulima/disposable-email-domains";

// Find all domains containing "mail"
const mailDomains = searchDomains("mail");

console.log(`Found ${mailDomains.length} domains containing 'mail'`);
mailDomains.forEach((entry) => {
    console.log(`- ${entry.domain} (from ${entry.sources.length} sources)`);
});
```

### Filter by Source

Get domains from a specific repository source:

```typescript
import { getDomainsBySource } from "@visulima/disposable-email-domains";

// Get domains from a specific repository (by name or URL)
const domains = getDomainsBySource("Disposable Email Domains - Primary Source");

console.log(`Found ${domains.length} domains from this source`);
```

### Batch Operations

Check multiple emails or domains at once:

```typescript
import { batchCheckEmails, batchCheckDomains } from "@visulima/disposable-email-domains";

// Check multiple emails
const emails = ["user@mailinator.com", "test@guerrillamail.com", "valid@example.com"];

const emailResults = batchCheckEmails(emails);

emailResults.forEach((isDisposable, email) => {
    console.log(`${email}: ${isDisposable ? "disposable" : "valid"}`);
});

// Check multiple domains
const domains = ["mailinator.com", "example.com", "trashmail.com"];
const domainResults = batchCheckDomains(domains);

domainResults.forEach((isDisposable, domain) => {
    console.log(`${domain}: ${isDisposable ? "disposable" : "valid"}`);
});
```

### Statistics

Get statistics about the disposable email domains:

```typescript
import { getStatistics } from "@visulima/disposable-email-domains";

const stats = getStatistics();

console.log(`Total domains: ${stats.totalDomains}`);
console.log(`Unique sources: ${stats.uniqueSources}`);
console.log(`Date range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);

// Domains per source
Object.entries(stats.domainsPerSource).forEach(([source, count]) => {
    console.log(`${source}: ${count} domains`);
});
```

### Get All Domains

Retrieve all domain entries with full metadata:

```typescript
import { getAllDomains } from "@visulima/disposable-email-domains";

const allDomains = getAllDomains();

allDomains.forEach((entry) => {
    console.log(`${entry.domain} - seen from ${entry.sources.length} sources`);
});
```

## API Reference

### Functions

#### `isDisposableEmail(email, customDomains?)`

Checks if an email address is from a disposable email service.

- **Parameters:**
    - `email` (string): The email address to check
    - `customDomains?` (Set<string>): Optional set of additional disposable domains
- **Returns:** `boolean` - True if the email is from a disposable domain

#### `isDisposableDomain(domain, customDomains?)`

Checks if a domain is in the disposable email domains list.

- **Parameters:**
    - `domain` (string): The domain to check (case-insensitive)
    - `customDomains?` (Set<string>): Optional set of additional disposable domains
- **Returns:** `boolean` - True if the domain is disposable

#### `getDomainList()`

Gets all disposable email domains as a simple array of strings.

- **Returns:** `string[]` - Array of domain strings

#### `getDomainCount()`

Gets the total count of disposable email domains.

- **Returns:** `number` - Number of domains in the list

#### `getDomainMetadata(domain)`

Gets metadata for a specific domain.

- **Parameters:**
    - `domain` (string): The domain to look up (case-insensitive)
- **Returns:** `DomainEntry | undefined` - Domain entry if found, undefined otherwise

#### `getAllDomains()`

Gets all domain entries with full metadata.

- **Returns:** `DomainEntry[]` - Array of all domain entries

#### `searchDomains(pattern)`

Searches for domains matching a pattern.

- **Parameters:**
    - `pattern` (string): Search pattern (case-insensitive, supports partial matches)
- **Returns:** `DomainEntry[]` - Array of matching domain entries

#### `getDomainsBySource(source)`

Gets domains that were seen from a specific source.

- **Parameters:**
    - `source` (RepositorySource): The source repository name or URL to filter by
- **Returns:** `DomainEntry[]` - Array of domain entries from the specified source

#### `batchCheckEmails(emails, customDomains?)`

Checks multiple email addresses at once.

- **Parameters:**
    - `emails` (string[]): Array of email addresses to check
    - `customDomains?` (Set<string>): Optional set of additional disposable domains
- **Returns:** `Map<string, boolean>` - Map of email to boolean indicating if it's disposable

#### `batchCheckDomains(domains, customDomains?)`

Checks multiple domains at once.

- **Parameters:**
    - `domains` (string[]): Array of domains to check
    - `customDomains?` (Set<string>): Optional set of additional disposable domains
- **Returns:** `Map<string, boolean>` - Map of domain to boolean indicating if it's disposable

#### `getStatistics()`

Gets statistics about the disposable email domains.

- **Returns:** `DomainStatistics` - Statistics object with domain counts and metadata

### Types

#### `DomainEntry`

```typescript
interface DomainEntry {
    domain: string;
    firstSeen: string;
    lastSeen: string;
    sources: string[];
}
```

#### `DomainStatistics`

```typescript
interface DomainStatistics {
    dateRange: {
        earliest: string | undefined;
        latest: string | undefined;
    };
    domainsPerSource: Record<string, number>;
    totalDomains: number;
    uniqueSources: number;
}
```

#### `RepositoryConfig`

```typescript
interface RepositoryConfig {
    blocklist_files?: string[];
    description?: string;
    name: string;
    priority?: number;
    type: string;
    url: string;
}
```

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
