<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="jsdoc-open-api" />

</a>

<h3 align="center">Generates swagger doc based on JSDoc.</h3>

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

- **Automatic Generation:** Creates OpenAPI specs from JSDoc comments.
- **Multiple Syntaxes:** Supports standard OpenAPI YAML/JSON within comments and a concise short syntax.
- **CLI Tool:** Provides a command-line interface for easy generation.
- **Programmatic API:** Offers a JavaScript API for integration into build processes.
- **Framework Integration:** Includes helpers like a Webpack plugin (useful for Next.js).
- **Performance:** Focused on speed and low overhead.

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

## Usage Overview

You can use `@visulima/jsdoc-open-api` in several ways:

1.  **Via Command Line (CLI):** Quick generation for simple use cases or manual runs.
2.  **Programmatically:** Integrate generation into your custom scripts or build tools.
3.  **With Webpack (e.g., Next.js):** Automate generation during your build process.

Choose the syntax you prefer for defining OpenAPI details within your JSDoc comments:

![choose the syntax](./__assets__/swagger-difference.png)

---

## Usage with CLI

The Command Line Interface (CLI) provides a straightforward way to generate your OpenAPI specification.

### Running via Package Managers

Instead of installing the CLI globally or relying on optional dependencies, you can run the installed binary directly using your package manager:

```bash
# With npx (comes with npm)
npx jsdoc-open-api generate src/
# Or explicitly using the package name:
npx @visulima/jsdoc-open-api generate src/

# With pnpm
pnpm exec jsdoc-open-api generate src/

# With Yarn 1.x
yarn run jsdoc-open-api generate src/

# With Yarn Berry (2+)
yarn jsdoc-open-api generate src/
```

This is often the recommended way to use package binaries within a project.

### Optional Dependencies

The CLI relies on `commander` and `cli-progress`. These are listed as `optionalDependencies`. Depending on your package manager (npm/yarn/pnpm) and configuration, you _might_ need to install them manually if they weren't installed automatically:

```sh
# If needed:
npm install commander cli-progress
# or
yarn add commander cli-progress
# or
pnpm add commander cli-progress
```

### Commands

#### `init`

Initializes the project by creating a `.openapirc.js` configuration file. This is typically run once per project.

```bash
jsdoc-open-api init
```

#### `generate`

Parses your source files based on the configuration (or command-line arguments) and generates the OpenAPI specification file.

```bash
# Generate using defaults defined in .openapirc.js (if it exists)
jsdoc-open-api generate

# Specify input path(s) directly
jsdoc-open-api generate src/routes/**/*.js src/controllers/

# Specify output file
jsdoc-open-api generate -o ./public/swagger.json src/

# Emit YAML instead of JSON (format is inferred from the extension)
jsdoc-open-api generate -o ./openapi.yaml src/

# Write the spec to stdout (useful for piping into other tools)
jsdoc-open-api generate -o - src/

# Seed info/servers/components from a standalone base-definition file
jsdoc-open-api generate -d ./definition.yaml src/

# Re-generate automatically whenever a watched path changes
jsdoc-open-api generate --watch src/

# Use verbose output
jsdoc-open-api generate -v src/

# Use very verbose output for debugging
jsdoc-open-api generate --very-verbose src/
```

### `generate` Command Options:

```bash
jsdoc-open-api generate [options] [path ...]
```

- `[path ...]` : Paths to files or directories to parse (optional, uses configuration if not provided).
- `-c, --config [.openapirc.js]` : Specify the configuration file path. Defaults to `.openapirc.js`.
- `-d, --definition [definition.yaml]` : Base OpenAPI definition file (YAML or JSON) used to seed `info`/`servers`/`components`. The config's `swaggerDefinition` takes precedence over the file.
- `-o, --output [swaggerSpec.json]` : Specify the output file for the OpenAPI specification. Defaults to `swagger.json`. Use a `.yaml`/`.yml` extension to emit YAML, or `-` to write to stdout.
- `-w, --watch` : Re-generate the specification whenever one of the watched paths changes (press Ctrl+C to exit).
- `-v, --verbose` : Enable verbose output during generation.
- `--very-verbose` : Enable _very_ verbose output for detailed debugging.

---

## Programmatic Usage

You can assemble a specification directly in your Node.js scripts. The package
exposes the building blocks rather than a single all-in-one function:

