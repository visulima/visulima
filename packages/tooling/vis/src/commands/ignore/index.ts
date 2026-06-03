import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis ignore` — generate or merge an ignore file for a build/publish
 * target (`.dockerignore`, `.vercelignore`, `.npmignore`, `.slugignore`).
 *
 * Emits a curated set of patterns for files that don't belong in a build
 * context or published package (docs, type-defs, source maps, tests, CI
 * config), and merges into an existing file WITHOUT adding entries that
 * are already present — so re-running never produces duplicates.
 *
 * (The CI "Ignored Build Step" gate that used to live here now lives at
 * `vis ci ignore`.)
 */
const ignore: Command = {
    description: "Generate or merge an ignore file (.dockerignore/.vercelignore/.npmignore/.slugignore) without duplicate entries",
    examples: [
        ["vis ignore", "Print a .dockerignore (deduped against an existing one)"],
        ["vis ignore --write", "Write/merge the .dockerignore in place"],
        ["vis ignore --target=vercel --write", "Write a deduped .vercelignore"],
        ["vis ignore --target=npm --json", "Emit the npm-target result as JSON"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "ignore",
    options: [
        { description: "Ignore-file target: docker | vercel | npm | slug (default: docker)", name: "target", type: String },
        { defaultValue: false, description: "Write the result to disk instead of printing to stdout", name: "write", type: Boolean },
        { defaultValue: false, description: "Emit the result as JSON", name: "json", type: Boolean },
    ],
};

export default ignore;

export type IgnoreOptions = CreateOptions<{
    json: boolean | undefined;
    target: string | undefined;
    write: boolean | undefined;
}>;
