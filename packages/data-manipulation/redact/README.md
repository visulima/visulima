<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="redact" />

</a>

<h3 align="center">A library for redacting and masking sensitive data from objects and strings, with support for GDPR compliance, custom rules, and deep object traversal.</h3>

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

## Why Redact?

- Easy to use
- Anonymize specific categories in a text, including emails, monetary values, organizations, people, and phone numbers and more.
- Customizable anonymization: Specify which categories to anonymize and which to exclude.
- Optional NLP NER via `@visulima/redact/nlp` — names, organizations and money, opt-in so the core stays small
- Never mutates the input (circular references are tracked with a `WeakMap`, not by stamping marker keys onto your objects), so frozen/sealed inputs are safe
- Performs a deep copy of the input object
- Partial masking via censor functions (e.g. keep the last 4 digits of a card)
- Remove keys entirely with `remove: true`
- Compile rules once with `createRedactor()` for hot paths (loggers)
- Handles circular references
- Filters valid JSON strings
- Filters valid and malformed URL query params
- Filters Errors, Arrays, Maps, Sets, and simple objects
- Includes a default set of rules
    - apikey
    - awsid
    - awskey
    - bankacc
    - basic_auth
    - token
    - crypto
    - id
    - creditcard
    - date
    - dl
    - domain
    - ip
    - mac_address
    - phonenumber
    - routing
    - ssn
    - time
    - uk_nin
    - url
    - us_social_security
    - isbn
    - zip_code
    - firstname
    - lastname
    - organization
    - money
    - bankcc
    - email
    - passport
    - password
    - username
    - auth
    - bearer
    - credit
    - CVD
    - CVV
    - encrypt
    - PAN
    - pass
    - secret
- TypeScript support
- Fast and powerful, see the [benchmarks](__bench__/README.md)

> [!WARNING]
> The default rule set (`standardRules`) is intentionally aggressive. Several rules match
> plain numeric/prose data and **will** mangle ordinary values — for example `bankacc`
> (`\b\d{10,12}\b`), `id`/`routing` (`\b\d{9}\b`), `zip_code` (`\b[0-9]{5}\b`), weekday names
> (`monday`, ...) and relative dates (`today`, ...). For most use cases prefer composing only
> the themed subsets you need, or use `exclude` to drop the noisy groups:
>
> ```typescript
> import { redact, credentialRules, piiRules, dateTimeRules, standardRules } from "@visulima/redact";
>
> // Only credentials/secrets (safest):
> redact(input, [...credentialRules]);
>
> // Credentials + PII, but not date/time matching:
> redact(input, [...credentialRules, ...piiRules]);
>
> // Full default set minus the noisiest rules:
> redact(input, standardRules, { exclude: ["bankacc", "zip_code", "id", "routing", "date"] });
> ```

## Install

```sh
npm install @visulima/redact
```

```sh
yarn add @visulima/redact
```

```sh
pnpm add @visulima/redact
```

### Optional: natural-language detection

The core package carries no natural-language engine. To also mask people's names,
organizations and money amounts inside free-form prose, install `compromise` alongside it and
pass the scanner from `@visulima/redact/nlp`:

```sh
npm install @visulima/redact compromise
```

```typescript
import { createRedactor, standardRules } from "@visulima/redact";
import { compromiseScanner } from "@visulima/redact/nlp";

const scrub = createRedactor(standardRules, { nlp: compromiseScanner });

scrub({ note: "John Doe works at Google" });
// => { note: "<FIRSTNAME> <LASTNAME> works at <ORGANIZATION>" }
```

`compromise` ships a ~140 KB (gzipped) English lexicon and costs a parse per scanned string,
which is why it is not wired in by default — a bundle that never imports
`@visulima/redact/nlp` contains none of it. Key-name and `pattern` rules (passwords, tokens,
credit cards, IPs, SSNs, emails, ...) work exactly the same either way; only the four rule keys
that have no regex shape — `firstname`, `lastname`, `organization`, `money` — go unmatched
inside prose without a scanner. They still match object keys of the same name.

Any other engine works too: `NlpScanner` is `(input, types) => { start, tag, text }[]`.

## Usage

- redact(input, rules, options)

```typescript
const input = {
    admin: {
        user: {
            email: "test@example.com",
            password: "123456",
        },
    },
    password: "123456",
    user: {
        email: "test@example.com",
        password: "123456",
    },
};

const result = redact(input, ["password", "user.password", "admin.user.password"]);

console.log(result);

//{
//    admin: {
//        user: {
//            email: "test@example.com",
//            password: "<ADMIN.USER.PASSWORD>",
//        },
//    },
//    password: "<PASSWORD>",
//    user: {
//        email: "test@example.com",
//        password: "<USER.PASSWORD>",
//    },
//}
```

