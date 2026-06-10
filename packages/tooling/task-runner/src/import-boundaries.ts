import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";

import { join, relative, resolve } from "@visulima/path";

import type { ConstraintViolation, ProjectGraph } from "./types";
import { collectFiles, readPackageDeps } from "./utils";

/**
 * Policy controlling the import-boundary analyzer. Mirrors the
 * `boundaries` block sketched in the RFC, but lives here so the module
 * stays self-contained. Both `allow*` toggles default to `false`
 * (strict) — flip them to silence a class of violation wholesale.
 */
export interface BoundariesConfig {
    /**
     * When `true`, deep imports past a workspace package's public entry
     * (e.g. `@app/core/src/internal`) are not flagged.
     * @default false
     */
    allowDeepImports?: boolean;

    /**
     * When `true`, bare imports of packages absent from the importing
     * package's `package.json` are not flagged.
     * @default false
     */
    allowUndeclaredDependencies?: boolean;

    /**
     * Glob patterns (workspace-root-relative, forward-slash) for source
     * files to skip entirely. Supports `*`, `**`, and `?`.
     */
    ignore?: string[];
}

/**
 * Options for {@link checkImportBoundaries}. The workspace root is
 * required because project nodes carry only workspace-relative roots,
 * while the file scan and resolution work on absolute paths.
 */
export interface CheckImportBoundariesOptions extends BoundariesConfig {
    /** Absolute path to the workspace root. */
    workspaceRoot: string;
}

/**
 * An import-boundary violation. Structurally a {@link ConstraintViolation}
 * (so it slots into the same reporting path as `enforceProjectConstraints`)
 * but with a dedicated `rule` value. Defined here rather than in
 * `types.ts` so this analyzer stays self-contained; the `rule` field is
 * widened with the existing constraint rules to stay assignable to
 * `ConstraintViolation` consumers.
 */
export interface ImportBoundaryViolation extends Omit<ConstraintViolation, "rule"> {
    rule: ConstraintViolation["rule"] | "import-boundary";
}

/** Directories never worth scanning for source imports. */
const IGNORED_DIRECTORIES = new Set([".git", ".nx", ".turbo", "coverage", "dist", "node_modules"]);

/** File extensions whose contents we scan for import specifiers. */
const SOURCE_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

/**
 * Node builtin module set, including the `node:` prefixed forms. Built
 * once from {@link builtinModules} so the list tracks the running Node.
 */
