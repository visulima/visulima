<div align="center">
  <h3>Visulima readdir</h3>
  <p>
  Find a file or directory by walking up parent directories.
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
npm install @visulima/readdir
```

```sh
yarn add @visulima/readdir
```

```sh
pnpm add @visulima/readdir
```

## Usage

```typescript
import { walk } from "@visulima/readdir";

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
import { collect } from "@visulima/readdir";

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

The visulima readdir is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/readdir?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/readdir/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/readdir/v/latest "npm"