### Partial masking with a censor function

A rule's `replacement` may be a function `(value, path) => newValue`. Use it to keep part of
the value — e.g. the last four digits of a card, or mask the local part of an email:

```typescript
import { redact } from "@visulima/redact";

redact({ card: "4111111111111111" }, [{ key: "card", replacement: (value) => `****${String(value).slice(-4)}` }]);
// => { card: "****1111" }
```

`path` is the full, lowercased dot-path the value was found at — not the rule key. A `card` rule
matching `{ user: { card } }` receives `"user.card"`, and array elements are included by index
(`"items.0.card"`). It is `undefined` for matches with no key path, such as string-anonymizer and
URL query-string matches.

The same works for `pattern`-based string rules (the matched substring is passed as `value`).

### Removing keys

Set `remove: true` to delete a matching key instead of replacing it. Works on objects and `Map`s,
including nested and dotted-path keys:

```typescript
redact({ keep: 1, secret: "x" }, [{ key: "secret", remove: true }]);
// => { keep: 1 }
```

### Reusable redactor (hot paths)

`createRedactor(rules, options?)` compiles the rules once and returns a function you can call
repeatedly — ideal for loggers, where it avoids re-lowercasing keys and re-compiling patterns
on every call:

```typescript
import { createRedactor, standardRules } from "@visulima/redact";

const scrub = createRedactor(standardRules);

logger.info(scrub(payload));
logger.info(scrub(anotherPayload));
```

> [!NOTE]
> The traversal is a single pass: every object node and nested string is visited exactly once
> and evaluated against all rules together, rather than re-walking the tree once per rule. An
> injected NLP scanner is invoked at most once per string; it is handed the rule keys in play and
> returns early when none of them are its own, so `compromiseScanner` charges nothing for a
> rule set of pure key/pattern rules.

- stringAnonymize(input, rules, options)
    > Uses Regular Expressions — and, when a scanner is injected, Natural Language Processing — to identify and mask sensitive information in a string.

```typescript
import { standardRules, stringAnonymize } from "@visulima/redact";
import { compromiseScanner } from "@visulima/redact/nlp";

const input = "John Doe will be 30 on 2024-06-10.";
const result = stringAnonymize(input, standardRules, { nlp: compromiseScanner });

console.log(result);

//"<FIRSTNAME> <LASTNAME> will be 30 on <DATE>"
```

## API

### redact(input, rules, options?)

#### input

Type: `any`

The input value to redact.

#### rules

Type: `(Anonymize | StringAnonymize | number | string)[]`

An array of rules to redact.

#### options

Type: `object`

##### exclude

Type: `(string | number)[]`

Exclude a rule for the rules array.

##### logger

Type: `object`

###### debug

Type: `(message?: any, ...optionalParameters: any[]) => void`

A function to log debug messages.

##### nlp

Type: `NlpScanner`

Opt in to natural-language entity detection. Import `compromiseScanner` from
`@visulima/redact/nlp`, or supply your own function of the same shape. Omitted, the
NLP-only rule keys simply find nothing in prose and `compromise` never enters your bundle.

### stringAnonymize(input, rules, options?)

#### input

Type: `string`

The input value to redact.

#### rules

Type: `(Anonymize | StringAnonymize | number | string)[]`

An array of rules to redact.

#### options

Type: `object`

##### exclude

Type: `(string | number)[]`

Exclude a rule for the rules array.

##### logger

Type: `object`

###### debug

Type: `(message?: any, ...optionalParameters: any[]) => void`

A function to log debug messages.

##### nlp

Type: `NlpScanner`

Opt in to natural-language entity detection. Import `compromiseScanner` from
`@visulima/redact/nlp`, or supply your own function of the same shape. Omitted, the
NLP-only rule keys simply find nothing in prose and `compromise` never enters your bundle.

## Related

- [fast-redact](https://github.com/davidmarkclements/fast-redact) - very fast object redaction
- [fast-unset](https://github.com/lucagoslar/fast-unset) - 🪄 Efficiently remove, replace, set or default object properties.
- [masker](https://github.com/qiwi/masker) - Composite data masking utility
- [sensitive-param-filter](https://github.com/zjullion/sensitive-param-filter) - A package for filtering sensitive data (parameters, keys) from a variety of JS objects
- [anonymize-nlp](https://github.com/nitaiaharoni1/anonymize-nlp) - Anonymize-NLP is a lightweight and robust package for text anonymization. It uses Natural Language Processing (NLP) and Regular Expressions (Regex) to identify and mask sensitive information in a string.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima redact is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/redact?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/redact?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/redact
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
