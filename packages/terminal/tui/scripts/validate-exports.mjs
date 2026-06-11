// @ts-check
/**
 * Validates that the hand-maintained `exports` map in `package.json` stays in
 * sync with the source tree, catching the "forgot to add / typo'd a subpath"
 * class of release bugs that `packem.config.ts` cannot (it has
 * `validation.packageJson.exports: false` because the deep-subpath layout is
 * intentional and not derivable by packem alone).
 *
 * Checks, for every `./components/*` and `./hooks/*` export:
 *   1. The `types`/`default` targets point under `dist/` (built output).
 *   2. A corresponding source file exists in `src/`, so a renamed/removed
 *      component cannot leave a dangling export entry.
 *
 * Exits non-zero on the first batch of problems. Run via `pnpm run
 * lint:exports`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");

const { default: pkg } = await import(path.join(packageRoot, "package.json"), { with: { type: "json" } });

/** Map a `dist/...js` target back to its likely `src` source candidates. */
const sourceCandidates = (distRelative) => {
    const withoutDist = distRelative.replace(/^\.\/dist\//, "").replace(/\.js$/, "");

    return [`src/${withoutDist}.tsx`, `src/${withoutDist}.ts`];
};

const problems = [];

for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (!subpath.startsWith("./components/") && !subpath.startsWith("./hooks/")) {
        continue;
    }

    const distTarget = typeof target === "string" ? target : target.default;

    if (typeof distTarget !== "string") {
        problems.push(`${subpath}: missing "default" target`);

        continue;
    }

    if (!distTarget.startsWith("./dist/")) {
        problems.push(`${subpath}: target ${distTarget} does not point under ./dist/`);

        continue;
    }

    const candidates = sourceCandidates(distTarget);

    if (!candidates.some((candidate) => existsSync(path.join(packageRoot, candidate)))) {
        problems.push(`${subpath}: no source file found (looked for ${candidates.join(", ")})`);
    }
}

if (problems.length > 0) {
    process.stderr.write(`exports validation failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}\n`);
    process.exit(1);
}

process.stdout.write(`exports validation passed (${Object.keys(pkg.exports).length} entries).\n`);
