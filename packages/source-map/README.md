<div align="center">
  <h3>visulima source-map</h3>
  <p>
  Provides functionality related to source maps.
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
npm install @visulima/source-map
```

```sh
yarn add @visulima/source-map
```

```sh
pnpm add @visulima/source-map
```

## Usage

```ts
import { loadSourceMap, originalPositionFor, sourceContentFor } from "@visulima/source-map";

const sourceMap = loadSourceMap("your_path/src/index.js"); // returns a TraceMap

const traced = originalPositionFor(sourceMap, { column: 13, line: 30 });

console.log(traced);

// {
//     column: 9,
//     line: 15,
//     name: "setState",
//     source: "your_path/src/index.js"
// }

console.log(sourceContentFor(sourceMap, traced.source)); // 'content for your_path/src/index.js'
```

For more information about the TraceMap see [@jridgewell/trace-mapping](https://github.com/jridgewell/trace-mapping)

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

The visulima source-map is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/source-map?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/source-map/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/source-map/v/latest "npm"
