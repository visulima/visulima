<div align="center">
  <h3>visulima string</h3>
  <p>
  A robust string manipulation library providing utilities for common string operations with support for multiple languages.
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

## Features

- **Case Conversion**:
    - Convert between camelCase, PascalCase, snake_case, kebab-case, and more
- **String Splitting**:
    - Split strings based on case transitions, script boundaries, and separators
- **Locale Support**:
    - Handle strings in multiple languages including Japanese, Korean, Chinese, and Cyrillic scripts
    - Intelligent script and case boundary detection

---

## Install

```sh
npm install @visulima/string
```

```sh
yarn add @visulima/string
```

```sh
pnpm add @visulima/string
```

## Quick Examples

```typescript
import { splitByCase, camelCase } from '@visulima/string';

// Split complex strings
splitByCase('XMLHttpRequest');  // ['XML', 'Http', 'Request']
splitByCase('日本語Text', { locale: 'ja' });  // ['日本語', 'Text']

// Case conversions
camelCase('hello_world');  // 'helloWorld'
```

## Usage

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima string is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/string?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/string/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/string/v/latest "npm"