const NODE_BUILTINS = new Set<string>([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/** A single extracted import, with whether it was type-only. */
interface ExtractedSpecifier {
    specifier: string;
    typeOnly: boolean;
}

/**
 * Strips line and block comments from source so commented-out imports
 * don't get flagged. Intentionally simple — it leaves string contents
 * untouched, which is fine because we only ever match import/require
 * shapes afterwards.
 */
const stripComments = (source: string): string =>
    source.replaceAll(/\/\*[\s\S]*?\*\//g, " ").replaceAll(/(^|[^:])\/\/[^\n]*/g, "$1");

// import ... from "x" / export ... from "x". Capture group 1 is the clause
// between the keyword and `from` (used to detect a leading `type` modifier);
// the character class excludes `;`, quotes, and braces' separators so the
// quantifiers cannot exchange characters (no super-linear backtracking).
const FROM_RE = /\b(?:import|export)(\s[^;"'`]*?)from\s+["']([^"']+)["']/g;
// side-effect import: import "x"
const BARE_IMPORT_RE = /\bimport\s+["']([^"']+)["']/g;
// dynamic import("x")
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
// require("x")
const REQUIRE_RE = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
// Leading `type` modifier in an import/export clause.
const TYPE_CLAUSE_RE = /^\s*type\b/;

/**
 * Extracts import/require specifiers from a single source file's text.
 * Conservative by design: it only matches the canonical static/dynamic
 * import and require shapes and skips `import type` (not a runtime dep).
 */
const extractSpecifiers = (source: string): ExtractedSpecifier[] => {
    const cleaned = stripComments(source);
    const found: ExtractedSpecifier[] = [];

    for (const match of cleaned.matchAll(FROM_RE)) {
        const clause = match[1] ?? "";

        found.push({ specifier: match[2] as string, typeOnly: TYPE_CLAUSE_RE.test(clause) });
    }

    for (const regex of [BARE_IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
        for (const match of cleaned.matchAll(regex)) {
            found.push({ specifier: match[1] as string, typeOnly: false });
        }
    }

    return found;
};

/**
 * Splits a bare specifier into its package name and the remaining
 * subpath. `@scope/pkg/a/b` -> `{ pkg: "@scope/pkg", subpath: "a/b" }`;
 * `lodash/fp` -> `{ pkg: "lodash", subpath: "fp" }`.
 */
const splitBareSpecifier = (specifier: string): { pkg: string; subpath: string } => {
    const segments = specifier.split("/");

    if (specifier.startsWith("@")) {
        const pkg = segments.slice(0, 2).join("/");

        return { pkg, subpath: segments.slice(2).join("/") };
    }

    return { pkg: segments[0] as string, subpath: segments.slice(1).join("/") };
};

/**
 * Converts a glob (supporting `*`, `**`, `?`) into an anchored RegExp.
 */
const globToRegExp = (glob: string): RegExp => {
    let out = "";

    for (let index = 0; index < glob.length; index += 1) {
        const char = glob.charAt(index);

        if (char === "*") {
            if (glob.charAt(index + 1) === "*") {
                out += ".*";
                index += 1;

                // consume a trailing slash in `**/`
                if (glob.charAt(index + 1) === "/") {
                    index += 1;
                }
            } else {
                out += "[^/]*";
            }
        } else if (char === "?") {
            out += "[^/]";
        } else if (".+^${}()|[]\\".includes(char)) {
            out += `\\${char}`;
        } else {
            out += char;
        }
    }

    return new RegExp(`^${out}$`);
};

/** True when `relativePath` (forward-slash) matches any ignore glob. */
const isIgnored = (relativePath: string, ignoreRegexps: RegExp[]): boolean =>
    ignoreRegexps.some((regex) => regex.test(relativePath));

/**
 * Determines whether a workspace dependency name resolves to a project
 * in the graph. Maps package names to project roots via the graph nodes.
 */
const buildWorkspacePackageRoots = (projectGraph: ProjectGraph): Map<string, string> => {
    const roots = new Map<string, string>();

    for (const node of Object.values(projectGraph.nodes)) {
        roots.set(node.name, node.data.root);
    }

    return roots;
};

/**
 * Scans a project's source files for import-boundary violations.
 *
 * Flags three high-confidence classes:
 * 1. bare imports of packages not in the package's `package.json`
 *    (and not a Node builtin) — "undeclared dependency";
 * 2. deep imports past a declared workspace package's public entry —
 *    "deep import";
 * 3. relative imports that resolve outside the package directory —
 *    "out-of-package import".
 *
 * All three are emitted as {@link ConstraintViolation} with
 * `rule: "import-boundary"` so reporting stays unified with
 * `enforceProjectConstraints`. Pure: no logging, no process side effects.
 * @param projectGraph The workspace project graph to validate.
 * @param options Workspace root plus the {@link BoundariesConfig} policy.
 * @returns Violations found. Empty means all imports respect their boundaries.
 */
const checkImportBoundaries = async (projectGraph: ProjectGraph, options: CheckImportBoundariesOptions): Promise<ImportBoundaryViolation[]> => {
    const { allowDeepImports = false, allowUndeclaredDependencies = false, ignore = [], workspaceRoot } = options;

    const violations: ImportBoundaryViolation[] = [];
    const ignoreRegexps = ignore.map((glob) => globToRegExp(glob));
    const workspacePackageRoots = buildWorkspacePackageRoots(projectGraph);

    for (const node of Object.values(projectGraph.nodes)) {
        const projectName = node.name;
        const projectRootRelative = node.data.root;
        const projectRootAbsolute = resolve(workspaceRoot, projectRootRelative);

        // eslint-disable-next-line no-await-in-loop
        const declaredDeps = (await readPackageDeps(join(projectRootAbsolute, "package.json"))) ?? new Set<string>();

        // eslint-disable-next-line no-await-in-loop
        const files = await collectFiles(projectRootAbsolute, IGNORED_DIRECTORIES);

        for (const filePath of files) {
            const extensionIndex = filePath.lastIndexOf(".");
            const extension = extensionIndex === -1 ? "" : filePath.slice(extensionIndex);

            if (!SOURCE_EXTENSIONS.has(extension)) {
                continue;
            }

            const relativeToWorkspace = relative(workspaceRoot, filePath).replaceAll("\\", "/");

            if (isIgnored(relativeToWorkspace, ignoreRegexps)) {
                continue;
            }

            let source: string;

            try {
                // eslint-disable-next-line no-await-in-loop
                source = await readFile(filePath, "utf8");
            } catch {
                continue;
            }

            for (const { specifier, typeOnly } of extractSpecifiers(source)) {
                if (typeOnly) {
                    continue;
                }

                classifySpecifier({
                    allowDeepImports,
                    allowUndeclaredDependencies,
                    declaredDeps,
                    filePath,
                    projectName,
                    projectRootAbsolute,
                    relativeToWorkspace,
                    specifier,
                    violations,
                    workspacePackageRoots,
                });
            }
        }
    }

    return violations;
};

interface ClassifyContext {
    allowDeepImports: boolean;
    allowUndeclaredDependencies: boolean;
    declaredDeps: Set<string>;
    filePath: string;
    projectName: string;
    projectRootAbsolute: string;
    relativeToWorkspace: string;
    specifier: string;
    violations: ImportBoundaryViolation[];
    workspacePackageRoots: Map<string, string>;
}

/**
 * Classifies a single specifier and pushes a violation onto
 * `context.violations` when a high-confidence boundary breach is found.
 */
const classifySpecifier = (context: ClassifyContext): void => {
    const {
        allowDeepImports,
        allowUndeclaredDependencies,
        declaredDeps,
        filePath,
        projectName,
        projectRootAbsolute,
        relativeToWorkspace,
        specifier,
        violations,
        workspacePackageRoots,
    } = context;

    // Relative import — must resolve inside the package directory.
    if (specifier.startsWith(".")) {
        const fileDirectory = filePath.slice(0, Math.max(0, filePath.lastIndexOf("/")));
        const resolved = resolve(fileDirectory, specifier);
        const insideRelative = relative(projectRootAbsolute, resolved);

        if (insideRelative.startsWith("..") || insideRelative.startsWith("../")) {
            violations.push({
                dependencyProject: specifier,
                message: `File "${relativeToWorkspace}" imports "${specifier}", which resolves outside the package directory of "${projectName}". Relative imports must stay within the package; depend on the other package explicitly instead.`,
                rule: "import-boundary",
                sourceProject: projectName,
            });
        }

        return;
    }

    // Bare specifier.
    const { pkg, subpath } = splitBareSpecifier(specifier);

    if (NODE_BUILTINS.has(pkg) || NODE_BUILTINS.has(specifier)) {
        return;
    }

    const isDeclared = declaredDeps.has(pkg);

    if (!isDeclared) {
        if (!allowUndeclaredDependencies) {
            violations.push({
                dependencyProject: pkg,
                message: `File "${relativeToWorkspace}" imports "${specifier}", but "${pkg}" is not declared in the dependencies of "${projectName}". Add it to package.json or remove the import — phantom dependencies break on a clean install.`,
                rule: "import-boundary",
                sourceProject: projectName,
            });
        }

        return;
    }

    // Declared workspace package reached past its public entry via a subpath.
    if (!allowDeepImports && subpath !== "" && workspacePackageRoots.has(pkg)) {
        violations.push({
            dependencyProject: pkg,
            message: `File "${relativeToWorkspace}" deep-imports "${specifier}", reaching past the public entry of workspace package "${pkg}". Import from "${pkg}" directly; deep imports bypass its API boundary.`,
            rule: "import-boundary",
            sourceProject: projectName,
        });
    }
};

export { checkImportBoundaries };