- `SpecBuilder` — merges per-file results into a single OpenAPI document.
- `parseFile` / `parseFileMulti` — read a file and run one (or several) comment translators over it. `parseFileMulti` reads + parses the comments only once when you need both dialects.
- `jsDocumentCommentsToOpenApi` / `swaggerJsDocumentCommentsToOpenApi` — the two JSDoc dialect translators.
- `validate` — validate the assembled document with `@apidevtools/swagger-parser` (the same check the CLI runs).
- `loadDefinition` — load a standalone base-definition file (YAML or JSON).

```javascript
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpecBuilder, parseFileMulti, jsDocumentCommentsToOpenApi, swaggerJsDocumentCommentsToOpenApi, validate } from "@visulima/jsdoc-open-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const spec = new SpecBuilder({
    openapi: "3.0.0",
    info: {
        title: "My Programmatic API",
        version: "1.0.0",
        description: "API documentation generated programmatically",
    },
});

const translators = [jsDocumentCommentsToOpenApi, swaggerJsDocumentCommentsToOpenApi];

// Feed each source file through both dialects (single read + single comment parse).
for (const file of [path.join(__dirname, "src/routes/users.js")]) {
    spec.addData(parseFileMulti(file, translators).map((entry) => entry.spec));
}

// Re-use the exact validation the CLI performs.
await validate(structuredClone(spec));

console.log(JSON.stringify(spec, null, 2));
```

---

## Usage with Next.js (via Webpack Plugin)

The package includes a Webpack plugin for seamless integration with frameworks like Next.js.

### `with-open-api.js` Helper

Create a helper file (e.g., `with-open-api.js`) in your project root:

```js
const path = require("node:path");
const fs = require("node:fs");
// Adjust the import path based on your project structure if needed
const { SwaggerCompilerPlugin } = require("@visulima/jsdoc-open-api");

/**
 * @param {object} options
 * @param {import('@visulima/jsdoc-open-api').SwaggerDefinition} options.definition - Base OpenAPI definition.
 * @param {string[]} options.sources - Glob patterns for source files relative to project root.
 * @param {boolean} [options.verbose=false] - Enable verbose logging.
 * @param {string} [options.output='swagger/swagger.json'] - Output path relative to project root.
 *
 * @returns {function(import('next').NextConfig): import('next').NextConfig & {webpack: function(import('webpack').Configuration, object): import('webpack').Configuration}}
 */
const withOpenApi =
    ({ definition, sources, verbose, output = "swagger/swagger.json" }) =>
    (nextConfig = {}) => {
        return {
            ...nextConfig,
            webpack: (config, options) => {
                // Run generation only on the server build in Next.js
                if (!options.isServer) {
                    return config;
                }

                let outputPath = output;
                if (outputPath.startsWith("/")) {
                    outputPath = outputPath.slice(1);
                }

                if (!outputPath.endsWith(".json")) {
                    // Consider allowing YAML output as well?
                    throw new Error("The output path must end with .json");
                }

                const absoluteOutputPath = path.join(options.dir, outputPath);
                const absoluteSourcePaths = sources.map((source) => path.join(options.dir, source.replace(/^\.\//, ""))); // Normalize paths

                // Add the SwaggerCompilerPlugin to webpack plugins
                config.plugins = config.plugins || [];
                config.plugins.push(new SwaggerCompilerPlugin(absoluteOutputPath, absoluteSourcePaths, definition, { verbose }));

                // Call the original webpack config function if it exists
                if (typeof nextConfig.webpack === "function") {
                    return nextConfig.webpack(config, options);
                }

                return config;
            },
        };
    };

module.exports = withOpenApi;
```

### `next.config.js`

Wrap your Next.js configuration with the helper:

```js
const withOpenApi = require("./with-open-api"); // Adjust path if necessary

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        NEXT_PUBLIC_APP_ORIGIN: process.env.VERCEL_URL || "http://localhost:3000", // Default to 3000?
    },
    // ... other Next.js config
};

module.exports = withOpenApi({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "My Next.js API",
            version: "1.0.0",
        },
        // servers: [{ url: '/api' }], // Optional: Define servers
    },
    // Paths relative to your project root
    sources: ["pages/api/**/*.js", "src/controllers/**/*.js"],
    output: "public/swagger.json", // Output to the public folder
    verbose: false,
})(nextConfig);
```

Now, the OpenAPI specification (`public/swagger.json`) will be generated automatically during your Next.js build.

---

## Configuration (`.openapirc.js`)

When using the CLI `generate` command without specifying paths or using the `init` command, `@visulima/jsdoc-open-api` looks for a `.openapirc.js` file in your project root. This file should export an options object similar to the one used in Programmatic Usage:

```javascript
// .openapirc.js
module.exports = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API from Config",
            version: "2.0.0",
        },
        // ... other base definition properties
    },
    // Array of glob patterns for your source files
    sources: ["src/**/*.js", "routes/**/*.js"],
    output: "docs/swagger.json", // Default output file path
    verbose: false, // Default verbosity
};
```

