<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="cerebro" />

</a>

<h3 align="center">A delightful toolkit for building cross-runtime CLIs for Node.js, Deno, and Bun.</h3>

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
import { Cerebro } from "@visulima/cerebro";

// Create a CLI runtime
const cli = new Cerebro("my-cli");

// Add commands with options and arguments
cli.addCommand({
    name: "build",
    description: "Build the project",
    options: [
        {
            name: "output",
            alias: "o",
            type: String,
            description: "Output directory",
            defaultValue: "dist",
        },
        {
            name: "production",
            alias: "p",
            type: Boolean,
            description: "Build for production",
        },
        {
            name: "watch",
            alias: "w",
            type: Boolean,
            description: "Watch for changes",
        },
    ],
    argument: {
        name: "target",
        description: "Build target (optional)",
        type: String,
    },
    execute: ({ options, argument, logger, env }) => {
        const target = argument[0] || "all";
        const outputDir = options.output;

        logger.info(`Building target: ${target}`);
        logger.info(`Output directory: ${outputDir}`);

        if (options.production) {
            logger.info("Production build enabled");
        }

        if (options.watch) {
            logger.info("Watch mode enabled");
        }

        if (env.NODE_ENV) {
            logger.info(`Environment: ${env.NODE_ENV}`);
        }
    },
});

// Add another command with environment variables
cli.addCommand({
    name: "deploy",
    description: "Deploy the application",
    env: [
        {
            name: "DEPLOY_ENV",
            description: "Deployment environment",
            type: String,
            defaultValue: "staging",
        },
        {
            name: "API_KEY",
            description: "API key for deployment",
            type: String,
        },
    ],
    execute: ({ env, logger }) => {
        logger.info(`Deploying to ${env.DEPLOY_ENV}`);
        if (env.API_KEY) {
            logger.info("Using provided API key");
        }
    },
});

await cli.run();
```

Now you can run your CLI with `node index.js` (or `deno run index.js`, `bun index.js`). Here are some example usages:

```bash
# Show help
node index.js --help

# Build with default options
node index.js build

# Build specific target with custom output
node index.js build --output ./build client

# Production build with watch mode
node index.js build --production --watch

# Deploy (uses environment variables)
node index.js deploy
```

You should see help output and command execution based on the options provided:

![Cli Output](./__assets__/cli_output.png)

## Lazy commands

For CLIs with many subcommands or heavy per-command dependencies, you can defer importing each handler until the command is actually invoked. Declare the metadata inline and point `loader` at a dynamic `import()`:

```ts
// commands/build.ts
export default ({ logger, options }) => {
    logger.info(`Building to ${options.output ?? "dist"}`);
};
```

```ts
// index.ts
cli.addCommand({
    name: "build",
    description: "Build the project",
    options: [{ name: "output", alias: "o", type: String, description: "Output directory" }],
    argument: { name: "target", type: String },
    loader: () => import("./commands/build"),
});
```

`loader` is a zero-argument function that returns a promise resolving to a module — typically `() => import("./path")`. The handler module's **default export** is the toolbox-receiving function. Help, completion, and option validation work entirely from the metadata you declared on `addCommand` and never trigger the loader. The first invocation of the command imports the module; subsequent calls reuse the cached handler.

A command may declare either `execute` or `loader`, but not both. If a loader rejects or returns a module without a default-exported function, a `CommandLoaderError` is thrown.

## Toolbox API

When your command's `execute` function is called, it receives a toolbox object with various utilities and context. Here's what you can access:

### Core Properties

- **`logger`**: Logger instance for output (debug, info, warn, error). Verbosity-gated via `--quiet`/`--verbose`/`--debug`.
- **`console`**: Alias for `logger`. Use it when porting goke-style code or when a `console`-named parameter reads more naturally.
- **`options`**: Parsed command-line options (camelCase keys)
- **`argument`**: Array of positional arguments
- **`env`**: Environment variables (camelCase keys) processed from the command's `env: [...]` definitions
- **`fs`**: Injected filesystem adapter (subset of `node:fs/promises`). Swap via `CliOptions.fs` for tests or sandboxed runtimes.
- **`process`**: Runtime snapshot — `cwd`, `env`, `argv`, `stdin`, `exit`, `platform`, `arch`. Prefer this over the global `process` so commands stay portable across Node, Deno, Bun, and mocked test runtimes.
- **`runtime`**: Reference to the CLI instance
- **`argv`**: Original command-line arguments array

### Example Usage

```ts
cli.addCommand({
    name: "example",
    description: "Example command showing toolbox usage",
    options: [
        { name: "verbose", alias: "v", type: Boolean, description: "Verbose output" },
        { name: "count", alias: "c", type: Number, description: "Count value", defaultValue: 1 },
    ],
    argument: {
        name: "input",
        description: "Input file",
        type: String,
    },
    env: [{ name: "DEBUG", type: Boolean, description: "Debug mode" }],
    execute: ({ logger, options, argument, env, runtime, argv }) => {
        // Use logger for output
        logger.info("Command started");

        // Access parsed options
        if (options.verbose) {
            logger.debug(`Count: ${options.count}`);
        }

        // Access positional arguments
        if (argument.length > 0) {
            logger.info(`Processing file: ${argument[0]}`);
        }

        // Access environment variables
        if (env.debug) {
            logger.debug("Debug mode enabled");
        }

        // Access CLI instance
        logger.info(`CLI name: ${runtime.cliName}`);

        // Access original argv
        logger.debug(`Full command: ${argv.join(" ")}`);
    },
});
```

## Runtime Injection

Commands receive an injected `{ fs, console, process }` context on the toolbox. Prefer reading from these over reaching for `node:fs/promises`, the global `console`, or the global `process` — commands written against the injected context stay testable, portable across Node/Deno/Bun, and ready to run inside sandboxed environments like MCP servers.

```ts
import { Cerebro } from "@visulima/cerebro";

