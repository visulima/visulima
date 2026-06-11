<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="source-map" />

</a>

<h3 align="center">Provides functionality related to source maps.</h3>

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

const sourceMap = loadSourceMap("your_path/dist/index.js"); // returns a TraceMap | undefined

const traced = originalPositionFor(sourceMap, { column: 13, line: 30 });

console.log(traced);

// {
//     column: 9,
//     line: 15,
//     name: "setState",
//     // For external (.map file) sources the `source` is resolved to a file:// URL,
//     // e.g. "file:///abs/your_path/src/index.js".
//     // For inline maps it is the path recorded in the map, e.g. "src/index.js".
//     source: "file:///abs/your_path/src/index.js",
// }

console.log(sourceContentFor(sourceMap, traced.source));
```

`loadSourceMap` reads a generated JavaScript file from disk, finds its
`//# sourceMappingURL=` comment, loads the referenced map (inline `data:` or a
sibling `.map` file) and returns a `TraceMap`.

### Return / throw semantics

`loadSourceMap` (and its twins) **return `undefined`** when:

- the file references no sourcemap comment,
- the reference is a non-base64 `data:` URI, or
- the reference is a remote (`http(s):`) URL and no `remoteResolver` is supplied.

They **throw** when something that should have worked fails:

- `SourceMapReadError` — the JS file or its `.map` sibling could not be read. The
  original error (including a `code` like `"ENOENT"`) is preserved on `error.cause`.
- `SourceMapParseError` — the map was read but could not be parsed.

```ts
import { loadSourceMap, SourceMapReadError } from "@visulima/source-map";

try {
    loadSourceMap("dist/index.js");
} catch (error) {
    if (error instanceof SourceMapReadError && (error.cause as NodeJS.ErrnoException)?.code === "ENOENT") {
        // the .map sibling is missing
    }
}
```

### Async API

`loadSourceMapAsync` is the promise-based twin (uses `fs/promises`) so server-side
stack remapping does not block the event loop per frame file:

```ts
import { loadSourceMapAsync } from "@visulima/source-map";

const sourceMap = await loadSourceMapAsync("dist/index.js");
```

### In-memory input

If you already hold the transformed code (e.g. inside a bundler plugin or error
overlay), skip the disk round-trip with `loadSourceMapFromSource`:

```ts
import { loadSourceMapFromSource } from "@visulima/source-map";

const sourceMap = loadSourceMapFromSource(generatedCode, "/abs/source/dir");
```

### Remote sourcemaps

Remote (`http(s):`) sourceMappingURLs are skipped by default. Pass a
`remoteResolver` (sync or, for the async API, async) to fetch them:

```ts
const sourceMap = await loadSourceMapAsync("dist/index.js", {
    remoteResolver: async (url) => (await fetch(url)).text(),
});
```

### Re-exported `@jridgewell/trace-mapping` surface

For convenience this package re-exports the trace-mapping consumer API so you can
pin a single Visulima version:

- Functions: `allGeneratedPositionsFor`, `AnyMap`, `decodedMap`, `decodedMappings`,
  `eachMapping`, `encodedMap`, `encodedMappings`, `generatedPositionFor`,
  `isIgnored`, `originalPositionFor`, `presortedDecodedMap`, `sourceContentFor`,
  `traceSegment`.
- Types: `TraceMap`, `SourceMapInput`, `Bias`, `Needle`, `SourceNeedle`,
  `OriginalMapping`, `GeneratedMapping`, `EachMapping`, `Mapping`,
  `EncodedSourceMap`, `DecodedSourceMap`, `SectionedSourceMap`, `SourceMapV3`, and
  the related `*XInput` variants.

For more information about the `TraceMap` see [@jridgewell/trace-mapping](https://github.com/jridgewell/trace-mapping).

## Related

- [@jridgewell/trace-mapping](https://github.com/jridgewell/trace-mapping) - the underlying source-map consumer this package wraps and re-exports.
- [@visulima/error](https://github.com/visulima/visulima/tree/main/packages/error-debugging/error) - stack-trace remapping built on this package.

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

The visulima source-map is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/source-map?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/source-map?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/source-map
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
