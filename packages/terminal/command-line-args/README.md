<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="command-line-args" />

</a>

<h3 align="center">A mature, feature-complete library to parse command-line options.</h3>

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

> **Note:** This package is a modern replacement for the original `command-line-args` library, providing improved performance, better TypeScript support, and enhanced features while maintaining full backward compatibility.

## Install

```sh
npm install @visulima/command-line-args
```

```sh
yarn add @visulima/command-line-args
```

```sh
pnpm add @visulima/command-line-args
```

## Usage

### Basic Example

Parse command-line arguments with a simple list of option definitions:

```typescript
// Recommended: using parseArgs (concise name)
import { parseArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "file", alias: "f", type: String },
    { name: "verbose", alias: "v", type: Boolean },
    { name: "output", alias: "o", type: String },
];

const args = parseArgs(definitions);
// Usage: node script.js --file input.txt -v --output result.json
// Result: { file: "input.txt", verbose: true, output: "result.json" }
```

**Alternative:** You can also use `commandLineArgs` (backward compatible):

```typescript
import { commandLineArgs } from "@visulima/command-line-args";
const args = commandLineArgs(definitions);
```

### Working with Multiple Values

Use the `multiple` flag to accept multiple values for an option:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "include", alias: "i", type: String, multiple: true },
    { name: "exclude", alias: "e", type: String, multiple: true },
];

const args = commandLineArgs(definitions);
// Usage: node script.js -i src -i lib -e node_modules -e dist
// Result: { include: ["src", "lib"], exclude: ["node_modules", "dist"] }
```

### Type Conversion

Automatically convert values to specific types:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "count", type: Number },
    { name: "ratio", type: Number },
    { name: "name", type: String },
    { name: "flag", type: Boolean },
];

const args = commandLineArgs(definitions);
// Usage: node script.js --count 42 --ratio 3.14 --name "John Doe" --flag
// Result: { count: 42, ratio: 3.14, name: "John Doe", flag: true }
```

### Default Values and Options

Provide default values and configure parsing behavior:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "port", type: Number, defaultValue: 3000 },
    { name: "host", type: String, defaultValue: "localhost" },
    { name: "debug", type: Boolean, defaultValue: false },
];

const args = commandLineArgs(definitions);
// Result: { port: 3000, host: "localhost", debug: false }
// Override: node script.js --port 8080
// Result: { port: 8080, host: "localhost", debug: false }
```

### Default Option (Catch-All)

Capture positional arguments with a default option:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "command", type: String },
    { name: "files", type: String, multiple: true, defaultOption: true },
];

const args = commandLineArgs(definitions);
// Usage: node script.js build file1.js file2.js file3.js
// Result: { command: "build", files: ["file1.js", "file2.js", "file3.js"] }
```

### Partial Parsing

Enable partial parsing to handle unknown options gracefully:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [{ name: "config", alias: "c", type: String }];

const args = commandLineArgs(definitions, { partial: true });
// Usage: node script.js --config app.json --unknown-option value
// Result: { config: "app.json", _unknown: ["--unknown-option", "value"] }
```

### Case-Insensitive Parsing

Enable case-insensitive option matching:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [{ name: "output", type: String }];

const args = commandLineArgs(definitions, { caseInsensitive: true });
// Usage: node script.js --OUTPUT result.txt
// Result: { output: "result.txt" }
```

### Camel Case Conversion

Automatically convert hyphenated option names to camel case:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "input-file", type: String },
    { name: "output-file", type: String },
];

const args = commandLineArgs(definitions, { camelCase: true });
// Usage: node script.js --input-file source.txt --output-file result.txt
// Result: { inputFile: "source.txt", outputFile: "result.txt" }
```

### Stop at First Unknown

Stop parsing at the first unknown option:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [{ name: "verbose", type: Boolean }];

const args = commandLineArgs(definitions, { stopAtFirstUnknown: true });
// Usage: node script.js -v --unknown-option value
// Result: { verbose: true, _unknown: ["--unknown-option", "value"] }
```

### Custom Type Conversion

Define custom type conversion functions:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const parseJSON = (value: string) => JSON.parse(value);

const definitions = [{ name: "config", type: parseJSON }];

const args = commandLineArgs(definitions);
// Usage: node script.js --config '{"debug": true}'
// Result: { config: { debug: true } }
```

### Option Groups

Organize related options into groups:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "port", type: Number, group: "server" },
    { name: "host", type: String, group: "server" },
    { name: "debug", type: Boolean, group: "debug" },
    { name: "verbose", type: Boolean, group: "debug" },
];

const args = commandLineArgs(definitions);
// Usage: node script.js --port 3000 --host 0.0.0.0 --debug --verbose
// Result: { port: 3000, host: "0.0.0.0", debug: true, verbose: true }
```

