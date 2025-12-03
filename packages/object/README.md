<div align="center">
  <h3>visulima object</h3>
  <p>
  Helper functions for working with objects, build on top of

[is-plain-obj][is-plain-obj],
[dot-prop][dot-prop],
[deeks][deeks] and
[type-fest][type-fest]

  </p>
</div>



<div align="center">

[![TypeScript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/) [![npm](https://img.shields.io/npm/v/@visulima/object/latest.svg?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@visulima/object/v/latest) [![license](https://img.shields.io/npm/l/@visulima/object?color=blueviolet&style=for-the-badge)](https://github.com/visulima/visulima/blob/main/packages/object/LICENSE.md)

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
npm install @visulima/object
```

```sh
yarn add @visulima/object
```

```sh
pnpm add @visulima/object
```

## Usage

### deleteProperty

### escapePath

### getProperty

### hasProperty

### setProperty

### deepKeys

### deepKeysFromList

### isPlainObject

### pick

With `pick` you pass an object and an array of keys of an object - **the props which may stay**.

```js
import { pick } from "@visulima/object";

const squirtle = { id: "007", name: "Squirtle", type: "water" };

const newObject = pick(squirtle, ["name", "type"]);
// returns { name: 'Squirtle', type: 'water' }

const doc = { items: { keep: "📌", discard: "✂️" } };

pick(doc, ["items.keep"]);
// returns {items: {keep: '📌'}}
```

### omit

With `omit` you pass an object and an array of keys of an object - the props which should be removed.

```js
import { omit } from "@visulima/object";

const squirtle = { id: "007", name: "Squirtle", type: "water" };

const withoutId = omit(squirtle, ["id"]);
// returns { name: 'Squirtle', type: 'water' }

const doc = { items: { keep: "📌", discard: "✂️" } };

omit(doc, ["items.discard"]);
// returns {items: {keep: '📌'}}
```

## Related

- [is-plain-object](https://github.com/jonschlinkert/is-plain-object) - Returns true if the given value is an object created by the Object constructor.
- [is-plain-obj][is-plain-obj] - Check if a value is a plain object.
- [dot-prop][dot-prop] - Get, set, or delete a property from a nested object using a dot path.
- [ts-dot-prop](https://github.com/justinlettau/ts-dot-prop) - TypeScript utility to transform nested objects using a dot notation path.
- [dset](https://www.npmjs.com/package/dset) - A tiny (194B) utility for safely writing deep Object values~!
- [filter-anything](https://github.com/mesqueeb/filter-anything) - A simple (TypeScript) integration of "pick" and "omit" to filter props of an object.

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

The visulima object is open-sourced software licensed under the [MIT](https://github.com/visulima/visulima/blob/main/packages/object/LICENSE.md)


[is-plain-obj]: https://github.com/sindresorhus/is-plain-obj
[dot-prop]: https://github.com/sindresorhus/dot-prop
[deeks]: https://github.com/mrodrig/deeks
[type-fest]: https://github.com/sindresorhus/type-fest
