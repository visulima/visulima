/* eslint-disable no-console */
import { parseArgs } from "node:util";

import { PROVIDER_NAMES } from "./constants";
import { buildCliArgs, detectAiSessionAsync, detectAllProviders, detectProvider, runProvider } from "./index";
import type { AiProviderName } from "./types";

interface CliValues {
    ambient?: boolean;
    dangerous?: boolean;
    help?: boolean;
    json?: boolean;
    "max-tokens"?: string;
    model?: string;
    processes?: boolean;
    timeout?: string;
    version?: boolean;
}

/** Option definitions, shared between parsing and unknown-flag diagnostics. */
const OPTION_DEFINITIONS = {
    ambient: { type: "boolean" },
    dangerous: { type: "boolean" },
    help: { short: "h", type: "boolean" },
    json: { short: "j", type: "boolean" },
    "max-tokens": { type: "string" },
    model: { short: "m", type: "string" },
    processes: { type: "boolean" },
    timeout: { short: "t", type: "string" },
    version: { short: "v", type: "boolean" },
} as const;

// `strict: false` keeps positional prompt words that look like flags from blowing up,
// but it also silently swallows typos like `--mdoel`. We re-scan argv below to warn.
const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: OPTION_DEFINITIONS,
    strict: false,
}) as { positionals: string[]; values: CliValues };

const KNOWN_LONG_FLAGS = new Set<string>(Object.keys(OPTION_DEFINITIONS));
const KNOWN_SHORT_FLAGS = new Set<string>();

for (const definition of Object.values(OPTION_DEFINITIONS)) {
    if ("short" in definition) {
        KNOWN_SHORT_FLAGS.add(definition.short);
    }
}

/** Warn about flag-shaped argv tokens that are not recognized options (typos, wrong casing). */
const warnUnknownFlags = (): void => {
    for (const token of process.argv.slice(2)) {
        if (!token.startsWith("-") || token === "-" || token === "--") {
            continue;
        }

        if (token.startsWith("--")) {
            const name = token.slice(2).split("=", 1)[0] ?? "";

            if (name && !KNOWN_LONG_FLAGS.has(name)) {
                console.error(`Warning: unknown option "--${name}" was ignored.`);
            }
        } else {
            const short = token.slice(1, 2);

            if (short && !KNOWN_SHORT_FLAGS.has(short)) {
                console.error(`Warning: unknown option "-${short}" was ignored.`);
            }
        }
    }
};

const printUsage = (): void => {
    console.log(`find-ai-runner - Detect and invoke AI CLI tools

Usage:
  find-ai-runner <command> [options]

Commands:
  list                        List all providers and their availability
  detect <provider>           Detect a specific provider
  session                     Detect whether an AI agent is driving THIS process
  run <provider> <prompt>     Run a prompt against a provider
  args <provider> <prompt>    Preview CLI arguments without executing

Options:
  -h, --help                  Show this help message
  -v, --version               Show version
  -j, --json                  Output as JSON
  -m, --model <model>         Model override (for run command)
  --max-tokens <n>            Max tokens (default: 4096)
  -t, --timeout <ms>          Timeout in ms (default: 300000)
  --ambient                   Include ambient markers (session: editor terminals,
                              cloud workspaces where a human may be typing)
  --processes                 Also walk the process tree (session: catches agents
                              that set no env var; spawns a subprocess, slower)
  --dangerous                 Enable permission-bypass mode (UNSAFE: grants the
                              agent unattended tool/file/shell access)

Providers:
  ${PROVIDER_NAMES.join(", ")}

Examples:
  npx @visulima/find-ai-runner list
  npx @visulima/find-ai-runner list --json
  npx @visulima/find-ai-runner detect claude
  npx @visulima/find-ai-runner run claude "explain this code"
`);
};

const isProviderName = (name: string): name is AiProviderName => (PROVIDER_NAMES as string[]).includes(name);

const fail = (message: string): void => {
    console.error(message);
    process.exitCode = 1;
};

const validateProvider = (name: string | undefined, usage: string): AiProviderName | undefined => {
    if (!name) {
        fail(`Error: provider name required. Usage: find-ai-runner ${usage}`);

        return undefined;
    }

    if (!isProviderName(name)) {
        fail(`Error: unknown provider "${name}". Available: ${PROVIDER_NAMES.join(", ")}`);

        return undefined;
    }

    return name;
};

const handleList = (cliValues: CliValues): void => {
    const all = detectAllProviders();

    if (cliValues.json) {
        console.log(JSON.stringify(all, undefined, 2));

        return;
    }

    if (all.every((p) => !p.available)) {
        console.log("No AI CLI providers detected on this system.");

        return;
    }

    for (const provider of all) {
        const status = provider.available ? "\u2713" : "\u2717";
        const version = provider.version ? ` (v${provider.version})` : "";
        const path = provider.path ? ` - ${provider.path}` : "";

        console.log(`  ${status} ${provider.name}${version}${path}`);
    }
};

