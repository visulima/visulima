/**
 * Ignore-file pattern generator for production build contexts.
 *
 * Inspired by Kikobeats/untracked, but reimplemented dependency-free and
 * monorepo-aware. Produces gitignore-format patterns for the common
 * deploy/publish targets and — crucially — merges into an existing file
 * WITHOUT adding entries that are already present (no duplicate names).
 */

export type IgnoreTarget = "docker" | "npm" | "slug" | "vercel";

/** Maps a target to the conventional ignore-file name. */
export const IGNORE_FILENAMES: Record<IgnoreTarget, string> = {
    docker: ".dockerignore",
    npm: ".npmignore",
    slug: ".slugignore",
    vercel: ".vercelignore",
};

/**
 * Curated base patterns shared by every target: docs, editor/CI config,
 * type-defs and source maps, test files, and coverage. Deliberately
 * compact (and case-sensitive, as gitignore requires) rather than the
 * hundreds of generated case/extension permutations untracked emits.
 */
const BASE_PATTERNS: string[] = [
    // version control / editor / OS
    ".git",
    ".gitattributes",
    ".gitignore",
    ".editorconfig",
    ".vscode/",
    ".idea/",
    ".DS_Store",
    // docs
    "*.md",
    "LICENSE*",
    "LICENCE*",
    "CHANGELOG*",
    "CONTRIBUTING*",
    "AUTHORS*",
    "docs/",
    "doc/",
    "examples/",
    "example/",
    // tooling / CI config
    ".github/",
    ".gitlab-ci.yml",
    ".circleci/",
    "appveyor.yml",
    ".eslintrc*",
    "eslint.config.*",
    ".prettierrc*",
    "prettier.config.*",
    "*.log",
    "npm-debug.log*",
    // build inputs not needed at runtime
    "*.d.ts",
    "*.map",
    "*.flow",
    "tsconfig*.json",
    // tests
    "__tests__/",
    "__mocks__/",
    "test/",
    "tests/",
    "*.test.*",
    "*.spec.*",
    "coverage/",
    ".nyc_output/",
];

/** Patterns appended only for targets that copy a real working tree. */
const TARGET_EXTRAS: Record<IgnoreTarget, string[]> = {
    // Docker builds inside the image, so node_modules/.vis are rebuilt and
    // should never be sent in the build context.
    docker: ["node_modules", ".vis/", "Dockerfile*", ".dockerignore"],
    // npm auto-excludes node_modules from the published tarball; don't list it.
    npm: [],
    slug: ["node_modules"],
    vercel: ["node_modules", ".vercel/"],
};

/**
 * Builds the full ordered, de-duplicated pattern list for a target.
 * @param target Ignore-file flavour.
 */
export const buildIgnorePatterns = (target: IgnoreTarget): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const pattern of [...BASE_PATTERNS, ...TARGET_EXTRAS[target]]) {
        if (!seen.has(pattern)) {
            seen.add(pattern);
            result.push(pattern);
        }
    }

    return result;
};

/** Strips inline comments / whitespace to compare a line as a bare pattern. */
const normalizeLine = (line: string): string => line.trim();

export interface MergeIgnoreResult {
    /** New entries actually appended (already-present ones are skipped). */
    added: string[];
    /** Full file content to write. */
    content: string;
}

const VIS_SECTION_HEADER = "# Added by vis ignore";

/**
 * Merges `patterns` into existing ignore-file content, appending only the
 * patterns not already present (verbatim, case-sensitive). Existing
 * content — including comments and ordering — is preserved untouched.
 * @param existing Current file content (empty string if the file is new).
 * @param patterns Candidate patterns to ensure are present.
 */
export const mergeIgnore = (existing: string, patterns: string[]): MergeIgnoreResult => {
    const present = new Set<string>();

    for (const line of existing.split(/\r?\n/u)) {
        const normalized = normalizeLine(line);

        if (normalized !== "" && !normalized.startsWith("#")) {
            present.add(normalized);
        }
    }

    const added: string[] = [];

    for (const pattern of patterns) {
        if (!present.has(pattern)) {
            present.add(pattern);
            added.push(pattern);
        }
    }

    if (added.length === 0) {
        return { added, content: existing };
    }

    const eol = existing.includes("\r\n") ? "\r\n" : "\n";
    const block = [VIS_SECTION_HEADER, ...added].join(eol);

    if (existing.trim() === "") {
        return { added, content: `${block}${eol}` };
    }

    const separator = existing.endsWith("\n") ? eol : `${eol}${eol}`;

    return { added, content: `${existing}${separator}${block}${eol}` };
};
