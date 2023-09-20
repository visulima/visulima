<div align="center">
  <h3>Visulima Deep Clone</h3>
  <p>
  Really Fast Deep Clone.
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
npm install --dev @visulima/deep-clone
```

```sh
yarn add --dev @visulima/deep-clone
```

```sh
pnpm add --dev @visulima/deep-clone
```

## Usage

```typescript
import deepClone from "@visulima/deep-clone";

const cloned = deepClone({a: 1, b: {c: 2}})

console.log(cloned); // => {a: 1, b: {c: 2}}
```

## Benchmarks

Note:

It is true that `jsondiffpatch.clone()` from [jsondiffpatch](https://www.npmjs.com/package/jsondiffpatch) is faster than `@visulima/deep-clonse` in this particular benchmark, but it cannot handle as many situations as `@visulima/deep-clonse` can.

It is true that [fastest-json-copy](https://www.npmjs.com/package/fastest-json-copy) is faster than `@visulima/deep-clonse` in this particular benchmark. Also, fastest-json-copy has such huge limitations that it is rarely useful. For example, it treats things like `Date` and `Map` instances the same as empty `{}`. It can't handle circular references.

[plain-object-clone](https://www.npmjs.com/package/plain-object-clone) is also really limited in capability.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima readdir is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/readdir?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/readdir/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/readdir/v/latest "npm"
