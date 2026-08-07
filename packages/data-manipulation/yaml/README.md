<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="yaml" />

</a>

<h3 align="center">A fast, zero-dependency YAML 1.2 parser and serializer with a drop-in API for both <code>yaml</code> and <code>js-yaml</code>.</h3>

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

- **YAML 1.2 core schema** — strict, spec-compliant scalar resolution (`null`, `bool`, `int` in dec/hex/oct, `float`, `.inf`/`.nan`). `yes`/`no`/`on`/`off` are strings, as YAML 1.2 mandates.
- **Full block & flow grammar** — block/flow mappings and sequences, all five scalar styles (plain, single-quoted, double-quoted, literal `|`, folded `>`) with chomping and indentation indicators.
- **Anchors, aliases & merge keys** — `&anchor` / `*alias` with shared references, plus `<<` merge keys.
- **Multi-document streams** — `---` / `...` document markers and `%YAML` / `%TAG` directives.
- **Two compatible APIs** — the `yaml`-style `parse` / `stringify` and the `js-yaml`-style `load` / `loadAll` / `dump`.
- **Safe by default** — prototype-pollution guard, duplicate-key detection, and an alias-expansion (billion-laughs) limit.
- **Zero runtime dependencies** and fully typed.

## Install

```sh
npm install @visulima/yaml
```

```sh
yarn add @visulima/yaml
```

```sh
pnpm add @visulima/yaml
```

## Usage

### parse

```ts
import { parse } from "@visulima/yaml";

parse(`
name: my-app
version: 1.0.0
scripts:
  build: packem build
  test: vitest run
tags: [cli, tooling]
`);
// => {
//   name: "my-app",
//   version: "1.0.0",
//   scripts: { build: "packem build", test: "vitest run" },
//   tags: ["cli", "tooling"],
// }
```

### stringify

```ts
import { stringify } from "@visulima/yaml";

stringify({ name: "my-app", tags: ["cli", "tooling"], nested: { a: 1 } });
// name: my-app
// tags:
//   - cli
//   - tooling
// nested:
//   a: 1
```

### Multiple documents

```ts
import { parseAll } from "@visulima/yaml";

parseAll("---\na: 1\n---\nb: 2"); // => [{ a: 1 }, { b: 2 }]
```

### Anchors, aliases and merge keys

```ts
import { parse } from "@visulima/yaml";

parse(`
defaults: &defaults
  adapter: postgres
  host: localhost
development:
  <<: *defaults
  database: dev
`);
// => {
//   defaults: { adapter: "postgres", host: "localhost" },
//   development: { adapter: "postgres", host: "localhost", database: "dev" },
// }
```

### js-yaml-compatible API

Already using `js-yaml`? Swap the import — `load`, `loadAll` and `dump` are exported with the same shape.

```ts
import { load, loadAll, dump } from "@visulima/yaml";

load("foo: bar"); // => { foo: "bar" }
dump({ foo: "bar" }); // => "foo: bar\n"

loadAll("---\n- 1\n---\n- 2", (doc) => console.log(doc)); // logs [1] then [2]
```

## API

### `parse(source, options?)` / `load(source, options?)`

Parse the first document of a YAML string into a native JavaScript value.

`options`:

| Option                  | Type                                 | Default   | Description                                                             |
| ----------------------- | ------------------------------------ | --------- | ----------------------------------------------------------------------- |
| `duplicateKeys`         | `"error" \| "overwrite" \| "ignore"` | `"error"` | How repeated keys within a mapping are handled.                         |
| `maxAliasCount`         | `number`                             | `100`     | Upper bound on resolved alias nodes (guards against expansion attacks). |
| `preventProtoPollution` | `boolean`                            | `true`    | Drop `__proto__` / `constructor` / `prototype` keys.                    |
| `onWarning`             | `(warning: YAMLWarning) => void`     | —         | Callback for non-fatal notices.                                         |

### `parseAll(source, options?)` / `loadAll(source, iterator?, options?)`

Parse every document of a multi-document stream. `parseAll` returns an array; the
`js-yaml`-style `loadAll` optionally accepts a per-document iterator.

### `stringify(value, options?)` / `dump(value, options?)`

Serialize a JavaScript value to a YAML document string.

`options`:

| Option        | Type                            | Default | Description                                                        |
| ------------- | ------------------------------- | ------- | ------------------------------------------------------------------ |
| `indent`      | `number`                        | `2`     | Spaces per indentation level.                                      |
| `flowLevel`   | `number`                        | `-1`    | Use flow style at or beyond this nesting level (`-1` disables it). |
| `sortKeys`    | `boolean \| ((a, b) => number)` | `false` | Sort mapping keys.                                                 |
| `lineWidth`   | `number`                        | `80`    | Preferred wrap width for folded scalars.                           |
| `forceQuotes` | `boolean`                       | `false` | Escape non-ASCII characters in double-quoted scalars.              |
| `skipInvalid` | `boolean`                       | `false` | Skip `undefined` members instead of emitting `null`.               |
| `directives`  | `boolean`                       | `false` | Emit a leading `---` document marker.                              |
| `replacer`    | `(key, value) => unknown`       | —       | `JSON.stringify`-style value replacer.                             |

### Errors

`YAMLParseError`, `YAMLStringifyError`, `YAMLWarning` and the shared base `YAMLError`
are exported. Parse errors carry a `mark` with `{ line, column, position }` and a
source snippet.

## Benchmarks

`@visulima/yaml` is benchmarked against `yaml` and `js-yaml` across small, medium,
large, anchor-heavy and stringify workloads. See [`__bench__`](./__bench__) and run:

```sh
pnpm --filter yaml-bench run test:bench
```

## Related

- [yaml](https://github.com/eemeli/yaml) — feature-rich YAML parser with CST support.
- [js-yaml](https://github.com/nodeca/js-yaml) — the long-standing JavaScript YAML implementation.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima yaml is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/yaml?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/yaml?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/yaml
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
