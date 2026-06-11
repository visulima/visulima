<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="prisma-dmmf-transformer" />

</a>

<h3 align="center">A generator for Prisma to generate a valid JSON Schema v7.</h3>

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

## Installation

```sh
npm install @visulima/prisma-dmmf-transformer
```

```sh
yarn add @visulima/prisma-dmmf-transformer
```

```sh
pnpm add @visulima/prisma-dmmf-transformer
```

## Usage

`transformDMMF` takes a Prisma DMMF document. Get one with `@prisma/internals` (the
supported, public way across Prisma 3–6):

```ts
import { getDMMF } from "@prisma/internals";
import { transformDMMF } from "@visulima/prisma-dmmf-transformer";

const datamodel = `
    model User {
        id    Int    @id @default(autoincrement())
        email String @unique
    }
`;

const dmmf = await getDMMF({ datamodel });
const schema = transformDMMF(dmmf);

console.log(schema);
```

You can also pass a DMMF you already have at runtime — e.g. `Prisma.dmmf` from a
generated client:

```ts
import { Prisma } from "@prisma/client";
import { transformDMMF } from "@visulima/prisma-dmmf-transformer";

const schema = transformDMMF(Prisma.dmmf);
```

### Per-field helper

`getJSONSchemaProperty` is exported for callers that want the JSON Schema fragment for a single
DMMF field instead of a whole document. It is curried and returns a `[name, definition, metadata]`
tuple:

```ts
import { getJSONSchemaProperty } from "@visulima/prisma-dmmf-transformer";

const [name, definition] = getJSONSchemaProperty({ enums: [] }, {})(field);
```

### Options

`transformDMMF` accepts an options object as a second argument. Boolean flags accept either a real
`boolean` or the string literals `"true"` / `"false"` (the latter for compatibility with Prisma
generator configuration, which only delivers strings):

| Key                      | Default Value  | Description                                                                                                                                                                          |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| keepRelationScalarFields | `false`        | By default the generated schema outputs only objects for related model records. When enabled, foreign-key scalar fields for related records are kept as well.                       |
| schemaId                 | `undefined`    | Adds an `$id` to the generated schema. All `$ref`s are prefixed with the schema id.                                                                                                 |
| includeRequiredFields    | `false`        | When enabled, all required scalar Prisma fields without a default value are added to the `required` array of their schema definition.                                                |
| persistOriginalType      | `false`        | When enabled, the original Prisma type is emitted under the property key `originalType`.                                                                                            |
| bigIntType               | `"integer"`    | Maps `BigInt` fields to a JSON Schema type. Set to `"string"` to emit `type: "string"` (the common practice for values larger than 2^53; also fixes string defaults self-validating). |
| nullableMode             | `"json-schema"`| `"json-schema"` expresses nullability via type unions / `anyOf`. `"openapi"` emits a single `type` plus `nullable: true` for OpenAPI 3.0 compatibility.                             |
| enrichNativeTypes        | `false`        | When enabled, derives extra constraints from Prisma attributes: `@db.VarChar(n)` → `maxLength`, `@default(uuid())` → `format: "uuid"`, `@default(cuid())` → `pattern`, `Bytes` → `contentEncoding: "base64"`. |

## Examples

### PostgreSQL

This generator converts a prisma schema like this:

```prisma
datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}

model User {
    id                  Int      @id @default(autoincrement())
    // Double Slash Comment: It will NOT show up in JSON schema
    createdAt           DateTime @default(now())
    /// Triple Slash Comment: It will show up in JSON schema [EMAIL]
    email               String   @unique
    weight              Float?
    is18                Boolean?
    name                String?
    number              BigInt   @default(34534535435353)
    favouriteDecimal    Decimal
    bytes               Bytes /// Triple Slash Inline Comment: It will show up in JSON schema [BYTES]
    successorId         Int?     @unique
    successor           User?    @relation("BlogOwnerHistory", fields: [successorId], references: [id])
    predecessor         User?    @relation("BlogOwnerHistory")
    role                Role     @default(USER)
    posts               Post[]
    keywords            String[]
    biography           Json
}

model Post {
    id     Int   @id @default(autoincrement())
    user   User? @relation(fields: [userId], references: [id])
    userId Int?
}

enum Role {
    USER
    ADMIN
}
```

Into:

```json5
{
    $schema: "http://json-schema.org/draft-07/schema#",
    definitions: {
        Post: {
            properties: {
                id: { type: "integer" },
                user: {
                    anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                },
            },
            type: "object",
        },
        User: {
            properties: {
                biography: {
                    type: ["number", "string", "boolean", "object", "array", "null"],
                },
                createdAt: { format: "date-time", type: "string" },
                email: {
                    description: "Triple Slash Comment: Will show up in JSON schema [EMAIL]",
                    type: "string",
                },
                id: { type: "integer" },
                is18: { type: ["boolean", "null"] },
                keywords: { items: { type: "string" }, type: "array" },
                name: { type: ["string", "null"] },
                number: { type: "integer", default: "34534535435353" },
                bytes: {
                    description: "Triple Slash Inline Comment: Will show up in JSON schema [BYTES]",
                    type: "string",
                },
                favouriteDecimal: { type: "number" },
                posts: {
                    items: { $ref: "#/definitions/Post" },
                    type: "array",
                },
                predecessor: {
                    anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                },
                role: { enum: ["USER", "ADMIN"], type: "string", default: "USER" },
                successor: {
                    anyOf: [{ $ref: "#/definitions/User" }, { type: "null" }],
                },
                weight: { type: ["integer", "null"] },
            },
            type: "object",
        },
    },
    properties: {
        post: { $ref: "#/definitions/Post" },
        user: { $ref: "#/definitions/User" },
    },
    type: "object",
}
```

### MongoDB

The generator also takes care of composite types in MongoDB:

```prisma
datasource db {
    provider = "mongodb"
    url      = env("DATABASE_URL")
}

model User {
    id      String @id @default(auto()) @map("_id") @db.ObjectId
    photos  Photo[]
}

type Photo {
    height Int      @default(200)
    width  Int      @default(100)
    url    String
}
```

Output:

```json5
{
    $schema: "http://json-schema.org/draft-07/schema#",
    definitions: {
        User: {
            properties: {
                id: { type: "string" },
                photos: {
                    items: { $ref: "#/definitions/Photo" },
                    type: "array",
                },
            },
            type: "object",
        },
        Photo: {
            properties: {
                height: {
                    type: "integer",
                    default: 200,
                },
                width: {
                    type: "integer",
                    default: 100,
                },
                url: {
                    type: "string",
                },
            },
            type: "object",
        },
    },
    properties: {
        user: { $ref: "#/definitions/User" },
    },
    type: "object",
}
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Valentin Palkovic](https://github.com/valentinpalkovic) and [prisma-json-schema-generator](https://github.com/valentinpalkovic/prisma-json-schema-generator)
- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima prisma-dmmf-transformer is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/prisma-dmmf-transformer?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/prisma-dmmf-transformer?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/prisma-dmmf-transformer
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
