/**
 * Moon-format template adapter.
 *
 * Loads a directory matching moon's template layout
 * (`template.yml` + a tree of files / partials / assets) and synthesises
 * a `Template` (the same shape native vis templates export).
 *
 * The adapter pre-reads every template file at load time and parses
 * the AST once. Per-run the renderer evaluates the AST against the
 * resolved options scope — no further disk I/O.
 */

import { readFileSync, walkSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join, relative } from "@visulima/path";
import { parse as parseYaml } from "yaml";

import { pail } from "../../io/logger";
import type { Creation, CreationDirectory, CreationFile, FileMeta, Template, TemplateContext, Variable, VariableMap } from "../types";
import { interpolateFilename, isPartialPath, stripRawSuffix, stripTeraSuffix } from "./filename-interp";
import { splitFrontmatter } from "./frontmatter";
import type { Node } from "./tera-subset";
import { evaluateConditionExpression, parseTemplate, renderTemplate } from "./tera-subset";

// ── template.yml schema (subset of moon) ─────────────────────────

interface MoonVariableYaml {
    default?: unknown;
    internal?: boolean;
    multiple?: boolean;
    order?: number;
    prompt?: string;
    required?: boolean;
    type: "array" | "boolean" | "enum" | "number" | "string";
    values?: string[];
}

interface MoonTemplateYaml {
    description?: string;
    destination?: string;
    title?: string;
    variables?: Record<string, MoonVariableYaml>;
}

const TEMPLATE_FILENAME = "template.yml";
const RAW_SUFFIX = ".raw";

/**
 * Files outside this set are treated as binary assets (copied verbatim
 * as Buffers, no Tera rendering).
 *
 * Extension-less files are text only when the basename matches a known
 * textual convention (Dockerfile, Makefile, LICENSE…). Arbitrary
 * extension-less files (e.g. a compiled binary at `./bin/tool`) default
 * to binary so a UTF-8 decode round-trip can't mangle the bytes.
 */
const TEXT_EXTENSIONS = new Set([
    ".cjs",
    ".css",
    ".env",
    ".gitattributes",
    ".gitignore",
    ".graphql",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".json5",
    ".jsonc",
    ".jsx",
    ".lock",
    ".md",
    ".mdx",
    ".mjs",
    ".prettierrc",
    ".raw",
    ".rs",
    ".scss",
    ".sh",
    ".sql",
    ".svg",
    ".tera",
    ".toml",
    ".ts",
    ".tsx",
    ".twig",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
]);

const BARE_TEXT_BASENAMES = new Set([
    "Brewfile",
    "CHANGELOG",
    "CODEOWNERS",
    "CONTRIBUTING",
    "COPYING",
    "Dockerfile",
    "Gemfile",
    "LICENCE",
    "LICENSE",
    "Makefile",
    "NOTICE",
    "Procfile",
    "Rakefile",
    "README",
    "VERSION",
]);

/**
 * Last-dot helper for path segments. Returns the lower-cased extension
 * (including the leading `.`) or an empty string.
 */
const lastDot = (path: string): string => {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const segment = slash === -1 ? path : path.slice(slash + 1);
    const dot = segment.lastIndexOf(".");

    if (dot === -1 || dot === 0) {
        return "";
    }

    return segment.slice(dot).toLowerCase();
};

const basename = (path: string): string => {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

    return slash === -1 ? path : path.slice(slash + 1);
};

const isLikelyText = (path: string): boolean => {
    const ext = lastDot(path);

    if (ext !== "") {
        return TEXT_EXTENSIONS.has(ext);
    }

    const name = basename(path);

    // Dotfiles without a second extension (`.gitignore`, `.env`) are
    // already covered by TEXT_EXTENSIONS via `lastDot`. A bare name
    // like `Dockerfile` hits here — allow the well-known set; anything
    // else is considered binary.
    return BARE_TEXT_BASENAMES.has(name);
};

interface PreparedFile {
    /** Buffer payload for binary assets; null for text. */
    binary: Buffer | null;
    /** True when the file ends in `.raw` and must skip Tera rendering. */
    isRaw: boolean;
    /** Raw text source for text files; null for binaries. */
    rawText: string | null;
    /** Path relative to the template root (with `.tera`/`.twig` still attached). */
    relativePath: string;
}

