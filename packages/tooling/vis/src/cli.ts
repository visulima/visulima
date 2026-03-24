import { argv, exit, stdout } from "node:process";

import { runCommand } from "./commands/run";
import { graphCommand } from "./commands/graph";
import { affectedCommand } from "./commands/affected";

const VERSION = "0.0.1";

const HELP_TEXT = `
vis - Visulima Task Runner CLI

Usage:
  vis <command> [options]

Commands:
  run <target>       Run a target across workspace projects
  affected <target>  Run a target only on affected projects
  graph              Visualize the project dependency graph

Options:
  --help, -h         Show this help message
  --version, -v      Show version

Run Options:
  --projects=<list>  Comma-separated list of projects to run
  --parallel=<n>     Maximum number of parallel tasks (default: 3)
  --no-cache         Disable caching
  --cache-dir=<dir>  Custom cache directory
  --verbose          Show verbose output
  --dry-run          Show what would run without executing
  --summarize        Generate a run summary

Graph Options:
  --format=<fmt>     Output format: ascii, dot, json, html (default: ascii)
  --output=<file>    Write output to file instead of stdout

Affected Options:
  --base=<ref>       Git base ref for comparison (default: HEAD~1)
  --head=<ref>       Git head ref for comparison (default: HEAD)
`;

interface ParsedArgs {
    command: string;
    positionals: string[];
    flags: Record<string, string | boolean>;
}

/**
 * Parses CLI arguments into a structured format.
 */
const parseArgs = (args: string[]): ParsedArgs => {
    const positionals: string[] = [];
    const flags: Record<string, string | boolean> = {};
    let command = "";

    for (const arg of args) {
        if (arg.startsWith("--")) {
            const withoutDashes = arg.slice(2);
            const eqIndex = withoutDashes.indexOf("=");

            if (eqIndex > -1) {
                const key = withoutDashes.slice(0, eqIndex);
                const value = withoutDashes.slice(eqIndex + 1);

                flags[key as string] = value;
            } else if (withoutDashes.startsWith("no-")) {
                flags[withoutDashes.slice(3)] = false;
            } else {
                flags[withoutDashes] = true;
            }
        } else if (arg.startsWith("-")) {
            flags[arg.slice(1)] = true;
        } else if (!command) {
            command = arg;
        } else {
            positionals.push(arg);
        }
    }

    return { command, flags, positionals };
};

/**
 * Main CLI entry point.
 */
const run = async (): Promise<void> => {
    const args = argv.slice(2);
    const parsed = parseArgs(args);

    if (parsed.flags["help"] || parsed.flags["h"]) {
        stdout.write(HELP_TEXT + "\n");

        return;
    }

    if (parsed.flags["version"] || parsed.flags["v"]) {
        stdout.write(`vis v${VERSION}\n`);

        return;
    }

    if (!parsed.command) {
        stdout.write(HELP_TEXT + "\n");

        return;
    }

    switch (parsed.command) {
        case "run": {
            await runCommand(parsed.positionals, parsed.flags);
            break;
        }

        case "graph": {
            await graphCommand(parsed.positionals, parsed.flags);
            break;
        }

        case "affected": {
            await affectedCommand(parsed.positionals, parsed.flags);
            break;
        }

        default: {
            stdout.write(`Unknown command: ${parsed.command}\n`);
            stdout.write(HELP_TEXT + "\n");
            exit(1);
        }
    }
};

export { parseArgs, run };
export type { ParsedArgs };