const cli = new Cerebro("acme");

cli.addCommand({
    name: "login",
    description: "Save an auth token",
    options: [{ name: "token", type: String, description: "API token" }],
    execute: async ({ fs, console, process, options }) => {
        await fs.mkdir(".acme", { recursive: true });
        await fs.writeFile(".acme/auth.json", JSON.stringify({ token: options.token }), "utf8");
        console.log("saved credentials in", process.cwd);
    },
});

await cli.run();
```

### Overriding the runtime

Pass any of the new `CliOptions` to swap the runtime context. Each override defaults to a sensible host value:

| Option   | Default                      | Used for                                                  |
| -------- | ---------------------------- | --------------------------------------------------------- |
| `fs`     | `node:fs/promises` adapter   | Filesystem operations from `toolbox.fs`                   |
| `exit`   | Runtime-agnostic exit helper | `toolbox.process.exit`                                    |
| `env`    | Host `process.env`           | `toolbox.process.env` (does **not** affect `toolbox.env`) |
| `stdin`  | `""` (empty string)          | `toolbox.process.stdin`                                   |
| `cwd`    | Runtime cwd                  | `toolbox.process.cwd`                                     |
| `logger` | Verbosity-aware console shim | `toolbox.logger` and `toolbox.console`                    |

```ts
const exitSpy = vi.fn();
const fakeFs = new InMemoryFs();

const cli = new Cerebro("acme", {
    cwd: "/virtual/project",
    fs: fakeFs,
    exit: exitSpy,
    env: { NODE_ENV: "test" },
    stdin: "y\n",
});
```

### Testing with mocked runtime

The runtime overrides remove the need for `vi.spyOn(process, "exit")` or `vi.spyOn(console, "log")` in command tests. Pass mocks at CLI construction; assert on them directly.

```ts
import { describe, expect, test, vi } from "vitest";
import { Cerebro } from "@visulima/cerebro";

describe("deploy command", () => {
    test("exits with code 2 when env is missing", async () => {
        const exit = vi.fn();
        const calls: string[] = [];
        const logger = {
            log: (...args: unknown[]) => calls.push(String(args[0])),
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
        };

        const cli = new Cerebro("acme", { argv: ["deploy"], exit, logger });
        cli.addCommand({
            name: "deploy",
            execute: ({ console, process, options }) => {
                if (!options.env) {
                    console.log("missing --env");
                    process.exit(2);
                }
            },
        });

        await cli.run({ shouldExitProcess: false });

        expect(exit).toHaveBeenCalledWith(2);
        expect(calls).toStrictEqual(["missing --env"]);
    });
});
```

### `cli.clone(options?)`

Creates an independent CLI sharing the same command definitions. The clone has its own commands map, global options, default-command setting, and plugin manager — so adding commands or changing options on the clone never mutates the original. Primarily useful in tests to run the same CLI with different `argv`/`exit`/`fs` overrides without rebuilding the command tree.

```ts
const cli = new Cerebro("acme");
cli.addCommand({ name: "build", execute: ({ console }) => console.log("building") });

// In tests: clone with mocked exit + captured argv
const isolatedExit = vi.fn();
const isolated = cli.clone({ argv: ["build"], exit: isolatedExit });
await isolated.run({ shouldExitProcess: false });
```

### `cli.getAction(commandName)`

Returns the resolved `execute` function for a registered command. For lazy commands defined with `loader`, the module is loaded once and cached. Supports space-separated nested command paths.

```ts
const cli = new Cerebro("acme");

cli.addCommand({
    name: "deploy",
    execute: ({ console, options }) => console.log("deploying to", options.env),
});

// Call the action directly with a synthesized toolbox — no argv parsing.
const action = await cli.getAction("deploy");
await action({ console: fakeConsole, options: { env: "staging" } } as never);
```

Use this when you want to unit-test a command action in isolation without going through `run()`'s full lifecycle (plugin init, exception handlers, exit). For end-to-end tests that exercise argv parsing and lifecycle hooks, prefer `cli.clone(...).run(...)` instead.

## Built-in Commands

Cerebro comes with several built-in commands that are automatically available:

### Help Command

The help command is automatically added to your CLI and provides usage information for all commands.

```bash
my-cli help
my-cli help <command>
```

### Version Command

Display version information for your CLI.

```ts
import { Cerebro } from "@visulima/cerebro";
import versionCommand from "@visulima/cerebro/command/version";

