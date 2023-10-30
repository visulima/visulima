<div align="center">
  <h3>Visulima cerebro</h3>
  <p>
  cerebro is a delightful toolkit for building Node-based command-line interfaces (CLIs).
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

## Why to use cerebro

You want to use cerebro if:

* You need to build a CLI app
* You want to have powerful tools at your fingertips
* And you don’t want to give up flexibility at the same time


## Install

```sh
npm install @visulima/cerebro
```

```sh
yarn add @visulima/cerebro
```

```sh
pnpm add @visulima/cerebro
```

## Usage

```ts
import Cli from "@visulima/cerebro";

(async () => {
    try {
        // Create a CLI runtime
        const cli = new Cli("cerebro");

        // Your command
        cli.addCommand({
            name: "main:colors",
            description: "Output colors", // This is used in the help output
            execute: ({ logger }) => {
                logger.info("Colors command");
            },
        });

        await cli.run();
    } catch (error) {
        // Abort via CTRL-C
        if (!error) {
            console.log("Goodbye ✌️");
        } else {
            // Throw error
            throw error;
        }
    }
})();
```

Now you can run your CLI with `node index.js` and you should see the following output:

![Cli Output](./__assets__/cli_output.png)

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

The visulima package is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/cerebro?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/cerebro/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/cerebro/v/latest "npm"
