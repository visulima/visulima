// @ts-check
/**
 * Builds the shadcn-compatible registry payloads — the copy-paste half of this
 * package's dual distribution. The same `src/` tree that packem publishes as
 * `@visulima/tui-kit` is emitted here as one `dist/r/<name>.json` per
 * component, which the shadcn CLI fetches:
 *
 *   npx shadcn@latest add https://visulima.com/r/gauge.json
 *
 * The two modes differ in exactly one way, which this script is responsible
 * for. In package mode a component reaches a sibling with a relative import
 * (`./line-chart`); in copy-paste mode that sibling has been copied into the
 * consumer's own tree, so the import must become the `@/components/ui/*` alias
 * the CLI rewrites — and the sibling must be declared a `registryDependency`
 * so the CLI knows to fetch it too. Both are derived from the imports, not
 * hand-maintained, so they cannot drift from the source.
 *
 * Item metadata (title/description/categories) comes from `registry-meta.json`;
 * anything absent falls back to a titleised name.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const sourceDirectory = path.join(packageRoot, "src");
const outputDirectory = path.join(packageRoot, "dist", "r");

const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const HOMEPAGE = "https://visulima.com/packages/tui";
const REGISTRY_NAME = "visulima/tui-kit";
// Where the emitted items are hosted; every registryDependency is an absolute
// URL under this base (shadcn requires absolute dep URLs). Override with
// REGISTRY_BASE_URL to point a local test server at the same tree.
const BASE_URL = process.env.REGISTRY_BASE_URL ?? "https://visulima.com/r";

/**
 * Not registry items: the barrel, and the flat entry shims that exist purely
 * to give directory components (`file-picker/`, `tree-view/`) a single subpath
 * in package mode. A copy-paste consumer gets the directory itself and has no
 * use for the shim.
 */
const NOT_ITEMS = new Set(["index", "file-picker-entry", "tree-view-entry"]);

/**
 * Shared helpers rather than components. They ship as `registry:lib` items so
 * the CLI can fetch them as dependencies, and land under `lib/` (aliased
 * `@/lib/*`) instead of `components/ui/`.
 */
const LIB_ITEMS = new Set(["chart-utils", "variant-config"]);

const aliasFor = (id) => (LIB_ITEMS.has(id) ? "@/lib" : "@/components/ui");

const titleise = (name) =>
    name
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

/**
 * Collect every `.ts`/`.tsx` file belonging to one component id, which is
 * either a single file (`gauge.tsx`) or a directory (`scroll/`).
 * @param {string} id Component id.
 * @returns {Promise<string[]>} Paths relative to `src/`.
 */
const filesFor = async (id) => {
    const asDirectory = path.join(sourceDirectory, id);

    try {
        if ((await stat(asDirectory)).isDirectory()) {
            const out = [];
            const walk = async (directory) => {
                for (const entry of await readdir(directory, { withFileTypes: true })) {
                    const absolute = path.join(directory, entry.name);

                    if (entry.isDirectory()) {
                        await walk(absolute);
                    } else if (/\.(tsx|ts)$/.test(entry.name)) {
                        out.push(path.relative(sourceDirectory, absolute));
                    }
                }
            };

            await walk(asDirectory);

            return out;
        }
    } catch {
        // Not a directory — fall through to the single-file case.
    }

    for (const extension of ["tsx", "ts"]) {
        try {
            await stat(path.join(sourceDirectory, `${id}.${extension}`));

            return [`${id}.${extension}`];
        } catch {
            continue;
        }
    }

    return [];
};

/**
 * The single source of truth for what counts as an import in a source file:
 * both static `from "x"` and dynamic `import("x")`. Every consumer below
 * (rewrite, private-import guard, dependency derivation) reads from this so
 * they cannot disagree about coverage.
 * @param {string} content Source text.
 * @returns {{dynamic: boolean, specifier: string}[]} Every imported specifier.
 */
