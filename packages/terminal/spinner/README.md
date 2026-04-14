<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="spinner" />

</a>

<h3 align="center">Minimal terminal spinners</h3>

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
npm install @visulima/spinner
```

```sh
yarn add @visulima/spinner
```

```sh
pnpm add @visulima/spinner
```

## Usage

### Basic Example

```ts
import { Spinner } from "@visulima/spinner";

const spinner = new Spinner({
    spinner: "dots",
    text: "Loading...",
});

spinner.start();

// Simulate work
await new Promise((resolve) => setTimeout(resolve, 3000));

spinner.succeed("Done!");
```

### Using Different Animations

```ts
import { Spinner, getSpinner } from "@visulima/spinner";

// Using a named spinner
const spinner = new Spinner({
    spinner: "line",
    text: "Processing",
});

spinner.start();

// Later...
spinner.succeed("Completed");

// Or use a random spinner
import { getRandomSpinner } from "@visulima/spinner";

const randomSpinner = getRandomSpinner();
```

### Status Methods

```ts
const spinner = new Spinner({ text: "Loading..." });

spinner.start();

// Update text
spinner.setText("Still loading...");

// Update prefix (e.g., for logging context)
spinner.setPrefixText("[INFO]");

// Finish with success
spinner.succeed("Task completed!");

// Or fail
spinner.fail("Task failed!");

// Or warn
spinner.warn("Task completed with warnings");
```

### Method Chaining

The API supports fluent chaining:

```ts
new Spinner().setPrefixText("[TASK]").setText("Loading...").start();

// Later...
spinner.succeed("Done!");
```

### Available Spinners

Some popular spinners include:

- `dots`, `dots2`, `dots3` — Braille dots
- `line`, `line2` — Simple line spinners
- `pipe` — Box drawing spinners
- `star`, `star2` — Star animations
- `hamburger` — Hamburger menu
- `growVertical`, `growHorizontal` — Growing bars
- `bouncingBar`, `bouncingBall` — Bouncing animations
- `smiley`, `monkey`, `hearts` — Emoji spinners
- `clock`, `earth`, `moon` — Themed spinners
- And 60+ more!

### Get All Available Spinners

```ts
import { getSpinnerNames, getSpinner } from "@visulima/spinner";

// Get list of all spinner names
const names = getSpinnerNames();
console.log(names); // ['dots', 'dots2', 'line', ...]

// Get a specific spinner by name
const dotSpinner = getSpinner("dots");
console.log(dotSpinner); // { interval: 80, frames: [...] }

// Get a random spinner
import { getRandomSpinner } from "@visulima/spinner";
const random = getRandomSpinner();
```

### Custom Symbols

```ts
new Spinner({
    text: "Processing",
    successSymbol: "✔",
    failureSymbol: "✘",
    warningSymbol: "⚠",
    stream: process.stdout, // optional, defaults to stdout
}).start();
```

## Related

For detailed documentation on all spinners, API reference, and usage patterns:

- **Online Docs:** [visulima.com/packages/spinner](https://visulima.com/packages/spinner)
- **Local Docs:** [./docs](./docs)

Check out the full documentation for 101+ spinner animations, usage examples, and advanced patterns.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

Spinner animations inspired by [cli-spinners](https://github.com/sindresorhus/cli-spinners) by Sindre Sorhus.

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima spinner is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/spinner?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/spinner?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/spinner
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
