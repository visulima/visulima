<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="api-platform" />

</a>

<h3 align="center">Visulima API platform is a set of tools to build and consume web APIs</h3>

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

## Installation

### Npm

```sh
npm install @visulima/api-platform zod
```

#### Installation for Next.js

```sh
npm install @visulima/api-platform zod @visulima/fs
```

### Yarn

```sh
yarn add @visulima/api-platform zod
```

#### Installation for Next.js

```sh
yarn add @visulima/api-platform zod @visulima/fs
```

### Pnpm

```sh
pnpm add @visulima/api-platform zod
```

#### Installation for Next.js

```sh
pnpm add @visulima/api-platform zod @visulima/fs
```

### To use the swagger-ui or the redoc-ui you need to install the following packages:

```sh
npm install swagger-ui-react
```

To have a styled version of the swagger-ui you need to add the following css to your project:

```ts
import "swagger-ui-react/swagger-ui.css";
```

> Note: For `next.js` you can add it to your `_app.tsx` file

Or

```sh
npm install redoc
```

## Usage

### CLI:

#### To use the CLI, you need to install this missing packages:

```sh
npm install cli-progress commander chalk
```

```sh
yarn add cli-progress commander chalk
```

```sh
pnpm add cli-progress commander chalk
```

#### Then you can use the CLI like this:

```bash
// Shows the help with all available commands

pnpm api-platform --help
```

### connect

This package has an extended version of the `@visulima/connect` package.
That means you can use all the features of the `@visulima/connect` package, in addition to the features of this package.

```ts
// pages/api/hello.js
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import cors from "cors";

// Default Req and Res are IncomingMessage and ServerResponse
// You may want to pass in NextApiRequest and NextApiResponse
const router = createNodeRouter<NextApiRequest, NextApiResponse>();

router.get((req, res) => {
    res.send("Hello world");
});

export default router.nodeHandler();
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima api-platform is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/api-platform?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/api-platform?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/api-platform
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
