/**
 * Static regression guard: command definition files must stay lean.
 *
 * `vis` is invoked per-task in workflows so startup latency multiplies.
 * The architecture keeps definitions cheap (metadata + loader:) and defers
 * all heavy work to handler modules loaded on-demand by cerebro.  This test
 * ensures that invariant is never accidentally broken by a stray import.
 *
 * Startup baseline (measured 2026-06-10, dist not yet built in worktree;
 * Step 3 is informational — no assertion is made here):
 *   dist/ was absent; baseline will be re-measured after the first production
 *   build lands.  See Step 3 in plan 005 notes.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Heavy modules that must NEVER appear as non-type imports in a command
// definition file.  Handlers may import them freely; definitions may not.
// ---------------------------------------------------------------------------
const DISALLOWED_DEFINITION_IMPORTS: string[] = [
    "@visulima/fs", // filesystem utilities — should stay in handlers
    "@visulima/package", // workspace graph scanning — I/O heavy
    "@visulima/task-runner", // native Rust addon — large startup cost
    "@visulima/tui", // React-based terminal UI — pulls in react-reconciler
    "react", // renderer — heavy; only handlers need it
    "react-reconciler", // reconciler — transitive but guard explicitly
];

// ---------------------------------------------------------------------------
// Known barrel files that live under src/commands/**/index.ts but are NOT
// command definitions (they export utilities / sub-module routers, not a
// cerebro Command object with `name:` + `description:`).
// Exclusion list with rationale:
//   - create/templates/index.ts         — executeTemplate() router
//   - hook/builtins/index.ts            — BUILTIN_REGISTRY map + helpers
//   - update/ecosystems/actions/index.ts — actions-ecosystem checker + scanner
//   - update/ecosystems/docker/index.ts  — docker-ecosystem checker + scanner
//   - update/ecosystems/gitlab/index.ts  — gitlab-ecosystem checker + scanner
//   - update/ecosystems/index.ts        — checkEcosystems() orchestration util
// ---------------------------------------------------------------------------
const KNOWN_BARRELS = new Set([
    "create/templates/index.ts",
    "hook/builtins/index.ts",
    "update/ecosystems/actions/index.ts",
    "update/ecosystems/docker/index.ts",
    "update/ecosystems/gitlab/index.ts",
    "update/ecosystems/index.ts",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively find all index.ts files under a directory. */
const findIndexFiles = (dir: string, base: string): string[] => {
    const results: string[] = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            results.push(...findIndexFiles(join(dir, entry.name), base));
        } else if (entry.name === "index.ts") {
            // Store as relative path from `base` (forward-slash normalised)
            results.push(
                join(dir, entry.name)
                    .slice(base.length + 1)
                    .replaceAll("\\", "/"),
            );
        }
    }

    return results;
};

/**
 * Strip every `import type …` line from source text so subsequent regexes
 * only see value imports.
 */
const stripTypeImports = (source: string): string =>
    source
        .split("\n")
        .filter((line) => !/^\s*import\s+type\b/.test(line))
        .join("\n");

/**
 * Return true when the file's content looks like a cerebro command definition
 * (default-exports an object with both `name:` and `description:` properties).
 */
const isCommandDefinition = (source: string): boolean => /name\s*:/.test(source) && /description\s*:/.test(source) && /export\s+default\b/.test(source);

// ---------------------------------------------------------------------------
// Locate command definitions
// ---------------------------------------------------------------------------

// Navigate from the test file's directory up to the package root, then src/.
// The test file lives at __tests__/unit/ — two levels below the package root.
// Using fileURLToPath + dirname is more portable than URL arithmetic because
// URL resolution from a file:// URL counts the filename as a path segment.
const thisDir = dirname(fileURLToPath(import.meta.url)); // .../vis/__tests__/unit
const packageRoot = join(thisDir, "..", ".."); // .../vis
const commandsRoot = join(packageRoot, "src", "commands");

const allIndexFiles = findIndexFiles(commandsRoot, commandsRoot);

// Split into barrels (known exclusions) and command definitions.
const barrelsFound = allIndexFiles.filter((f) => KNOWN_BARRELS.has(f));
const candidateFiles = allIndexFiles.filter((f) => !KNOWN_BARRELS.has(f));