const yamlVariableToVariable = (variable: MoonVariableYaml): Variable => {
    const baseFields = {
        default: variable.default as Variable["default"],
        internal: variable.internal,
        order: variable.order,
        prompt: variable.prompt,
        required: variable.required,
    };

    switch (variable.type) {
        case "array": {
            return { ...baseFields, type: "array" };
        }
        case "boolean": {
            return { ...baseFields, default: typeof baseFields.default === "boolean" ? baseFields.default : undefined, type: "boolean" };
        }
        case "enum": {
            return {
                ...baseFields,
                multiple: variable.multiple,
                type: "enum",
                values: variable.values ?? [],
            };
        }
        case "number": {
            return { ...baseFields, type: "number" };
        }
        case "string": {
            return { ...baseFields, type: "string" };
        }
        default: {
            throw new Error(`Unsupported variable type "${String((variable as { type: unknown }).type)}"`);
        }
    }
};

/**
 * Canonicalise a path produced by frontmatter `to:` or bracket
 * interpolation: strip a leading `./`, convert `\` to `/`, collapse
 * runs of `/`. The runner flattens the `files` tree with `/` as the
 * only separator — any mismatch between the adapter's `meta` key and
 * the runner's `file.path` silently drops per-file metadata.
 */
const normalizeDestinationPath = (path: string): string => path.replaceAll("\\", "/").replace(/^\.\//, "").replaceAll(/\/+/g, "/");

const flattenFiles = (root: CreationDirectory, path: string, value: CreationFile): void => {
    const segments = path.split("/").filter(Boolean);

    if (segments.length === 0) {
        throw new Error(`Empty destination path for value`);
    }

    let cursor: CreationDirectory = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]!;
        const existing = cursor[segment];

        if (existing === undefined) {
            const created: CreationDirectory = {};

            cursor[segment] = created;
            cursor = created;
        } else if (typeof existing === "object" && !Buffer.isBuffer(existing)) {
            cursor = existing;
        } else {
            throw new TypeError(`Path conflict: "${segments.slice(0, index + 1).join("/")}" is both a file and a directory`);
        }
    }

    cursor[segments.at(-1)!] = value;
};

/**
 * Evaluate a frontmatter `if`/`skip` value using the Tera-subset
 * condition grammar. Non-strings pass through (booleans/numbers/null).
 * Strings are parsed as conditions — `var`, `not var`, `a == "b"`,
 * `a != "b"`, `a and b`, `a or b` — so moon templates with real
 * comparisons work as authors expect.
 */
const evaluateGate = (value: unknown, scope: Record<string, unknown>, source: string): boolean => {
    if (typeof value !== "string") {
        return truthyValue(value);
    }

    // Render any `{{ }}`/`{% %}` first so nested interpolations resolve
    // (`if: "{{ name }} == 'Button'"`) before the condition parser sees
    // the text.
    const rendered = value.includes("{{") || value.includes("{%") ? renderTemplate(value, { filename: `${source}#frontmatter`, scope }) : value;

    return evaluateConditionExpression(rendered, scope, `${source}#frontmatter`, 1);
};

