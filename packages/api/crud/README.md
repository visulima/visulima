<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="crud" />

</a>

<h3 align="center">visulima crud</h3>

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

```sh
npm install @visulima/crud prisma @prisma/client
```

```sh
yarn add @visulima/crud prisma @prisma/client
```

```sh
pnpm add @visulima/crud prisma @prisma/client
```

## Usage

To use the `@visulima/crud` package, you need to have a [Prisma](https://www.prisma.io/) schema.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

export default async (request, response) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
};
```

To use it with `api-platform connect` you need to install the `@visulima/api-platform` package.

```ts
// pages/api/[...crud].ts

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { createNodeRouter } from "@visulima/api-platform";
import { PrismaAdapter } from "@visulima/crud";
import { nodeHandler } from "@visulima/crud/next";
import type { User, Post, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma-client";

const prismaAdapter = new PrismaAdapter<User | Post, Prisma.ModelName>({
    prismaClient: prisma,
});

const router = createNodeRouter<NextApiRequest, NextApiResponse>().all(async (request, response) => {
    const handler = await nodeHandler<User | Post, any, NextApiRequest, NextApiResponse, Prisma.ModelName>(prismaAdapter);

    await handler(request, response);
});

export default router.handler();
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

The visulima crud is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/crud?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/crud?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/crud
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