const collectSpecifiers = (content) => {
    const out = [];

    // Two named groups so we know which form matched: `from "x"` vs `import("x")`.
    for (const match of content.matchAll(/(?:from\s+|(?<dyn>import\s*\(\s*))["']([^"']+)["']/g)) {
        out.push({ dynamic: match.groups?.dyn !== undefined, specifier: match[2] });
    }

    return out;
};

/**
 * Rewrite sibling imports to the `@/components/ui/*` alias and report which
 * components were referenced, so they can be declared as registry deps.
 * @param {string} content Source text.
 * @param {string} relative Path of the file within `src/`.
 * @param {Set<string>} ids Every known component id.
 * @returns {{content: string, deps: Set<string>}} Rewritten source and its deps.
 */
const rewriteForRegistry = (content, relative, ids) => {
    const deps = new Set();
    // Imports are always POSIX-style, so resolve them with `path.posix` — plain
    // `path` would emit `\` separators on Windows and corrupt the alias.
    const fromDirectory = path.posix.dirname(relative.split(path.sep).join("/"));

    const rewritten = content.replaceAll(/(\bfrom\s+|\bimport\s*\(\s*)["'](\.[^"']+)["']/g, (whole, prefix, specifier) => {
        const resolved = path.posix.normalize(path.posix.join(fromDirectory, specifier));
        const target = resolved.split("/")[0];

        // Within the same component directory (e.g. scroll/scroll-bar importing
        // ./use-state-ref): the file is copied alongside, so it stays relative.
        if (fromDirectory !== "." && target === fromDirectory.split("/")[0]) {
            return whole;
        }

        if (!ids.has(target)) {
            return whole;
        }

        deps.add(target);

        return `${prefix}"${aliasFor(target)}/${resolved}"`;
    });

    return { content: rewritten, deps };
};

/**
 * Registry sources must import the runtime through its published subpaths.
 * Anything reaching into `dist/`/`src/` or escaping upward would break the
 * moment it lands in a consumer repo, where neither resolves.
 * @param {string} content Source text.
 * @param {string} filePath Path used in messages.
 * @returns {string[]} Problems found.
 */
const findPrivateImports = (content, filePath) => {
    const problems = [];

    for (const { specifier } of collectSpecifiers(content)) {
        if (specifier.includes("@visulima/tui/dist/") || specifier.includes("@visulima/tui/src/")) {
            problems.push(`${filePath}: "${specifier}" reaches past the public export map`);
        }

        if (specifier.startsWith("../")) {
            problems.push(`${filePath}: unrewritten parent import "${specifier}" would not resolve once copied`);
        }
    }

    return problems;
};

const main = async () => {
    let meta = {};

    try {
        meta = JSON.parse(await readFile(path.join(packageRoot, "registry-meta.json"), "utf8"));
    } catch {
        // Metadata is optional; names fall back to titleised ids.
    }

    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    const ids = new Set(entries.map((entry) => (entry.isDirectory() ? entry.name : entry.name.replace(/\.(tsx|ts)$/, ""))));
    const items = [];
    const problems = [];

    await mkdir(outputDirectory, { recursive: true });

    for (const id of [...ids].filter((candidate) => !NOT_ITEMS.has(candidate)).sort()) {
        const relatives = await filesFor(id);
        const files = [];
        const deps = new Set();

        for (const relative of relatives) {
            const raw = await readFile(path.join(sourceDirectory, relative), "utf8");
            const { content, deps: fileDeps } = rewriteForRegistry(raw, relative, ids);

            for (const dep of fileDeps) {
                if (dep !== id) {
                    deps.add(dep);
                }
            }

            problems.push(...findPrivateImports(content, relative));

            const isLib = LIB_ITEMS.has(id);

            files.push({
                content,
                path: `registry/${isLib ? "lib" : "ui"}/${relative}`,
                target: `${isLib ? "lib" : "components/ui"}/${relative}`,
                type: isLib ? "registry:lib" : "registry:ui",
            });
        }

        const info = meta[id] ?? {};
        const npmDependencies = new Set(["@visulima/tui"]);

        for (const file of files) {
            for (const { dynamic, specifier } of collectSpecifiers(file.content)) {
                // Dynamic import() is how components reach optional peers (e.g.
                // qr-code's `qrcode`); deliberately excluded from the hard
                // `dependencies` so the shadcn CLI won't force-install them.
                if (dynamic) {
                    continue;
                }

                if (specifier.startsWith(".") || specifier.startsWith("@/") || specifier === "react" || specifier.startsWith("@visulima/tui/")) {
                    continue;
                }

                npmDependencies.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
            }
        }

        items.push({
            $schema: ITEM_SCHEMA,
            name: id,
            type: LIB_ITEMS.has(id) ? "registry:lib" : "registry:ui",
            title: info.title ?? titleise(id),
            description: info.description ?? `${titleise(id)} component for @visulima/tui.`,
            categories: info.categories ?? ["ui"],
            dependencies: [...npmDependencies].sort(),
            registryDependencies: [...deps].sort().map((dep) => `${BASE_URL}/${dep}.json`),
            files,
        });
    }

    if (problems.length > 0) {
        console.error("Registry build failed:\n");

        for (const problem of [...new Set(problems)]) {
            console.error(`  • ${problem}`);
        }

        process.exit(1);
    }

    for (const item of items) {
        await writeFile(path.join(outputDirectory, `${item.name}.json`), `${JSON.stringify(item, undefined, 2)}\n`, "utf8");
    }

    await writeFile(
        path.join(outputDirectory, "registry.json"),
        `${JSON.stringify(
            {
                $schema: REGISTRY_SCHEMA,
                name: REGISTRY_NAME,
                homepage: HOMEPAGE,
                items: items.map(({ categories, description, name, title, type }) => ({ categories, description, name, title, type })),
            },
            undefined,
            2,
        )}\n`,
        "utf8",
    );

    const withDeps = items.filter((item) => item.registryDependencies.length > 0).length;

    console.log(`Built ${items.length} registry items → ${path.relative(packageRoot, outputDirectory)} (${withDeps} with registry dependencies)`);
};

await main();
