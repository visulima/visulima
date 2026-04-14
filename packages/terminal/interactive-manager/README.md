<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="interactive-manager" />

</a>

<h3 align="center">Interactive terminal output manager for spinners, progress bars, and dynamic updates</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]

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
npm install @visulima/interactive-manager
```

```sh
yarn add @visulima/interactive-manager
```

```sh
pnpm add @visulima/interactive-manager
```

## Usage

```typescript
import { InteractiveManager, InteractiveStreamHook } from "@visulima/interactive-manager";

const stdoutHook = new InteractiveStreamHook(process.stdout);
const stderrHook = new InteractiveStreamHook(process.stderr);
const manager = new InteractiveManager(stdoutHook, stderrHook);

// Start interactive mode
manager.hook();

// Update output dynamically
manager.update("stdout", ["Processing...", "50% complete"]);

// End interactive mode
manager.unhook();
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima interactive-manager is open-sourced software licensed under the [MIT][license]

[license-badge]: https://img.shields.io/npm/l/@visulima/interactive-manager?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/interactive-manager?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/interactive-manager
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
