<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="find-ai-runner" />

</a>

<h3 align="center">Detect and invoke AI CLI tools (Claude, Gemini, Codex, Copilot, Cursor, Crush, Amp, Kimi, Qwen, OpenCode, Droid) installed on the system</h3>

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
npm install @visulima/find-ai-runner
```

```sh
yarn add @visulima/find-ai-runner
```

```sh
pnpm add @visulima/find-ai-runner
```

## CLI Usage

Run directly with `npx` — no installation required:

```bash
# List all providers and their availability
npx @visulima/find-ai-runner list

# Output as JSON
npx @visulima/find-ai-runner list --json

# Detect a specific provider
npx @visulima/find-ai-runner detect claude

# Run a prompt against a provider
npx @visulima/find-ai-runner run claude "Explain this error"

# Preview CLI arguments without executing
npx @visulima/find-ai-runner args claude "Explain this code" --json
```

## Programmatic Usage

### Detect all AI CLI tools

```typescript
import { detectAllProviders, detectAvailableProviders } from "@visulima/find-ai-runner";

// Detect all 11 supported providers (available or not)
const all = detectAllProviders();

// Only the ones installed on the system
const available = detectAvailableProviders();
console.log(available);
// [{ name: "claude", available: true, path: "/usr/local/bin/claude", version: "1.2.3" }, ...]
```

### Run a prompt

```typescript
import { detectAvailableProviders, runProvider } from "@visulima/find-ai-runner";

const [provider] = detectAvailableProviders();

if (provider) {
    const result = await runProvider(provider, "Explain this error: TypeError: Cannot read property 'foo' of undefined");
    console.log(result.stdout);
}
```

### Detect a specific provider

```typescript
import { detectProvider } from "@visulima/find-ai-runner";

const claude = detectProvider("claude");

if (claude.available) {
    console.log(`Claude found at ${claude.path}, version ${claude.version}`);
}
```

### Custom model and timeout

```typescript
import { detectProvider, runProvider } from "@visulima/find-ai-runner";

const provider = detectProvider("claude");

if (provider.available) {
    const result = await runProvider(provider, "Analyze this dependency update", {
        model: "claude-opus-4-20250514",
        maxTokens: 8192,
        timeoutMs: 60_000,
    });
}
```

## Supported Providers

| Provider | Command    | Env Variable    | Default Model               | Prompt Flags                             |
| -------- | ---------- | --------------- | --------------------------- | ---------------------------------------- |
| Amp      | `amp`      | `AMP_PATH`      |                             | `-x --dangerously-allow-all`             |
| Claude   | `claude`   | `CLAUDE_PATH`   | `claude-sonnet-4-20250514`  | `--dangerously-skip-permissions -p`      |
| Codex    | `codex`    | `CODEX_PATH`    | `o3`                        | positional + `--approval-mode full-auto` |
| Copilot  | `copilot`  | `COPILOT_PATH`  |                             | `-p --allow-all-tools`                   |
| Crush    | `crush`    | `CRUSH_PATH`    |                             | `run --yolo`                             |
| Cursor   | `agent`    | `CURSOR_PATH`   |                             | `-p --force`                             |
| Droid    | `droid`    | `DROID_PATH`    |                             | positional + `--skip-permissions-unsafe` |
| Gemini   | `gemini`   | `GEMINI_PATH`   | `gemini-2.5-pro`            | `--sandbox -p`                           |
| Kimi     | `kimi`     | `KIMI_PATH`     |                             | `--quiet -p`                             |
| OpenCode | `opencode` | `OPENCODE_PATH` | `anthropic/claude-sonnet-4` | `run` subcommand                         |
| Qwen     | `qwen`     | `QWEN_PATH`     |                             | `-p --yolo -o text`                      |

## Detection Strategies

Providers are detected using three strategies (tried in order):

1. **Environment variable** — `CLAUDE_PATH`, `GEMINI_PATH`, etc.
2. **`which`/`where` command** — checks system PATH
3. **Known paths** — `/opt/homebrew/bin/`, `~/.local/bin/`, `~/.cargo/bin/`, etc.

## API

### `detectAllProviders(): AiProviderInfo[]`

Returns info for all 11 providers, whether installed or not.

### `detectAvailableProviders(): AiProviderInfo[]`

Returns only providers that are installed on the system.

### `detectProvider(name: AiProviderName): AiProviderInfo`

Detect a specific provider by name.

### `buildCliArgs(name: AiProviderName, prompt: string, options?: AiRunOptions): string[]`

Build the CLI arguments array for a provider without executing.

### `runProvider(provider: AiProviderInfo, prompt: string, options?: AiRunOptions): Promise<AiRunResult>`

Execute a prompt against a detected provider. Returns `{ stdout, stderr, provider }`.

### `PROVIDERS: Record<AiProviderName, AiProviderConfig>`

The full provider configuration map.

### `PROVIDER_NAMES: AiProviderName[]`

All supported provider names in alphabetical order.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima find-ai-runner is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/find-ai-runner?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/find-ai-runner?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/find-ai-runner
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
