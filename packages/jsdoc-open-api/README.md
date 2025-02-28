<div align="center">
  <h3>Visulima jsdoc-open-api</h3>
  <p>

Visulima jsdoc-open-api parser and generator is a forked version of [openapi-comment-parser](https://github.com/bee-travels/openapi-comment-parser) and [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc) its built on top of [swagger](https://swagger.io/) and [JSDoc](https://jsdoc.app/), for speed and minimal runtime overhead.

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

## Installation

```sh
npm install @visulima/jsdoc-open-api
```

```sh
yarn add @visulima/jsdoc-open-api
```

```sh
pnpm add @visulima/jsdoc-open-api
```

## Usage

Choose the syntax you want to use for your OpenAPI definitions:

![choose the syntax](./__assets__/swagger-difference.png)

### CLI:

#### To use the CLI, you need to install this missing packages:

```sh
npm install cli-progress commander
```

```sh
yarn add cli-progress commander
```

```sh
pnpm add cli-progress commander
```

#### Than you can use the CLI like this:

```bash
# This generate the .openapirc.js config file, this command is only needed on the first run
jsdoc-open-api init

# This will generate the swagger.json file
jsdoc-open-api generate src/
```

### As Next.js webpack plugin:

#### with-open-api.js

```js
const path = require("node:path");
const fs = require("node:fs");
const { SwaggerCompilerPlugin } = require("@visulima/jsdoc-open-api");

/**
 * @param definition {import('@visulima/jsdoc-open-api').SwaggerDefinition}
 * @param sources {string[]}
 * @param verbose {boolean}
 * @param output {string}
 *
 * @returns {function(*): *&{webpack: function(Configuration, *): (Configuration)}}
 */
const withOpenApi =
    ({ definition, sources, verbose, output = "swagger/swagger.json" }) =>
    (nextConfig) => {
        return {
            ...nextConfig,
            webpack: (config, options) => {
                if (!options.isServer) {
                    return config;
                }

                if (output.startsWith("/")) {
                    output = output.slice(1);
                }

                if (!output.endsWith(".json")) {
                    throw new Error("The output path must end with .json");
                }

                // eslint-disable-next-line no-param-reassign
                config = {
                    ...config,
                    plugins: [
                        // @ts-ignore
                        ...config.plugins,
                        new SwaggerCompilerPlugin(
                            `${options.dir}/${output}`,
                            sources.map((source) => {
                                const combinedPath = path.join(options.dir, source.replace("./", ""));

                                // Check if the path is a directory
                                fs.lstatSync(combinedPath).isDirectory();

                                return combinedPath;
                            }),
                            definition,
                            { verbose },
                        ),
                    ],
                };

                if (typeof nextConfig.webpack === "function") {
                    return nextConfig.webpack(config, options);
                }

                return config;
            },
        };
    };

module.exports = withOpenApi;
```

#### Next.config.js

```js
const withOpenApi = require("./with-open-api");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3001",
    },
};

module.exports = withOpenApi({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "My API",
            version: "1.0.0",
        },
    },
    sources: ["pages/api"],
    verbose: false, // default is false
})(nextConfig);
```

## OpenApi YAML syntax

The library will take the contents of @openapi (or @swagger):

```ts
/**
 * @openapi
 * /:
 *   get:
 *     description: Welcome to swagger-jsdoc!
 *     responses:
 *       200:
 *         description: Returns a mysterious string.
 */
```

## OpenApi short syntax

### Basic structure

You can write OpenAPI definitions in JSDoc comments or YAML files.
In this guide, we use only JSDoc comments examples. However, YAML files work equally as well.

Each comment defines individual endpoints (paths) in your API, and the HTTP methods (operations) supported by these endpoints.
For example, `GET /users` can be described as:

```js
/**
 * GET /users
 * @summary Returns a list of users.
 * @description Optional extended description in CommonMark or HTML.
 * @response 200 - A JSON array of user names
 * @responseContent {string[]} 200.application/json
 */
```

#### Parameters

Operations can have parameters passed via URL path (`/users/{userId}`), query string (`/users?role=admin`),
headers (`X-CustomHeader: Value`) or cookies (`Cookie: debug=0`).
You can define the parameter data types, format, whether they are required or optional, and other details:

```js
/**
 * GET /users/{userId}
 * @summary Returns a user by ID.
 * @pathParam {int64} userId - Parameter description in CommonMark or HTML.
 * @response 200 - OK
 */
```

For more information, see [Describing Parameters](/docs/short/describing-parameters.md).

#### Request body

If an operation sends a request body, use the `bodyContent` keyword to describe the body content and media type.
Use `bodyRequired` to indicate that a request body is required.

```js
/**
 * POST /users
 * @summary Creates a user.
 * @bodyContent {User} application/json
 * @bodyRequired
 * @response 201 - Created
 */
```

For more information, see [Describing Request Body](/docs/short/describing-request-body.md).

#### Responses

For each operation, you can define possible status codes, such as 200 OK or 404 Not Found, and the response body content.
You can also provide example responses for different content types:

```js
/**
 * GET /users/{userId}
 * @summary Returns a user by ID.
 * @pathParam {int64} userId - The ID of the user to return.
 * @response 200 - A user object.
 * @responseContent {User} 200.application/json
 * @response 400 - The specified user ID is invalid (not a number).
 * @response 404 - A user with the specified ID was not found.
 * @response default - Unexpected error
 */
```

For more information, see [Describing Responses](/docs/short/describing-responses.md).

#### Input and output models

You can create global `components/schemas` section lets you define common data structures used in your API.
They can be referenced by name whenever a schema is required – in parameters, request bodies, and response bodies.
For example, this JSON object:

```json
{
    "id": 4,
    "name": "Arthur Dent"
}
```

Can be represented as:

```yaml
components:
    schemas:
        User:
            properties:
                id:
                    type: integer
                name:
                    type: string
            # Both properties are required
            required:
                - id
                - name
```

And then referenced in the request body schema and response body schema as follows:

```js
/**
 * GET /users/{userId}
 * @summary Returns a user by ID.
 * @pathParam {integer} userId
 * @response 200 - OK
 * @responseContent {User} 200.application/json
 */

/**
 * POST /users
 * @summary Creates a new user.
 * @bodyContent {User} application/json
 * @bodyRequired
 * @response 201 - Created
 */
```

#### Authentication

The `securitySchemes` and `security` keywords are used to describe the authentication methods used in your API.

```yaml
components:
    securitySchemes:
        BasicAuth:
            type: http
            scheme: basic
```

```js
/**
 * GET /users
 * @security BasicAuth
 */
```

Supported authentication methods are:

- HTTP authentication: Basic, Bearer, and so on.
- API key as a header or query parameter or in cookies
- OAuth 2
- OpenID Connect Discovery

For more information, see [Authentication](/docs/short/authentication.md).

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/jsdoc-open-api?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/jsdoc-open-api/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/jsdoc-open-api/v/latest "npm"