const truthyValue = (value: unknown): boolean => {
    if (value === null || value === undefined || value === false || value === 0 || value === "") {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (typeof value === "string") {
        return value !== "false" && value !== "0";
    }

    return true;
};

/**
 * Load a moon-format template directory into a `Template`.
 * @param templateDir Absolute path to the directory containing `template.yml`.
 * @param name Stable name used by `vis generate &lt;name>` (used as a fallback
 * when `template.yml` omits `title`).
 */
export const loadMoonTemplate = (templateDir: string, name: string): Template => {
    const yamlPath = join(templateDir, TEMPLATE_FILENAME);
    const config = readYamlSync(yamlPath) as MoonTemplateYaml | undefined;

    if (!config || typeof config !== "object") {
        throw new Error(`${yamlPath}: must contain a YAML mapping`);
    }

    const options: VariableMap = {};

    if (config.variables) {
        for (const [key, value] of Object.entries(config.variables)) {
            options[key] = yamlVariableToVariable(value);
        }
    }

    const partialMap = new Map<string, Node[]>();
    const files: PreparedFile[] = [];

    for (const entry of walkSync(templateDir, { includeDirs: false, includeSymlinks: false })) {
        if (entry.path === yamlPath) {
            continue;
        }

        const relativePath = relative(templateDir, entry.path).replaceAll("\\", "/");

        if (relativePath === TEMPLATE_FILENAME) {
            continue;
        }

        if (isPartialPath(relativePath)) {
            const source = readFileSync(entry.path);
            const parsed = parseTemplate(source, relativePath);

            // Register the partial under multiple keys so templates can
            // `{% include "header" %}` (bare), `{% include "partials/header" %}`
            // (relative path), or use the full `[name].tera`-free path.
            // Collisions are warned about so two `_header.tera` files
            // in different directories don't silently shadow each other.
            for (const key of partialKeys(relativePath)) {
                if (partialMap.has(key)) {
                    const existing = partialMap.get(key);

                    // Only warn on genuine cross-file collisions; identical
                    // parse trees would be produced only by duplicate file
                    // reads which shouldn't happen inside a single walk.
                    if (existing !== parsed) {
                        pail.warn(
                            `partial name "${key}" is declared by multiple files — last one wins. Use distinct names or fully-qualified includes.`,
                        );
                    }
                }

                partialMap.set(key, parsed);
            }

            continue;
        }

        const isRaw = relativePath.endsWith(RAW_SUFFIX);

        if (isRaw) {
            const source = readFileSync(entry.path);

            files.push({ binary: null, isRaw: true, rawText: source, relativePath });
            continue;
        }

        if (isLikelyText(relativePath)) {
            const source = readFileSync(entry.path);

            files.push({ binary: null, isRaw: false, rawText: source, relativePath });
            continue;
        }

        const buffer = readFileSync(entry.path, { buffer: true });

        files.push({ binary: buffer, isRaw: false, rawText: null, relativePath });
    }

    const produce = (context: TemplateContext): Creation => {
        const scope: Record<string, unknown> = { ...context.builtins, ...context.options };
        const tree: CreationDirectory = {};
        const meta: Record<string, FileMeta> = {};

        for (const file of files) {
            const sourcePath = file.relativePath;
            let body: CreationFile;
            let frontmatterTo: string | undefined;
            let frontmatterForce = false;

            if (file.binary) {
                body = file.binary;
            } else if (file.isRaw) {
                // .raw files: copy verbatim (moon: frontmatter only
                // applies to text files that get rendered).
                body = file.rawText ?? "";
            } else {
                const original = file.rawText ?? "";
                const split = splitFrontmatter(original, (yaml) => parseYaml(yaml));

                if (split.frontmatter) {
                    if (split.frontmatter.skip !== undefined && evaluateGate(split.frontmatter.skip, scope, sourcePath)) {
                        continue;
                    }

                    if (split.frontmatter.if !== undefined && !evaluateGate(split.frontmatter.if, scope, sourcePath)) {
                        continue;
                    }

                    if (typeof split.frontmatter.to === "string") {
                        frontmatterTo = renderTemplate(split.frontmatter.to, {
                            filename: `${sourcePath}#frontmatter.to`,
                            partials: partialMap,
                            scope,
                        });
                    }

                    if (split.frontmatter.force === true) {
                        frontmatterForce = true;
                    }
                }

                body = renderTemplate(split.body, { filename: sourcePath, partials: partialMap, scope });
            }

            const destinationPath = normalizeDestinationPath(frontmatterTo ?? interpolateFilename(stripRawSuffix(sourcePath), scope));

            flattenFiles(tree, destinationPath, body);

            if (frontmatterForce) {
                meta[destinationPath] = { force: true };
            }
        }

        const creation: Creation = { files: tree };

        if (Object.keys(meta).length > 0) {
            creation.filesMeta = meta;
        }

        return creation;
    };

    return {
        about: { description: config.description ?? `Moon-format template at ${templateDir}`, name: config.title ?? name },
        destination: config.destination,
        options,
        produce,
    };
};

/**
 * Produce the set of `{% include %}` keys a partial at this relative
 * path should be reachable under.
 *
 * Given `partials/_header.tera`, the following keys are produced:
 * - `header`                  (bare basename, underscore stripped, suffix stripped).
 * - `_header`                 (bare basename, suffix stripped).
 * - `partials/header`         (relative path, underscore stripped).
 * - `partials/_header`        (relative path, suffix stripped).
 */
const partialKeys = (relativePath: string): string[] => {
    const withoutSuffix = stripTeraSuffix(relativePath);
    const base = basename(withoutSuffix);
    const keys = new Set<string>([base, withoutSuffix]);

    if (base.startsWith("_")) {
        keys.add(base.replace(/^_+/, ""));

        const directory = withoutSuffix.slice(0, withoutSuffix.length - base.length);

        keys.add(`${directory}${base.replace(/^_+/, "")}`);
    }

    return [...keys];
};
