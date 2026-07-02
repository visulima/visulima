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

> [!WARNING]
> **Permission-bypass mode is opt-in.** By default every provider runs with its
> normal safety prompts. Pass `{ dangerous: true }` (or `--dangerous` on the CLI)
> to enable the provider's permission-bypass / auto-approval flag
> (`--dangerously-skip-permissions`, `--yolo`, `--dangerously-bypass-approvals-and-sandbox`, …).
> In that mode the agent gets unattended tool/file/shell access, so any untrusted
> content embedded in the prompt that prompt-injects the agent executes with all
> safety rails disabled. **Only enable it for fully trusted prompts.**

## Programmatic Usage

### Detect all AI CLI tools

```typescript
import { detectAllProviders, detectAllProvidersAsync, detectAvailableProviders } from "@visulima/find-ai-runner";

// Detect all 11 supported providers (available or not)
const all = detectAllProviders();

// Only the ones installed on the system
const available = detectAvailableProviders();
console.log(available);
// [{ name: "claude", available: true, path: "/usr/local/bin/claude", version: "1.2.3" }, ...]

// Faster: probe providers in parallel and skip the (slow) `--version` cold start
const fast = await detectAllProvidersAsync({ version: false });
```

> Detection spawns `which`/`where` per provider and, unless you pass
> `{ version: false }`, cold-starts each found CLI to read its `--version`
> banner (which can cost ~0.5–2 s per Node-based CLI). Skip version probing
> when you only need availability + path.

### Find the first available runner

```typescript
import { findRunner } from "@visulima/find-ai-runner";

// Returns the first installed provider, preferring claude, then codex, then gemini.
// Stops at the first hit (faster than detecting all 11), version probing is opt-in.
const runner = findRunner(["claude", "codex", "gemini"]);

if (runner) {
    console.log(`Using ${runner.name} at ${runner.path}`);
}
```

### Run a prompt

```typescript
import { detectAvailableProviders, runProvider } from "@visulima/find-ai-runner";

const [provider] = detectAvailableProviders();

if (provider) {
    const result = await runProvider(provider, "Explain this error: TypeError: Cannot read property 'foo' of undefined");
    console.log(result.stdout);
    console.log(`exit ${result.exitCode} in ${result.durationMs}ms`);
}
```

### Working directory, env, cancellation, and streaming

```typescript
import { detectProvider, runProvider } from "@visulima/find-ai-runner";

const provider = detectProvider("claude");
const controller = new AbortController();

if (provider.available) {
    const result = await runProvider(provider, "Review the staged changes", {
        cwd: "/path/to/repo", // point the agent at a target repo
        env: { ANTHROPIC_API_KEY: process.env.MY_KEY }, // per-run env, merged over process.env
        signal: controller.signal, // cancel programmatically with controller.abort()
        onStdout: (chunk) => process.stdout.write(chunk), // stream progress
    });
}
```

### Error handling

`runProvider` rejects with an `AiRunError` on timeout, abort, non-zero exit, or
spawn failure. The error carries the partial output captured so far plus exit
metadata, which is exactly what you need to debug a hung agent:

```typescript
import { AiRunError, runProvider } from "@visulima/find-ai-runner";

try {
    await runProvider(provider, prompt, { timeoutMs: 60_000 });
} catch (error) {
    if (error instanceof AiRunError) {
        console.error(`timed out: ${error.timedOut}, aborted: ${error.aborted}, exit: ${error.exitCode}`);
        console.error(error.stdout); // partial output before failure
    }
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

> Note: `maxTokens` is only wired into providers that expose a token-limit flag
> (currently Gemini); see the support matrix below.

## Supported Providers

`model` / `maxTokens` columns show whether the option is wired into that
provider's CLI invocation (passing an unsupported option is a no-op). The
"Bypass flag" column lists the permission-bypass flag that is only added when
you opt in with `{ dangerous: true }` / `--dangerous`.

| Provider | Command    | Env Variable    | Default Model    | `model` | `maxTokens` | Bypass flag (opt-in)                         |
| -------- | ---------- | --------------- | ---------------- | ------- | ----------- | -------------------------------------------- |
| Amp      | `amp`      | `AMP_PATH`      | provider-default | ✗       | ✗           | `--dangerously-allow-all`                    |
| Claude   | `claude`   | `CLAUDE_PATH`   | provider-default | ✓       | ✗           | `--dangerously-skip-permissions`             |
| Codex    | `codex`    | `CODEX_PATH`    | provider-default | ✓       | ✗           | `--dangerously-bypass-approvals-and-sandbox` |
| Copilot  | `copilot`  | `COPILOT_PATH`  | provider-default | ✓       | ✗           | `--allow-all-tools`                          |
| Crush    | `crush`    | `CRUSH_PATH`    | provider-default | ✓       | ✗           | `--yolo`                                     |
| Cursor   | `agent`    | `CURSOR_PATH`   | provider-default | ✓       | ✗           | `--force`                                    |
| Droid    | `droid`    | `DROID_PATH`    | provider-default | ✓       | ✗           | `--skip-permissions-unsafe`                  |
| Gemini   | `gemini`   | `GEMINI_PATH`   | `gemini-2.5-pro` | ✓       | ✓           | drops `--sandbox`                            |
| Kimi     | `kimi`     | `KIMI_PATH`     | provider-default | ✓       | ✗           | —                                            |
| OpenCode | `opencode` | `OPENCODE_PATH` | provider-default | ✓       | ✗           | —                                            |
| Qwen     | `qwen`     | `QWEN_PATH`     | provider-default | ✓       | ✗           | `--yolo`                                     |

> Codex targets the modern Rust CLI surface (`codex exec "<prompt>"`); the
> retired `--approval-mode`/`--max-tokens` flags are no longer emitted.

## Detection Strategies

Providers are detected using three strategies (tried in order):

1. **Environment variable** — `CLAUDE_PATH`, `GEMINI_PATH`, etc.
2. **`which`/`where` command** — checks system PATH
3. **Known paths** — `/opt/homebrew/bin/`, `~/.local/bin/`, `~/.cargo/bin/`, etc.

## Session Detection

Binary detection answers "which AI CLIs are installed?". Session detection answers the complementary question: **is an AI agent driving _this_ process right now?** — what dev servers, scaffolders, and destructive CLIs ask before switching to machine-readable output, backgrounding themselves, or requiring explicit human consent.

```ts
import { detectAiSession, isAiSession } from "@visulima/find-ai-runner";