### Real-World CLI Example

Build a complete CLI application:

```typescript
import { commandLineArgs } from "@visulima/command-line-args";

const definitions = [
    { name: "command", defaultOption: true, type: String },
    { name: "config", alias: "c", type: String, defaultValue: ".env" },
    { name: "verbose", alias: "v", type: Boolean },
    { name: "version", type: Boolean },
    { name: "help", alias: "h", type: Boolean },
];

const options = commandLineArgs(definitions);

if (options.help) {
    console.log(`
    Usage: cli [command] [options]

    Commands:
      build     Build the project
      start     Start the development server
      test      Run tests

    Options:
      -c, --config <file>   Configuration file (default: .env)
      -v, --verbose         Enable verbose output
      --version             Show version
      -h, --help            Show this help message
  `);
    process.exit(0);
}

if (options.version) {
    console.log("1.0.0");
    process.exit(0);
}

const command = options.command || "start";
console.log(`Running command: ${command}`);
console.log(`Config: ${options.config}`);
if (options.verbose) console.log("Verbose mode enabled");
```

## Features

- ✅ **Lightweight**: Zero dependencies, only ~33KB bundle size
- ✅ **Fast**: Optimized parsing with smart memoization
- ✅ **TypeScript**: Full type safety and excellent IDE support
- ✅ **Flexible**: Supports boolean, string, number, and custom types
- ✅ **Powerful**: Default options, multiple values, grouping, and more
- ✅ **Robust**: Comprehensive error handling and validation
- ✅ **Well-tested**: 146+ unit tests with 100% pass rate

## API Reference

### `parseArgs(definitions, options?)`

**Recommended alias** for parsing command-line arguments according to the provided definitions.

```typescript
import { parseArgs } from "@visulima/command-line-args";
const args = parseArgs(definitions, options);
```

### `commandLineArgs(definitions, options?)`

Backward-compatible original export. Same functionality as `parseArgs`.

```typescript
import { commandLineArgs } from "@visulima/command-line-args";
const args = commandLineArgs(definitions, options);
```

---

## Function Parameters

#### Parameters

- **definitions**: `OptionDefinition | OptionDefinition[]` - Option definitions
- **options**: `ParseOptions` (optional) - Parsing configuration

#### ParseOptions

| Option               | Type       | Default                 | Description                           |
| -------------------- | ---------- | ----------------------- | ------------------------------------- |
| `argv`               | `string[]` | `process.argv.slice(2)` | Arguments to parse                    |
| `camelCase`          | `boolean`  | `false`                 | Convert hyphenated names to camelCase |
| `caseInsensitive`    | `boolean`  | `false`                 | Match options case-insensitively      |
| `debug`              | `boolean`  | `false`                 | Enable debug logging                  |
| `partial`            | `boolean`  | `false`                 | Allow unknown options                 |
| `stopAtFirstUnknown` | `boolean`  | `false`                 | Stop parsing at first unknown option  |

#### OptionDefinition

| Property        | Type                 | Optional | Description                                                         |
| --------------- | -------------------- | -------- | ------------------------------------------------------------------- |
| `name`          | `string`             | ❌       | Long option name (e.g., `"verbose"`)                                |
| `alias`         | `string`             | ✅       | Single character short alias (e.g., `"v"`)                          |
| `type`          | `Function`           | ✅       | Type constructor: `String`, `Number`, `Boolean`, or custom function |
| `multiple`      | `boolean`            | ✅       | Accept multiple values (array)                                      |
| `lazyMultiple`  | `boolean`            | ✅       | Accept multiple values without greedy parsing                       |
| `defaultValue`  | `any`                | ✅       | Default value if option not provided                                |
| `defaultOption` | `boolean`            | ✅       | Catch-all for positional arguments                                  |
| `group`         | `string \| string[]` | ✅       | Organize options into groups                                        |

#### Return Value

Returns a `CommandLineOptions` object with parsed values and special keys:

- Regular option values are stored by their `name`
- Positional arguments are stored under `defaultOption` if defined
- Unknown options are stored in `_unknown` array if parsing is partial
- Unknown option names throw `UnknownOptionError` in strict mode

#### Errors

- **`InvalidDefinitionsError`**: Invalid option definitions
- **`UnknownOptionError`**: Unknown option encountered (strict mode)
- **`UnknownValueError`**: Unconsumed positional arguments (strict mode)
- **`AlreadySetError`**: Option set multiple times (non-multiple mode)

## Related

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima command-line-args is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/command-line-args?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/command-line-args?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/command-line-args
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
