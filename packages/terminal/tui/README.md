<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="tui" />

</a>

<h3 align="center">React-based TUI library powered by a native Rust diff engine, drop-in Ink-compatible API</h3>

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

React-based TUI library powered by a native Rust diff engine with drop-in Ink-compatible API.

Based on [ratatat](https://github.com/geoffmiller/ratatat) by Geoff Miller.

## Features

- **~30x faster** complex rerenders vs Ink (native Rust diff engine via NAPI)
- **Drop-in Ink-compatible** React API (`@visulima/tui`)
- **Framework-agnostic** core runtime (`@visulima/tui/core`)
- **React hooks** for input, focus, clipboard, mouse, and window size
- **Cross-platform** native bindings for macOS, Linux (glibc/musl), and Windows (x64/arm64)
- **Server-side rendering** via `renderToString`
- **Testing utilities** — Framework-agnostic `render()` + mock streams via `@visulima/tui/test`

## Performance

### Core runtime (~700 FPS sustained)

![Stress test (700 FPS)](docs/media/ratatat-stress-test-700fps.png)

### render — @visulima/tui vs Ink

Measured with `vitest bench`. Mount + first paint and rerender comparisons.

| Scenario                                  | @visulima/tui (ops/s) | Ink (ops/s) | Speedup |
| ----------------------------------------- | --------------------: | ----------: | ------: |
| Mount + render (simple)                   |                 1,267 |         793 |   1.60× |
| Mount + render (dashboard, borders+panels)|                   836 |         279 |   3.00× |
| Rerender (simple)                         |                 8,851 |      12,195 |   0.73× |

### Diff engine (native Rust NAPI binding)

| Scenario                       |   ops/sec |
| ------------------------------ | --------: |
| No changes (hot path)          | 8,004,862 |
| All cells dirty (first frame)  | 8,507,637 |
| 5% cells dirty (typical frame) | 8,970,817 |

### Additional module benchmarks

| Module             | Benchmark                     |    ops/sec |
| ------------------ | ----------------------------- | ---------: |
| Color matrix       | Single RGB transform          |  8,577,660 |
| Color matrix       | 256 colors through protanopia |    142,577 |
| Text buffer        | Split small (1 line)          | 14,597,113 |
| Text buffer        | Insert char (100-line doc)    |    767,068 |
| Text buffer        | Delete line (100-line doc)    |    632,014 |
| Shiki highlighting | Warm cache get                |  2,171,663 |
| Shiki highlighting | Cold init                     |      3,655 |
| Markdown lexer     | Small (~50 chars)             |    226,022 |
| Markdown lexer     | Large (~4000 chars)           |      4,180 |
| Diff computation   | createPatch (small)           |    247,287 |
| Diff computation   | diffChars (small)             |    106,410 |

> Run benchmarks yourself: `pnpm --filter @visulima/tui run test:bench`

### Kitchen sink demo

| Layout                              | Focus                             | Graph                             | Live                            |
| ----------------------------------- | --------------------------------- | --------------------------------- | ------------------------------- |
| ![Layout](docs/media/ks-layout.png) | ![Focus](docs/media/ks-focus.png) | ![Graph](docs/media/ks-graph.png) | ![Live](docs/media/ks-live.png) |

| Incremental                                   | UI                          | Static                              | Mouse                             |
| --------------------------------------------- | --------------------------- | ----------------------------------- | --------------------------------- |
| ![Incremental](docs/media/ks-incremental.png) | ![UI](docs/media/ks-ui.png) | ![Static](docs/media/ks-static.png) | ![Mouse](docs/media/ks-mouse.png) |

## Install

```sh
npm install @visulima/tui
```

```sh
yarn add @visulima/tui
```

```sh
pnpm add @visulima/tui
```

## Usage

### Ink-compatible API

The easiest way to get started, especially if you're familiar with [Ink](https://github.com/vadimdemedes/ink):

```tsx
import { render, Box, Text } from "@visulima/tui";

const App = () => (
    <Box flexDirection="column" padding={1}>
        <Text bold>Hello, world!</Text>
        <Text color="green">Powered by a native Rust diff engine</Text>
    </Box>
);

render(<App />);
```

### React API

For more control, use the React entry point directly:

```tsx
import { render } from "@visulima/tui/react";
import { useInput, useApp } from "@visulima/tui/react";

const Counter = () => {
    const [count, setCount] = useState(0);
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === "q") {
            exit();
        }
        if (key.return) {
            setCount((prev) => prev + 1);
        }
    });

    return <Text>Count: {count}</Text>;
};

render(<Counter />);
```

### Core Runtime

The core module provides low-level access to the native terminal engine:

```ts
import { Renderer, TerminalGuard, terminalSize } from "@visulima/tui/core";
```

### Testing

Test your TUI components without a real terminal using mock streams and frame capture:

```tsx
import { render, cleanup } from "@visulima/tui/test";
import { Text } from "@visulima/tui";
import { afterEach, expect, it } from "vitest";

afterEach(() => {
    cleanup();
});

it("renders greeting", () => {
    const { lastFrame } = render(<Text>Hello World</Text>);
    expect(lastFrame()).toBe("Hello World");
});
```

## Related

- [ink](https://github.com/vadimdemedes/ink) - React for interactive command-line apps
- [ratatat](https://github.com/geoffmiller/ratatat) - The project this library is based on

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [Geoff Miller](https://github.com/geoffmiller) - Original [ratatat](https://github.com/geoffmiller/ratatat) library
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima tui is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/tui?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/tui?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/tui
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
