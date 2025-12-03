<div align="center">
  <h3>visulima inspector</h3>
  <p>
  Inspect utility for Node.js and Browsers.
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
npm install @visulima/inspector
```

```sh
yarn add @visulima/inspector
```

```sh
pnpm add @visulima/inspector
```

## Usage

```typescript
import { inspect } from "@visulima/inspector";

console.log(inspect({ foo: "bar" })); // { foo: 'bar' }
```

### Circular

```typescript
import { inspect } from "@visulima/inspector";

const obj = { a: 1, b: [3, 4] };
obj.c = obj;

console.log(inspect(obj)); // { a: 1, b: [ 3, 4 ], c: [Circular] }
```

## API

### inspect(input: any, options?: InspectOptions): string

#### input

Type: `any`

The input value to inspect.

#### options

Type: `InspectOptions`

The options for the inspect function.

#### options.breakLength

Type: `number`

Default: `Number.POSITIVE_INFINITY`

#### options.customInspect

Type: `boolean`

Default: `true`

#### options.depth

Type: `number`

Default: `5`

The maximum depth to traverse.

#### options.indent

Type: `number | "\t" | undefined`

Default: `undefined`

The indentation to use.

## Related

- [object-inspect](https://github.com/inspect-js/object-inspect) - string representations of objects in node and the browser
- [loupe](https://github.com/chaijs/loupe) - Inspect utility for Node.js and browsers
- [util.inspect](https://nodejs.org/api/util.html#util_util_inspect_object_options)

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

The visulima inspector is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/inspector?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/inspector/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/inspector/v/latest "npm"