const cli = new Cerebro("my-cli", {
    packageName: "my-cli",
    packageVersion: "1.0.0",
});

cli.addCommand(versionCommand);

await cli.run();
```

```bash
my-cli version
```

### Readme Generator Command

Generate README documentation for your CLI commands.

```ts
import { Cerebro } from "@visulima/cerebro";
import readmeCommand from "@visulima/cerebro/command/readme-generator";

const cli = new Cerebro("my-cli");
cli.addCommand(readmeCommand);

await cli.run();
```

```bash
my-cli readme-generator
```

## Shell Completions

Cerebro supports intelligent shell autocompletions for **bash**, **zsh**, **fish**, and **powershell** through the optional `@bomb.sh/tab` integration. The completion system automatically detects your current shell and runtime, providing context-aware suggestions for commands, options, and arguments.

### Installation

To enable completions, first install the optional peer dependency:

```sh
pnpm add @bomb.sh/tab
```

Or with other package managers:

```sh
npm install @bomb.sh/tab
yarn add @bomb.sh/tab
```

### Adding Completion Command

Import and add the completion command to your CLI. The completion command supports two options:

- **`--shell`**: Shell type (bash, zsh, fish, powershell) - auto-detected by default
- **`--runtime`**: JavaScript runtime (node, bun, deno) - auto-detected by default

```ts
import { Cerebro } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";

const cli = new Cerebro("my-cli");

// Add your commands with options
cli.addCommand({
    name: "build",
    description: "Build the project",
    options: [
        {
            name: "output",
            alias: "o",
            type: String,
            description: "Output directory",
        },
        {
            name: "production",
            alias: "p",
            type: Boolean,
            description: "Production build",
        },
    ],
    execute: ({ options }) => {
        console.log(`Building to ${options.output || "dist"}`);
    },
});

// Add completion command
cli.addCommand(completionCommand);

await cli.run();
```

### Generating Completion Scripts

Users can generate completion scripts for their shell. The completion command will automatically detect your shell and runtime, but you can override them if needed:

```bash
# Auto-detect shell and runtime (recommended)
my-cli completion > ~/.my-cli-completion.sh
echo 'source ~/.my-cli-completion.sh' >> ~/.bashrc  # or ~/.zshrc

# Explicitly specify shell
my-cli completion --shell=zsh > ~/.my-cli-completion.zsh
my-cli completion --shell=bash > ~/.my-cli-completion.bash
my-cli completion --shell=fish > ~/.config/fish/completions/my-cli.fish
my-cli completion --shell=powershell > ~/.my-cli-completion.ps1

# Override runtime detection
my-cli completion --runtime=node --shell=zsh > ~/.my-cli-completion.zsh
```

### Setup Instructions

**Bash:**

```bash
my-cli completion --shell=bash > ~/.my-cli-completion.bash
echo 'source ~/.my-cli-completion.bash' >> ~/.bashrc
source ~/.bashrc
```

**Zsh:**

```bash
my-cli completion --shell=zsh > ~/.my-cli-completion.zsh
echo 'source ~/.my-cli-completion.zsh' >> ~/.zshrc
source ~/.zshrc
```

**Fish:**

```bash
my-cli completion --shell=fish > ~/.config/fish/completions/my-cli.fish
```

**PowerShell:**

```powershell
my-cli completion --shell=powershell > $PROFILE.CurrentUserAllHosts
. $PROFILE.CurrentUserAllHosts
```

After setting up, users can press `TAB` to autocomplete:

- Command names
- Option flags (both long `--option` and short `-o`)
- Option values (when applicable)
- Subcommands

### Troubleshooting

If completions don't work:

1. Ensure `@bomb.sh/tab` is installed
2. Verify the completion script was sourced in your shell profile
3. Try restarting your shell or running `source ~/.bashrc` (or equivalent)
4. Check that your CLI name matches the completion script filename

## Supported Runtimes

Cerebro supports multiple JavaScript runtimes:

- **Node.js**: >=20.19 <=25.x (follows [Node.js' release schedule](https://github.com/nodejs/release#release-schedule))
- **Deno**: 1.0+
- **Bun**: 1.0+

The library uses runtime-agnostic APIs to ensure compatibility across all supported runtimes. Here's [a post on why we think tracking Node.js releases is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## About

### Related Projects

- [oclif](https://oclif.io) - The Open CLI Framework
- [gluegun](https://infinitered.github.io/gluegun/#/) - A delightful toolkit for building TypeScript-powered command-line apps.
- [meow](https://www.npmjs.com/package/meow) - CLI app helper
- [commander.js](https://github.com/tj/commander.js) - node.js command-line interfaces made easy
- [yargs](https://www.npmjs.com/package/yargs) - yargs the modern, pirate-themed successor to optimist.

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima package is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/cerebro?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/cerebro?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/cerebro
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
