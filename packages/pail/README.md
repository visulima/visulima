<div align="center">
  <h3>Visulima Pail</h3>
  <p>
  Highly configurable Logger for Node.js and Browser, built on top of

  [@visulima/fmt](https://github.com/visulima/visulima/tree/main/packages/fmt),
  [string-length](),
  [sisteransi](),
  [figures](),
  [strip-ansi](),
  [terminal-size]() and
  [wrap-ansi]()
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

## Why Pail?

- Easy to use
- Hackable to the core
- Integrated timers
- Custom pluggable processors
- Custom pluggable reporters
- TypeScript support
- Interactive and regular modes
- Secrets & sensitive information filtering
- Filename, date and timestamp support
- Scoped loggers and timers
- Scaled logging levels mechanism
- String interpolation support
- Object and error interpolation
- Stack trace and pretty errors
- Simple and minimal syntax
- Spam prevention by throttling logs
- Browser support
- Redirect console and stdout/stderr to pail and easily restore redirect.
- `Pretty` or `JSON` output
- CJS & ESM with tree shaking support
- Supports circular structures
- Fast and powerful

## Install

```sh
npm install @visulima/pail
```

```sh
yarn add @visulima/pail
```

```sh
pnpm add @visulima/pail
```

## Usage

```typescript
import { walk } from "@visulima/pail";

const filesAndFolders: string[] = [];

for await (const index of walk(`${__dirname}/fixtures`, {})) {
    filesAndFolders.push(index.path);
}

console.log(filesAndFolders);
```

These helpers can be used to find specific files in all Next.js `['src', 'app', 'integrations']` folders.

This example will find all files in the sub-folder `commands` and add it to the build process.

```typescript
import type { NextConfig } from "next";
import { collect } from "@visulima/pail";

const config: NextConfig = {
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        if (isServer) {
            return {
                ...config,
                entry() {
                    return config.entry().then(async (entry) => {
                        const allCommands = await collect("commands", __dirname, {
                            includeDirs: false,
                        });
                        const commands: { [key: string]: string } = {};

                        allCommands.forEach((commandPath) => {
                            commands[commandPath.replace(/\.[^./]+$/, "").slice(1)] = `.${commandPath}`;
                        });

                        return {
                            ...entry,
                            ...commands,
                        };
                    });
                },
            };
        }

        return config;
    },
};
module.exports = config;
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima pail is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/pail?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/pail/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/pail/v/latest "npm"
