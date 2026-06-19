import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis x &lt;file>` — run a TypeScript/JavaScript file directly under the selected
 * runtime, no build step. Phase 2 of the cross-runtime multi-tool (see
 * `rfc/design-runtime-multitool.md`).
 *
 * Architecture mirrors nub's `nub &lt;file>` (MIT) — a thin runtime router. Bun runs
 * TS/JSX natively (`bun run`); Node runs the file in-process through vis-native's
 * oxc `registerHooks` loader (`runtime/ts-loader.ts`), which transpiles the full TS
 * surface + JSX with no second Node boot. On the 22.14.x floor (no `registerHooks`)
 * the loader falls back to transpiling the entry to a temp `.mjs`.
 */
const x: Command = {
    argument: {
        description: "File to run, with any args to forward to it",
        name: "file",
        type: String,
    },
    description: "Run a TypeScript/JavaScript file directly under the selected runtime (node | bun)",
    examples: [
        ["vis x script.ts", "Run a TypeScript file (full TS surface: enums, decorators)"],
        ["vis x --runtime bun server.ts", "Run under Bun"],
        ["vis x build.ts foo bar", "Forward positional args to the file"],
        ["vis x task.ts -- --watch", "Forward flags after -- to the file"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "x",
    options: [],
};

export default x;

export type XOptions = CreateOptions<Record<string, never>>;