const handleSession = async (cliValues: CliValues): Promise<void> => {
    const session = await detectAiSessionAsync(process.env, {
        checkProcesses: cliValues.processes === true,
        includeAmbient: cliValues.ambient === true,
    });

    if (!session) {
        // Exit 1 in both modes so scripts can gate on the exit code regardless of --json.
        console.log(cliValues.json ? "null" : "No AI agent session detected.");
        process.exitCode = 1;

        return;
    }

    if (cliValues.json) {
        console.log(JSON.stringify(session, undefined, 2));

        return;
    }

    const provider = session.provider ? ` [provider: ${session.provider}]` : "";

    console.log(`${session.agent} (${session.type}, ${session.confidence}) via ${session.signal}${provider}`);
};

const handleDetect = (cliPositionals: string[], cliValues: CliValues): void => {
    const name = validateProvider(cliPositionals[1], "detect <provider>");

    if (!name) {
        return;
    }

    const info = detectProvider(name);

    if (cliValues.json) {
        console.log(JSON.stringify(info, undefined, 2));
    } else if (info.available) {
        console.log(`${info.name} is available`);
        console.log(`  Path: ${info.path ?? "unknown"}`);
        console.log(`  Version: ${info.version ?? "unknown"}`);
        console.log(`  Detected via: ${info.detectionMethod ?? "unknown"}`);
    } else {
        console.log(`${info.name} is not available on this system.`);
    }
};

const handleRun = async (cliPositionals: string[], cliValues: CliValues): Promise<void> => {
    const providerName = cliPositionals[1];
    const prompt = cliPositionals.slice(2).join(" ");

    if (!providerName || !prompt) {
        fail("Error: provider and prompt required. Usage: find-ai-runner run <provider> <prompt>");

        return;
    }

    const name = validateProvider(providerName, "run <provider> <prompt>");

    if (!name) {
        return;
    }

    const provider = detectProvider(name);

    if (!provider.available) {
        fail(`Error: ${name} is not available on this system.`);

        return;
    }

    const maxTokensRaw = cliValues["max-tokens"] ? Number(cliValues["max-tokens"]) : undefined;
    const timeoutRaw = cliValues.timeout ? Number(cliValues.timeout) : undefined;

    const result = await runProvider(provider, prompt, {
        dangerous: cliValues.dangerous === true,
        maxTokens: maxTokensRaw !== undefined && Number.isFinite(maxTokensRaw) ? maxTokensRaw : undefined,
        model: cliValues.model,
        timeoutMs: timeoutRaw !== undefined && Number.isFinite(timeoutRaw) ? timeoutRaw : undefined,
    });

    console.log(result.stdout);

    if (result.stderr) {
        console.error(result.stderr);
    }
};

const handleArgs = (cliPositionals: string[], cliValues: CliValues): void => {
    const providerName = cliPositionals[1];
    const prompt = cliPositionals.slice(2).join(" ");

    if (!providerName || !prompt) {
        fail("Error: provider and prompt required. Usage: find-ai-runner args <provider> <prompt>");

        return;
    }

    const name = validateProvider(providerName, "args <provider> <prompt>");

    if (!name) {
        return;
    }

    const maxTokensArgument = cliValues["max-tokens"] ? Number(cliValues["max-tokens"]) : undefined;

    const args = buildCliArgs(name, prompt, {
        dangerous: cliValues.dangerous === true,
        maxTokens: maxTokensArgument !== undefined && Number.isFinite(maxTokensArgument) ? maxTokensArgument : undefined,
        model: cliValues.model,
    });

    if (cliValues.json) {
        console.log(JSON.stringify(args));
    } else {
        console.log(args.join(" "));
    }
};

const main = async (): Promise<void> => {
    if (values.version) {
        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        const packageJson = require("../package.json") as { version: string };

        console.log(packageJson.version);

        return;
    }

    const command = positionals[0];

    if (values.help || !command) {
        printUsage();

        return;
    }

    warnUnknownFlags();

    switch (command) {
        case "args": {
            handleArgs(positionals, values);
            break;
        }

        case "detect": {
            handleDetect(positionals, values);
            break;
        }

        case "list": {
            handleList(values);
            break;
        }

        case "run": {
            await handleRun(positionals, values);
            break;
        }

        case "session": {
            await handleSession(values);
            break;
        }

        default: {
            fail(`Unknown command: ${command}`);
            printUsage();
        }
    }
};

try {
    await main();
} catch (error: unknown) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
}