const session = detectAiSession();

if (session) {
    console.log(`Driven by ${session.agent} (via ${session.variable})`);
    // e.g. { agent: "Claude Code", confidence: "definite", provider: "claude", variable: "CLAUDECODE" }
}

if (isAiSession()) {
    // emit JSON logs, skip interactive prompts, …
}
```

Detection is by environment markers the agent harnesses set in the shells they spawn (Claude Code, Cursor Agent, Codex, Gemini CLI / Qwen Code, GitHub Copilot CLI, opencode, Amp, Cline, Aider, Antigravity, Augment, Replit Agent), plus the self-describing `AI_AGENT` variable, which wins over the marker table. Every marker is sourced from a shipping implementation — a false positive silently changes a tool's behavior under a human's fingers.

Markers that only prove the **platform** (a Cursor editor terminal via `CURSOR_TRACE_ID`, a Replit workspace via `REPL_ID`) — where a human may well be the one typing — are reported with `confidence: "ambient"` and only consulted with `detectAiSession(process.env, { includeAmbient: true })`. Use ambient detection for telemetry, never for behavior switches.

Both functions accept a custom env object for testing: `detectAiSession({ CLAUDECODE: "1" })`.

## API

### `detectAllProviders(options?: AiDetectOptions): AiProviderInfo[]`

Returns info for all 11 providers, whether installed or not. Pass `{ version: false }` to skip the version probe.

### `detectAllProvidersAsync(options?: AiDetectOptions): Promise<AiProviderInfo[]>`

Async/parallel variant of `detectAllProviders`.

### `detectAvailableProviders(options?: AiDetectOptions): AiProviderInfo[]`

Returns only providers that are installed on the system.

### `detectProvider(name: AiProviderName, options?: AiDetectOptions): AiProviderInfo`

Detect a specific provider by name.

### `findRunner(preference?: AiProviderName[], options?: AiDetectOptions): AiProviderInfo | undefined`

Returns the first available provider in preference order, stopping at the first hit. Version probing is opt-in (`{ version: true }`).

### `buildCliArgs(name: AiProviderName, prompt: string, options?: AiRunOptions): string[]`

Build the CLI arguments array for a provider without executing.

### `detectAiSession(env?: EnvLike, options?: AiSessionOptions): AiSessionInfo | undefined`

Detects the AI agent session the current process runs inside via environment markers (see [Session Detection](#session-detection)). Pure; pass a custom `env` in tests.

### `isAiSession(env?: EnvLike, options?: AiSessionOptions): boolean`

Convenience predicate over `detectAiSession`.

### `runProvider(provider: AiProviderInfo, prompt: string, options?: AiRunOptions): Promise<AiRunResult>`

Execute a prompt against a detected provider. Returns `{ stdout, stderr, provider, exitCode, durationMs }`. Rejects with an `AiRunError` (carrying partial output) on failure. Supports `cwd`, `env`, `signal`, `onStdout`, `onStderr`, and `dangerous`.

### `AiRunError`

Error thrown by `runProvider`. Carries `provider`, `exitCode`, `durationMs`, partial `stdout`/`stderr`, and `timedOut`/`aborted` flags.

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
