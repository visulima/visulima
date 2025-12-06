<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="is-ansi-color-supported" />

</a>

<h3 align="center">Detect whether a terminal or browser supports ansi colors.</h3>

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
npm install @visulima/is-ansi-color-supported
```

```sh
yarn add @visulima/is-ansi-color-supported
```

```sh
pnpm add @visulima/is-ansi-color-supported
```

## Usage

```typescript
import { isStdoutColorSupported, isStderrColorSupported } from "@visulima/is-ansi-color-supported";

/**
 * Levels:
 * - `0` - All colors disabled.
 * - `1` - Basic 16 colors support.
 * - `2` - ANSI 256 colors support.
 * - `3` - Truecolor 16 million colors support.
 */
console.log(isStdoutColorSupported()); // 3

console.log(isStderrColorSupported()); // 3
```

## Color support

Ansis automatically detects the supported color space:

- TrueColor
- ANSI 256 colors
- ANSI 16 colors
- black & white (no color)

There is no standard way to detect which color space is supported.
The most common way to detect color support is to check the `TERM` and `COLORTERM` environment variables.
CI systems can be detected by checking for the existence of the `CI` and other specifically environment variables.
Combine that with the knowledge about which operating system the program is running on, and we have a decent enough way to detect colors.

| Terminal                         | ANSI 16<br>colors | ANSI 256<br>colors | True<br>Color |  env.<br>TERM  | env.<br>COLORTERM | Specifically ENV variables             |
| :------------------------------- | ----------------- | :----------------- | :------------ | :------------: | :---------------: | :------------------------------------- |
| Azure CI                         | ✅                | ❌                 | ❌            |      dumb      |                   | TF_BUILD<br>AGENT_NAME                 |
| GitHub CI                        | ✅                | ✅                 | ✅            |      dumb      |                   | CI<br>GITHUB_ACTIONS                   |
| GitTea CI                        | ✅                | ✅                 | ✅            |      dumb      |                   | CI<br>GITEA_ACTIONS                    |
| GitLab CI                        | ✅                | ❌                 | ❌            |      dumb      |                   | CI<br>GITLAB_CI                        |
| Travis CI                        | ✅                | ❌                 | ❌            |      dumb      |                   | TRAVIS                                 |
| PM2<br>not isTTY                 | ✅[^1]            | ✅[^1]             | ✅[^1]        |      dumb      |                   | PM2_HOME<br>pm_id                      |
| JetBrains TeamCity<br>>=2020.1.1 | ✅                | ✅                 | ❌            |                |                   | TEAMCITY_VERSION                       |
| JetBrains IDEA                   | ✅                | ✅                 | ✅            | xterm-256color |                   | TERMINAL_EMULATOR='JetBrains-JediTerm' |
| VS Code                          | ✅                | ✅                 | ✅            | xterm-256color |     truecolor     |                                        |
| Windows<br>Terminal              | ✅                | ✅                 | ✅[^2]        |                |                   |                                        |
| Windows<br>PowerShell            | ✅                | ✅                 | ✅[^2]        |                |                   |                                        |
| macOS Terminal                   | ✅                | ✅                 | ❌            | xterm-256color |                   |                                        |
| iTerm                            | ✅                | ✅                 | ✅            | xterm-256color |     truecolor     |                                        |
| Terminal emulator Kitty          | ✅                | ✅                 | ✅            |  xterm-kitty   |                   |                                        |

[^1]: Colors supported depends on actual terminal.

[^2]: The Windows terminal supports true color since Windows 10 revision 14931 (2016-09-21).

See also:

- [Truecolor Support in Output Devices](https://github.com/termstandard/colors#truecolor-support-in-output-devices).
- [So you want to render colors in your terminal](https://marvinh.dev/blog/terminal-colors/).

## Environment variables

To force disable or enable colored output use environment variables `NO_COLOR` and `FORCE_COLOR`.

The `NO_COLOR` variable should be presents with any not empty value.
The value is not important, e.g., `NO_COLOR=1` `NO_COLOR=true` disable colors.
See standard description by [NO_COLOR](https://no-color.org/).

The `FORCE_COLOR` variable should be presents with one of values:\
`FORCE_COLOR=0` force disable colors\
`FORCE_COLOR=1` force enable colors

## CLI arguments

Use arguments `--no-color` or `--color=false` to disable colors and `--color` to enable ones.

For example, an executable script _colors.js_:

```js
#!/usr/bin/env node
import { isStdoutColorSupported } from "@visulima/is-ansi-color-supported";

console.log(isStdoutColorSupported());
```

Execute the script in a terminal:

```
$ ./colors.js                        # colored output in terminal
$ ./colors.js --no-color             # non colored output in terminal
$ ./colors.js --color=false          # non colored output in terminal

$ ./colors.js > log.txt              # output in file without ANSI codes
$ ./colors.js --color > log.txt      # output in file with ANSI codes
$ ./colors.js --color=true > log.txt # output in file with ANSI codes
```

> **Warning**
>
> The command line arguments have a higher priority than environment variable.

## Info

For situations where using `--color` is not possible, use the environment variable `FORCE_COLOR=1` (level 1), `FORCE_COLOR=2` (level 2), or `FORCE_COLOR=3` (level 3) to forcefully enable color, or `FORCE_COLOR=0` to forcefully disable. The use of `FORCE_COLOR` overrides all other color support checks.

Explicit 256/Truecolor mode can be enabled using the `--color=256` and `--color=16m` flags, respectively.

## Related

- [supports-color](https://github.com/chalk/supports-color) - Detect whether a terminal supports color
- [supports-color-cli](https://github.com/chalk/supports-color-cli) - CLI for this module

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima is-ansi-color-supported is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/is-ansi-color-supported?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/is-ansi-color-supported?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/is-ansi-color-supported
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