// Guard: if we find more than 10 total barrel-like files (misclassified
// definitions) the exclusion list has grown beyond what the plan allows.
// Surface the list so the maintainer can audit rather than blindly extend.
const BARREL_CEILING = 10;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("command definition laziness guard", () => {
    it("exclusion list has at most 6 known barrel files", () => {
        expect.assertions(1);

        // Every file we excluded must actually exist under src/commands.
        // This catches stale entries if a barrel is moved/renamed.
        expect(barrelsFound).toHaveLength(KNOWN_BARRELS.size);
    });

    it("does not have unexpected barrel-like files beyond the known list", () => {
        expect.assertions(1);

        // Detect files that have no `loader:` and look like a barrel.
        // A barrel is any index.ts without `loader:` that is not a
        // command-definition (i.e. no default export with name+description).
        const unexpectedBarrels = candidateFiles.filter((relPath) => {
            const source = readFileSync(join(commandsRoot, relPath), "utf8");

            return !source.includes("loader:") && !isCommandDefinition(source);
        });

        expect(
            unexpectedBarrels,
            `Found ${String(unexpectedBarrels.length)} unexpected barrel-like file(s) not in KNOWN_BARRELS.\n`
            + `Add them to KNOWN_BARRELS with a comment explaining each one, or fix the definition to include loader:.\n`
            + `Files:\n  ${unexpectedBarrels.join("\n  ")}`,
        ).toHaveLength(0);
    });

    it(`has fewer than ${String(BARREL_CEILING)} total barrel/non-command files`, () => {
        expect.assertions(1);

        const allNonCommand = allIndexFiles.filter((relPath) => {
            const source = readFileSync(join(commandsRoot, relPath), "utf8");

            return !source.includes("loader:") && !isCommandDefinition(source);
        });

        expect(
            allNonCommand.length,
            `Barrel ceiling exceeded (${String(allNonCommand.length)} >= ${String(BARREL_CEILING)}). `
            + `Review and update KNOWN_BARRELS:\n  ${allNonCommand.join("\n  ")}`,
        ).toBeLessThan(BARREL_CEILING);
    });

    describe("per-file: no eager handler import", () => {
        it.each(candidateFiles)("%s does not import ./handler eagerly", (relPath) => {
            expect.assertions(1);

            const source = readFileSync(join(commandsRoot, relPath), "utf8");
            const stripped = stripTypeImports(source);

            // Match any non-type `import` statement referencing `./handler`.
            // `import type` lines are stripped above so this regex only sees
            // value imports.  We deliberately avoid `\b` + `[^;]*` since the
            // word-boundary assertion contradicts a zero-minimum quantifier;
            // instead we match `import` literally at the start of a word.
            const hasEagerHandler = /import\s+(?!type\s)[\s\S]*?from\s+["']\.\/handler["']/.test(stripped);

            expect(
                hasEagerHandler,
                `${relPath}: found a non-type import of ./handler. Use \`loader: () => import("./handler")\` instead to keep startup lazy.`,
            ).toBe(false);
        });
    });

    describe("per-file: no heavy module imports in definitions", () => {
        it.each(candidateFiles)("%s does not import heavy modules", (relPath) => {
            expect.assertions(1);

            const source = readFileSync(join(commandsRoot, relPath), "utf8");
            const stripped = stripTypeImports(source);

            const violations = DISALLOWED_DEFINITION_IMPORTS.filter((mod) => {
                // Match the full module name (or a scoped sub-path starting with it).
                // Escape path separators for the regex; `@` needs no escaping.
                const escaped = mod.replaceAll("/", String.raw`\/`);

                return new RegExp(String.raw`import\s+(?!type\s)[\s\S]*?from\s+["']` + escaped + String.raw`(["'/])`).test(stripped);
            });

            expect(
                violations,
                `${relPath}: command definition imports heavy module(s): ${violations.join(", ")}. `
                + `Move those imports into the handler file (loaded lazily via loader:).`,
            ).toHaveLength(0);
        });
    });

    describe("per-file: command definitions have loader:", () => {
        it.each(candidateFiles)("%s contains loader:", (relPath) => {
            expect.assertions(1);

            const source = readFileSync(join(commandsRoot, relPath), "utf8");

            // Files that are not recognisable command definitions (no default
            // export with name + description) are allowed to omit loader:.
            // We still run an assertion so the test is never vacuous.
            const mustHaveLoader = isCommandDefinition(source);

            expect(
                mustHaveLoader ? source.includes("loader:") : true,
                `${relPath}: command definition is missing a \`loader:\` property. Add \`loader: () => import("./handler")\` to keep startup lazy.`,
            ).toBe(true);
        });
    });
});
