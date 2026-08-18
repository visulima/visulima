/**
 * Lock down the `vis generate` CLI surface. Any change to arg/options
 * names, descriptions, defaults, or examples bumps this snapshot —
 * forcing an explicit review and matching docs update before merge.
 */

import { describe, expect, it } from "vitest";

import generateCommand from "../../src/commands/generate";

type CommandLike = Record<string, unknown>;

const stripExecute = (cmd: CommandLike): CommandLike => {
    const rest = { ...cmd };

    delete rest["execute"];
    delete rest["loader"];

    return rest;
};

describe("vis generate — CLI surface", () => {
    it("exposes a stable Command shape", () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-large-snapshots -- full surface is the point of this test; truncating would defeat the purpose
        expect(stripExecute(generateCommand as unknown as CommandLike)).toMatchInlineSnapshot(`
          {
            "argument": {
              "description": "Template name (or remote source like git://… or npm://…) — omit for interactive picker",
              "name": "template",
              "type": [Function],
            },
            "description": "Scaffold files from an in-repo template",
            "examples": [
              [
                "vis generate",
                "Pick a template interactively",
              ],
              [
                "vis generate package",
                "Run the 'package' template",
              ],
              [
                "vis generate component -- --name=Button --style=primary",
                "Pre-fill option values",
              ],
              [
                "vis generate package --to=./packages/new --force",
                "Custom destination + overwrite",
              ],
              [
                "vis generate package --dry-run",
                "Print planned writes without touching disk",
              ],
              [
                "vis generate git://github.com/org/template#main",
                "Fetch and run a remote template",
              ],
              [
                "vis generate --list",
                "Show discovered templates",
              ],
              [
                "vis generate --list --json",
                "Machine-readable template list",
              ],
              [
                "vis generate package --describe --json",
                "Print template metadata (variables, destination) as JSON",
              ],
            ],
            "group": "Scaffold & Config",
            "name": "generate",
            "options": {
              "defaults": {
                "defaultValue": false,
                "description": "Skip prompts; use template defaults",
                "type": [Function],
              },
              "describe": {
                "defaultValue": false,
                "description": "Print template metadata (about, destination, variables) without running produce",
                "type": [Function],
              },
              "dry-run": {
                "defaultValue": false,
                "description": "Print planned writes without touching disk",
                "type": [Function],
              },
              "force": {
                "defaultValue": false,
                "description": "Overwrite existing files without prompting",
                "type": [Function],
              },
              "json": {
                "defaultValue": false,
                "description": "Emit JSON output (with --list or --describe)",
                "type": [Function],
              },
              "list": {
                "defaultValue": false,
                "description": "List discovered templates",
                "type": [Function],
              },
              "no-interactive": {
                "defaultValue": false,
                "description": "Skip interactive prompts (errors on missing required values)",
                "type": [Function],
              },
              "prefer-offline": {
                "defaultValue": false,
                "description": "Prefer locally cached remote templates over re-downloading",
                "type": [Function],
              },
              "skip-scripts": {
                "defaultValue": false,
                "description": "Skip running post-generation scripts",
                "type": [Function],
              },
              "to": {
                "description": "Destination directory",
                "type": [Function],
              },
            },
          }
        `);
    });

    it("keeps each option name kebab-cased", () => {
        expect.hasAssertions();

        // Options are declared as a record keyed by name, so the keys are the
        // option names.
        const optionNames = Object.keys((generateCommand as unknown as { options?: Record<string, unknown> }).options ?? {});

        for (const name of optionNames) {
            expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
        }
    });
});