---

## Defining OpenAPI Specs in JSDoc

You have two main ways to define your API specifications within JSDoc comments:

### 1. Standard OpenAPI (YAML/JSON) Syntax

Embed standard OpenAPI 3.0 YAML or JSON directly within `@openapi` or `@swagger` blocks. The library extracts and merges these definitions.

```javascript
/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           format: int64
 *           example: 10
 *         username:
 *           type: string
 *           example: 'theUser'
 *         firstName:
 *           type: string
 *           example: 'John'
 *         lastName:
 *           type: string
 *           example: 'Doe'
 *       required:
 *         - id
 *         - username
 */

/**
 * @openapi
 * /users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user.
 *     tags:
 *       - Users
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user to retrieve.
 *         schema:
 *           type: integer
 *           format: int64
 *     responses:
 *       '200':
 *         description: Successful response with user data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User' # Reference the schema defined above
 *       '404':
 *         description: User not found.
 */
function getUserById(userId) {
    // Implementation...
}
```

### 2. OpenApi Short Syntax

Use custom JSDoc tags for a more concise way to define paths, operations, parameters, and responses.

#### Basic Structure

Define the HTTP method and path, followed by tags like `@summary`, `@description`, `@response`, etc.

```javascript
/**
 * GET /users
 * @summary Returns a list of users.
 * @description Optional extended description in CommonMark or HTML.
 * @tags Users
 * @response 200 - A JSON array of user names
 * @responseContent {string[]} 200.application/json
 */
function listUsers() {
    // Implementation...
}
```

#### Parameters

Use `@pathParam`, `@queryParam`, `@headerParam`, `@cookieParam` to define parameters.

```javascript
/**
 * GET /users/{userId}
 * @summary Returns a user by ID.
 * @tags Users
 * @pathParam {integer | int64} userId - The ID of the user to retrieve. {required}
 * @queryParam {string} [role] - Filter users by role (optional). Possible values: 'admin', 'member'.
 * @response 200 - OK
 * @responseContent {User} 200.application/json - A user object (assuming 'User' schema is defined elsewhere).
 */
function getUser(userId, role) {
    // Implementation...
}
```

#### Request Body

Use `@bodyContent` to describe the request body and `@bodyRequired` if it's mandatory.

```javascript
/**
 * POST /users
 * @summary Creates a new user.
 * @tags Users
 * @bodyContent {User} application/json - User object to create.
 * @bodyRequired
 * @response 201 - User created successfully.
 * @responseContent {User} 201.application/json - The created user object.
 */
function createUser(userData) {
    // Implementation...
}
```

#### Responses

Define responses using `@response` for the status code and description, and `@responseContent` for the body schema.

```javascript
/**
 * GET /products/{productId}
 * @summary Get product details.
 * @tags Products
 * @pathParam {string} productId - ID of the product.
 * @response 200 - Product details.
 * @responseContent {ProductSchema} 200.application/json
 * @response 404 - Product not found.
 * @response default - Unexpected error.
 */
function getProduct(productId) {
    // Implementation...
}
```

#### Input and Output Models (Schema References)

Reference schemas defined globally (usually using the standard `@openapi` syntax in a central file or comment block) within your short syntax using type definitions like `{User}` or `{ProductSchema}`.

```javascript
// Assuming 'User' schema is defined in components/schemas

/**
 * PUT /users/{userId}
 * @summary Update an existing user.
 * @tags Users
 * @pathParam {integer} userId - ID of the user to update.
 * @bodyContent {User} application/json - Updated user data.
 * @bodyRequired
 * @response 200 - User updated successfully.
 * @responseContent {User} 200.application/json
 * @response 404 - User not found.
 */
function updateUser(userId, userData) {
    // Implementation...
}
```

#### Authentication

Reference `securitySchemes` defined globally (using standard `@openapi` syntax) with the `@security` tag.

```javascript
// Assuming 'BasicAuth' is defined in components/securitySchemes

/**
 * GET /admin/settings
 * @summary Get administrative settings (requires auth).
 * @tags Admin
 * @security BasicAuth
 * @response 200 - Admin settings object.
 */
function getAdminSettings() {
    // Implementation...
}
```

For detailed information on the short syntax tags and possibilities, please refer to the documentation (link to be added if available).

<!-- Add link to short syntax docs here if they exist -->

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima jsdoc-open-api is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/jsdoc-open-api?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/jsdoc-open-api?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/jsdoc-open-api
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
