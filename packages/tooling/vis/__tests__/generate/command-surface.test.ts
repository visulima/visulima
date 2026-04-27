/**
 * Lock down the `vis generate` CLI surface. Any change to arg/options
 * names, descriptions, defaults, or examples bumps this snapshot —
 * forcing an explicit review and matching docs update before merge.
 */

import { describe, expect, it } from "vitest";

import generateCommand from "../../src/commands/generate";

type CommandLike = Record<string, unknown>;

const stripExecute = (cmd: CommandLike): CommandLike => {
    const { execute: _execute, loader: _loader, ...rest } = cmd;

    return rest;
};

describe("vis generate — CLI surface", () => {
    it("exposes a stable Command shape", () => {
        expect.assertions(1);

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
            ],
            "group": "Scaffold & Config",
            "name": "generate",
            "options": [
              {
                "defaultValue": false,
                "description": "List discovered templates",
                "name": "list",
                "type": [Function],
              },
              {
                "description": "Destination directory",
                "name": "to",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Print planned writes without touching disk",
                "name": "dry-run",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Overwrite existing files without prompting",
                "name": "force",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Skip prompts; use template defaults",
                "name": "defaults",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Skip running post-generation scripts",
                "name": "skip-scripts",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Skip interactive prompts (errors on missing required values)",
                "name": "no-interactive",
                "type": [Function],
              },
              {
                "defaultValue": false,
                "description": "Prefer locally cached remote templates over re-downloading",
                "name": "prefer-offline",
                "type": [Function],
              },
            ],
          }
        `);
    });

    it("keeps each option name kebab-cased", () => {
        const optionNames = (generateCommand as unknown as { options?: { name: string }[] }).options?.map((o) => o.name) ?? [];

        expect.assertions(optionNames.length);

        for (const name of optionNames) {
            expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
        }
    });
});
