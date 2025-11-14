<div align="center">
  <h3>Visulima pagination</h3>
  <p>
  Visulima pagination is a simple pagination for node.

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
npm install @visulima/pagination
```

```sh
yarn add @visulima/pagination
```

```sh
pnpm add @visulima/pagination
```

## Usage

```ts
import { paginate } from "@visulima/pagination";

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const pagination = paginate(1, 5, items.length, items);

console.log(pagination);
// {
//   data: [1, 2, 3, 4, 5],
//   meta: {
//     total: 10,
//     perPage: 5,
//     page: 1,
//     lastPage: 2,
//     firstPage: 1,
//     firstPageUrl: "/?page=1",
//     lastPageUrl: "/?page=2",
//     nextPageUrl: "/?page=2",
//     previousPageUrl: null,
//   }
// }
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima pagination is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/pagination?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/pagination/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/pagination/v/latest "npm"
