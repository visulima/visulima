<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="pagination" />

</a>

<h3 align="center">Simple Pagination for Node.</h3>

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

## Features

- **Zero runtime dependencies** — tiny offset/limit paginator (Adonis-style).
- **`Paginator`** — an `Array` subclass holding the current page's rows, with rich meta (`total`, `lastPage`, first/last/next/previous URLs).
- **`CursorPaginator`** — cursor/keyset pagination for stable infinite scroll over large tables.
- **URL helpers** — `baseUrl()`, `queryString()`, `getUrl()`, `getUrlsForRange()`, and `getUrlsForWindow()` (windowed page links with `…` ellipsis markers).
- **Naming strategies** — emit `camelCase` (default) or `snake_case` (`per_page`, `last_page`, …) meta keys.
- **OpenAPI schema builders** — `createPaginationSchemaObject` / `createPaginationMetaSchemaObject`, with correct nullability + `required`, and an OpenAPI 3.1 variant.

> **Important:** `Paginator`/`paginate()` do **not** slice your rows. Pass in the
> rows for the current page already sliced at the data source
> (offset `(page - 1) * perPage`, limit `perPage`). `total` is the count of *all*
> matching records and is what drives `lastPage` and the URLs.

## Installation

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

`paginate(page, perPage, total, rows)` returns a `Paginator` — an `Array`
subclass that holds the **current page's rows** (it does not slice them for you).
Call `.toJSON()` (or `JSON.stringify`) to get the `{ data, meta }` shape.

```ts
import { paginate } from "@visulima/pagination";

const allItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const page = 1;
const perPage = 5;

// Slice the rows for the current page yourself (a real app would do this in SQL).
const pageRows = allItems.slice((page - 1) * perPage, page * perPage);

const pagination = paginate(page, perPage, allItems.length, pageRows);

console.log(pagination.toJSON());
// {
//   data: [1, 2, 3, 4, 5],
//   meta: {
//     firstPage: 1,
//     firstPageUrl: "/?page=1",
//     lastPage: 2,
//     lastPageUrl: "/?page=2",
//     nextPageUrl: "/?page=2",
//     page: 1,
//     perPage: 5,
//     previousPageUrl: null,
//     total: 10,
//   }
// }

// Note: `console.log(pagination)` prints just the array rows ([1,2,3,4,5]),
// because `Paginator` extends `Array`. Use `.toJSON()` / `JSON.stringify` for
// the full `{ data, meta }` payload.
```

### URLs and query strings

```ts
const p = paginate(2, 10, 200, pageRows).baseUrl("/api/items").queryString({ sort: "asc" });

p.getUrl(3); // "/api/items?sort=asc&page=3"
p.getNextPageUrl(); // "/api/items?sort=asc&page=3"
p.getPreviousPageUrl(); // "/api/items?sort=asc&page=1"

// Windowed page links with ellipsis markers (page === null => render "…").
p.getUrlsForWindow({ eachSide: 2 });
// [ {page:1,...}, {page:null,url:null,...}, ...window..., {page:null,url:null}, {page:20,...} ]
```

### snake_case meta (Laravel / AdonisJS style)

```ts
import { paginate, snakeCaseNamingStrategy } from "@visulima/pagination";

paginate(1, 10, 100, pageRows).getMeta(snakeCaseNamingStrategy);
// { first_page: 1, per_page: 10, last_page: 10, ... }
```

### Cursor-based pagination

For stable infinite scroll / keyset pagination over large tables, use
`CursorPaginator`:

```ts
import { CursorPaginator } from "@visulima/pagination";

const rows = [{ id: 5 }, { id: 6 }]; // pre-fetched page rows

const p = CursorPaginator.fromArray(2, rows, { currentCursor: "4", hasMore: true }).baseUrl("/api/items");

p.getMeta();
// {
//   nextCursor: "6",
//   nextPageUrl: "/api/items?cursor=6",
//   perPage: 2,
//   previousCursor: "5",
//   previousPageUrl: "/api/items?cursor=5",
// }
```

### OpenAPI schemas

```ts
import { createPaginationMetaSchemaObject, createPaginationSchemaObject } from "@visulima/pagination";

const meta = createPaginationMetaSchemaObject("PaginationData"); // OpenAPI 3.0
const meta31 = createPaginationMetaSchemaObject("PaginationData", { openApiVersion: "3.1" });

const schema = createPaginationSchemaObject("UserList", { $ref: "#/components/schemas/User" });
```

`nextPageUrl`/`previousPageUrl` are emitted as nullable (they are `null` on the
last/first page) and every field is listed in `required`.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima pagination is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/pagination?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/pagination?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/pagination
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
