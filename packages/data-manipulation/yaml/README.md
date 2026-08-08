<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="yaml" />

</a>

<h3 align="center">A fast, zero-dependency YAML 1.2 parser and serializer with a drop-in API for both `yaml` and `js-yaml`.</h3>

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

- **100% spec conformance** — passes all 402 cases of the official [yaml-test-suite](https://github.com/yaml/yaml-test-suite) in the default (strict) mode.
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

| Option                  | Type                                           | Default   | Description                                                                              |
| ----------------------- | ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `duplicateKeys`         | `"error" \| "overwrite" \| "ignore"`           | `"error"` | How repeated keys within a mapping are handled.                                          |
| `schema`                | `"core" \| "failsafe" \| "json" \| "yaml-1.1"` | `"core"`  | Scalar-resolution rules (see below).                                                     |
| `version`               | `"1.1" \| "1.2"`                               | `"1.2"`   | YAML version assumed without a `%YAML` directive. `"1.1"` selects the `yaml-1.1` schema. |
| `customTags`            | `ScalarTag[] \| (tags) => ScalarTag[]`         | —         | Extra scalar types (see below).                                                          |
| `reviver`               | `(key, value) => unknown`                      | —         | Applied to every pair after parsing, like `JSON.parse`. Return `undefined` to drop.      |
| `merge`                 | `boolean`                                      | `true`    | Resolve `<<` merge keys.                                                                 |
| `mapAsMap`              | `boolean`                                      | `false`   | Build mappings as `Map`, keeping complex keys native.                                    |
| `intAsBigInt`           | `boolean`                                      | `false`   | Resolve integers as `BigInt`.                                                            |
| `stringKeys`            | `boolean`                                      | `false`   | Keep every mapping key a string.                                                         |
| `maxDepth`              | `number`                                       | `1000`    | Maximum collection nesting depth (guards against stack exhaustion).                      |
| `maxAliasCount`         | `number`                                       | `100`     | Upper bound on resolved alias nodes (guards against expansion attacks).                  |
| `preventProtoPollution` | `boolean`                                      | `true`    | Make a `__proto__` key an own property instead of touching the prototype.                |
| `strict`                | `boolean`                                      | `true`\*  | Full YAML 1.2 strictness (see below). Set `false` for js-yaml-style leniency.            |
| `onWarning`             | `(warning: YAMLWarning) => void`               | —         | Callback for non-fatal notices.                                                          |

#### Custom tags

A tag teaches the parser one extra scalar type. Give it a `test` and
`default: true` to resolve implicitly as well as via an explicit `!!tag`:

```ts
class Hex {
    constructor(readonly value: number) {}
}

const hex = {
    tag: "!!hex",
    test: /^0h[\da-f]+$/i,
    default: true,
    resolve: (raw) => new Hex(Number.parseInt(raw.slice(2), 16)),
    identify: (value) => value instanceof Hex,
    stringify: (value) => `0h${value.value.toString(16)}`,
};

parse("a: 0hff", { customTags: [hex] }); // => { a: Hex(255) }
parse("a: !!hex 0hff", { customTags: [hex] }); // => { a: Hex(255) }
stringify({ a: new Hex(255) }, { customTags: [hex] }); // => "a: !!hex 0hff\n"
```

`resolve` receives the raw text and `stringify` the value — this parser builds
native values directly, so there are no node wrappers to unpack. Collection tags
are not supported for the same reason.

#### Schemas

A schema decides which unquoted scalars stop being strings. `core` (the default)
is YAML 1.2 core. `failsafe` resolves nothing. `json` resolves only the JSON
grammar and rejects anything else. `yaml-1.1` is the older, wider set:

```ts
parse("a: off"); // => { a: "off" }   — core: not a boolean
parse("a: off", { schema: "yaml-1.1" }); // => { a: false }
parse("a: 010", { schema: "yaml-1.1" }); // => { a: 8 }       — octal
parse("a: 1_000", { schema: "yaml-1.1" }); // => { a: 1000 }  — underscores
parse("a: 1:30", { schema: "yaml-1.1" }); // => { a: 90 }     — sexagesimal
parse("a: 2001-12-15", { schema: "yaml-1.1" }); // => { a: Date }

parse("a: 1", { schema: "failsafe" }); // => { a: "1" }
parse("a: ~", { schema: "json" }); // throws — not JSON
```

`version: "1.1"` selects the `yaml-1.1` schema unless `schema` says otherwise.
Note that under 1.1 a bare `y` or `n` key is a boolean, which is why
`x: true\ny: off` parses as `{ x: true, true: false }` — the same result `yaml`
produces.

#### Strict mode (default)

The parser always rejects the unambiguous YAML 1.2 violations (tabs used as indentation,
malformed `%YAML`/`%TAG` directives, deficient indentation, comments not separated from
other tokens by white space). On top of that, strict mode — **on by default** — rejects
the corner cases that both reference parsers accept but the spec does not: a node property
indented no deeper than its parent key (`key: &a\n!!map\n  a: b`), and a block collection
whose first entry sits on the `---` line (`--- a: b`). Pass `strict: false` to relax only
these checks (closer to `js-yaml`); it never changes the value of an accepted document.

```ts
parse("--- a: b"); // throws YAMLParseError (block mapping on the --- line)
parse("--- a: b", { strict: false }); // => { a: "b" }
```

\* `strict` defaults to `true` for `parse` / `parseAll`, but the `js-yaml`-style
`load` / `loadAll` aliases default to `strict: false` so they stay drop-in
replacements for `js-yaml`. Pass `{ strict: true }` to opt in.

### `parseDocument(source, options?)` / `parseAllDocuments(source, options?)`

Parse **without throwing**. Each returns a `YAMLDocument` carrying its own
`errors` and `warnings`, so a caller can report problems in its own words —
and `parseAllDocuments` keeps going after a malformed document instead of
losing the whole stream.

Documents also support **comment-preserving edits**: `setIn` splices the
original source rather than re-serializing it, so comments, blank lines and key
order elsewhere in the file are untouched.

```ts
import { parseDocument } from "@visulima/yaml";

const document = parseDocument("packages:\n  - 'a/*'\n\n# keep me\n");

document.setIn(["overrides", "some-pkg"], "npm:other@1.2.3");
document.toString();
// packages:
//   - 'a/*'
//
// # keep me
// overrides:
//   some-pkg: npm:other@1.2.3
```

| Member                           | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `errors` / `warnings`            | Diagnostics from reading the document.        |
| `toJS()` / `toJSON()`            | The parsed value.                             |
| `get(key)` / `getIn(path)`       | Read a value by key or path.                  |
| `has(key)` / `hasIn(path)`       | Whether a key or path is present.             |
| `set(key, v)` / `setIn(path, v)` | Edit, creating missing intermediate mappings. |
| `toString()`                     | The source with every pending edit applied.   |

Error recovery is per document — within one document the first error ends it.
`setIn` edits block mappings only; a path through a flow collection or a
sequence throws.

### `parseAll(source, options?)` / `loadAll(source, iterator?, options?)`

Parse every document of a multi-document stream. `parseAll` returns an array; the
`js-yaml`-style `loadAll` optionally accepts a per-document iterator.

### `stringify(value, options?)` / `dump(value, options?)`

Serialize a JavaScript value to a YAML document string.

`options`:

| Option                  | Type                               | Default   | Description                                                        |
| ----------------------- | ---------------------------------- | --------- | ------------------------------------------------------------------ |
| `indent`                | `number`                           | `2`       | Spaces per indentation level (minimum 2).                          |
| `flowLevel`             | `number`                           | `-1`      | Use flow style at or beyond this nesting level (`-1` disables it). |
| `sortKeys`              | `boolean \| ((a, b) => number)`    | `false`   | Sort mapping keys.                                                 |
| `lineWidth`             | `number`                           | `80`      | Preferred wrap width for folded scalars.                           |
| `forceQuotes`           | `boolean`                          | `false`   | Escape non-ASCII characters in double-quoted scalars.              |
| `skipInvalid`           | `boolean`                          | `false`   | Skip `undefined` members instead of emitting `null`.               |
| `directives`            | `boolean`                          | `false`   | Emit a leading `---` document marker.                              |
| `nullStr`               | `string`                           | `"null"`  | String written for `null`.                                         |
| `trueStr`               | `string`                           | `"true"`  | String written for `true`.                                         |
| `falseStr`              | `string`                           | `"false"` | String written for `false`.                                        |
| `singleQuote`           | `boolean`                          | `false`   | Prefer single quotes when a string must be quoted.                 |
| `blockQuote`            | `boolean \| "literal" \| "folded"` | `true`    | How to render multi-line strings.                                  |
| `collectionStyle`       | `"any" \| "block" \| "flow"`       | `"any"`   | Force one collection style.                                        |
| `flowCollectionPadding` | `boolean`                          | `true`    | Pad flow collections: `{ a: 1 }` vs `{a: 1}`.                      |
| `indentSeq`             | `boolean`                          | `true`    | Indent block sequences under their key.                            |
| `keepUndefined`         | `boolean`                          | `false`   | Keep `undefined` values instead of dropping them.                  |
| `replacer`              | `(key, value) => unknown`          | —         | `JSON.stringify`-style value replacer.                             |

> `dump` (the `js-yaml` alias) defaults `singleQuote` to `true`, and `load` returns `undefined` for an empty stream where `parse` returns `null` — each alias follows the package it stands in for.


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

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md) guidelines.

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
