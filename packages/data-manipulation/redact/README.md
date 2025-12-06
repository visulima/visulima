<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="redact" />

</a>

<h3 align="center">Detect whether a terminal or browser supports ansi colors.</h3>

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
- Built-in compatibility with nlp NER - compromise.
- Does not modify input objects
- Performs a deep copy of the input object
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

- stringAnonymize(input, rules, options)
    > It uses Natural Language Processing (NLP) and Regular Expressions (Regex) to identify and mask sensitive information in a string.

```typescript
import { stringAnonymize } from "@visulima/redact";

const input = "John Doe will be 30 on 2024-06-10.";
const result = stringAnonymize(input, defaultModifiers);

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
