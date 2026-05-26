import { isAccessibleSync, readFileSync, walkSync } from "@visulima/fs";
import { join } from "@visulima/path";

/**
 * A single Docker image reference picked from a Dockerfile or
 * docker-compose file. We keep the originating "context" so the applier
 * can do exact-string replacement: a Dockerfile `FROM` line and a
 * compose `image:` value have different formatting rules.
 */
export interface ImageReference {
    /** Full original reference token as it appeared in the file. */
    readonly original: string;
    /** Image namespace (`library` for unqualified). */
    readonly namespace: string;
    /** Image short name (e.g. `node` in `library/node`). */
    readonly name: string;
    /** Registry host. `docker.io` is the default; ghcr.io, mcr.microsoft.com etc. are kept verbatim. */
    readonly registry: string;
    /** Tag portion or `latest` when omitted. */
    readonly tag: string;
    /** Digest portion (`sha256:…`) when present, otherwise `undefined`. */
    readonly digest: string | undefined;
    /** Path of the file that the reference came from. */
    readonly file: string;
    /** 1-based line number for diagnostics. */
    readonly line: number;
    /** Origin file kind — drives the applier behaviour. */
    readonly kind: "dockerfile" | "compose";
    /** When set, the reference is excluded via `# vis-update-ignore` directive on the line. */
    readonly ignoreReason: string | undefined;
}

const DEFAULT_REGISTRY = "docker.io";

const SHA_PREFIX = "sha256:";

/**
 * Splits a docker image reference into its parts. Tolerates:
 *   - `image`
 *   - `image:tag`
 *   - `image@sha256:…`
 *   - `image:tag@sha256:…`
 *   - `registry.example.com:443/namespace/image:tag`
 *
 * Returns `undefined` for unparseable tokens (e.g. variable expansions
 * like `${IMAGE}`) so the caller can skip them quietly.
 */
export const parseImageReference = (raw: string): Omit<ImageReference, "file" | "line" | "kind" | "ignoreReason"> | undefined => {
    const trimmed = raw.trim();

    if (trimmed === "" || trimmed.startsWith("$") || trimmed.includes("${") || trimmed.includes("$(")) {
        return undefined;
    }

    let working = trimmed;
    let digest: string | undefined;

    const atIndex = working.indexOf("@" + SHA_PREFIX);

    if (atIndex >= 0) {
        digest = working.slice(atIndex + 1);
        working = working.slice(0, atIndex);
    }

    let registry = DEFAULT_REGISTRY;
    let pathPart = working;

    // The first `/`-delimited segment is a registry if it contains a
    // `.` (e.g. `ghcr.io`), a `:` (port), or is `localhost`.
    const slashIndex = working.indexOf("/");

    if (slashIndex > 0) {
        const head = working.slice(0, slashIndex);

        if (head === "localhost" || head.includes(".") || head.includes(":")) {
            registry = head;
            pathPart = working.slice(slashIndex + 1);
        }
    }

    let tag = "latest";
    let nameWithNamespace = pathPart;

    const colonIndex = pathPart.lastIndexOf(":");
    // Beware: a registry like `localhost:5000` was already split off above.
    if (colonIndex >= 0 && !pathPart.slice(colonIndex).includes("/")) {
        tag = pathPart.slice(colonIndex + 1);
        nameWithNamespace = pathPart.slice(0, colonIndex);
    }

    let namespace = "library";
    let name = nameWithNamespace;
    const namespaceSlash = nameWithNamespace.indexOf("/");

    if (namespaceSlash >= 0) {
        namespace = nameWithNamespace.slice(0, namespaceSlash);
        name = nameWithNamespace.slice(namespaceSlash + 1);
    }

    if (name === "") {
        return undefined;
    }

    return {
        digest,
        name,
        namespace,
        original: trimmed,
        registry,
        tag,
    };
};

const IGNORE_NEXT_RE = /vis-update-ignore-next-line/i;
const IGNORE_INLINE_RE = /vis-update-ignore(?:\s|$|:)/i;

/**
 * True when the line is a comment-only line (the `# vis-update-ignore-next-line`
 * directive is *meant* to live on a line by itself, the way `eslint-disable-next-line`
 * does). When the marker appears as a trailing comment on a real `FROM` /
 * `uses:` line we treat it as the inline (this-line) ignore form instead —
 * otherwise the line below silently inherits the ignore.
 */
const isCommentOnlyLine = (line: string): boolean => {
    const trimmed = line.trim();

    return trimmed === "" || trimmed.startsWith("#");
};

/**
 * Regex for a Dockerfile `FROM` line. Captures the image reference and
 * an optional trailing alias. Multi-stage builds use
 * `FROM base AS stage` — `AS` is captured separately so it round-trips.
 *
 * BuildKit allows flags before the image (`FROM --platform=$BUILDPLATFORM node:18`).
 * The leading `(?:--\S+\s+)*` consumes any number of `--key=value` flags
 * so the image captured in group 2 is the actual image, not the flag.
 */
const FROM_LINE_RE = /^(\s*FROM\s+(?:--\S+\s+)*)([^\s#]+)(\s+AS\s+\S+)?(\s*#.*)?$/i;

const extractFromDockerfile = (filePath: string, content: string): ImageReference[] => {
    const lines = content.split(/\r?\n/);
    const references: ImageReference[] = [];

    let pendingIgnore = false;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? "";

        // The next-line directive must live on its own line. When the
        // marker appears on a `FROM` line itself it's the inline form —
        // handled below via IGNORE_INLINE_RE on the trailing comment.
        if (IGNORE_NEXT_RE.test(line) && isCommentOnlyLine(line)) {
            pendingIgnore = true;

            continue;
        }

        const match = FROM_LINE_RE.exec(line);

        if (!match) {
            // Reset the lookahead on any non-FROM, non-comment line so a
            // stray ignore-next-line doesn't leak.
            if (line.trim() !== "" && !line.trim().startsWith("#")) {
                pendingIgnore = false;
            }

            continue;
        }

        const value = match[2] ?? "";

        // `FROM scratch` has no upstream to update against.
        if (value === "scratch") {
            pendingIgnore = false;

            continue;
        }

        const trailingComment = match[4]?.trim();
        let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

        if (trailingComment && IGNORE_NEXT_RE.test(trailingComment)) {
            // `# vis-update-ignore-next-line` on the same line as the
            // ref collapses to an inline (this-line) ignore — there is
            // no "next line" to attach to, and the user clearly meant
            // THIS one.
            ignoreReason = ignoreReason ?? "vis-update-ignore-next-line";
        } else if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
            ignoreReason = ignoreReason ?? "vis-update-ignore";
        }

        const parsed = parseImageReference(value);

        pendingIgnore = false;

        if (!parsed) {
            continue;
        }

        references.push({
            ...parsed,
            file: filePath,
            ignoreReason,
            kind: "dockerfile",
            line: index + 1,
        });
    }

    return references;
};

/**
 * Compose files can express the image in two ways:
 *   - top-level `image: name:tag`
 *   - inside `services.<name>.image: name:tag`
 *
 * We keep the line-based extractor to preserve quoting and indentation
 * exactly. The regex matches both `key: value` and `key: "value"` forms.
 */
const COMPOSE_IMAGE_RE = /^(\s*image:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const extractFromCompose = (filePath: string, content: string): ImageReference[] => {
    const lines = content.split(/\r?\n/);
    const references: ImageReference[] = [];

    let pendingIgnore = false;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? "";

        if (IGNORE_NEXT_RE.test(line) && isCommentOnlyLine(line)) {
            pendingIgnore = true;

            continue;
        }

        const match = COMPOSE_IMAGE_RE.exec(line);

        if (!match) {
            if (line.trim() !== "" && !line.trim().startsWith("#")) {
                pendingIgnore = false;
            }

            continue;
        }

        const value = match[3] ?? "";
        const trailingComment = match[4]?.trim();
        let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

        if (trailingComment && IGNORE_NEXT_RE.test(trailingComment)) {
            // `# vis-update-ignore-next-line` on the same line as the
            // ref collapses to an inline (this-line) ignore — there is
            // no "next line" to attach to, and the user clearly meant
            // THIS one.
            ignoreReason = ignoreReason ?? "vis-update-ignore-next-line";
        } else if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
            ignoreReason = ignoreReason ?? "vis-update-ignore";
        }

        const parsed = parseImageReference(value);

        pendingIgnore = false;

        if (!parsed) {
            continue;
        }

        references.push({
            ...parsed,
            file: filePath,
            ignoreReason,
            kind: "compose",
            line: index + 1,
        });
    }

    return references;
};

const isDockerfile = (name: string): boolean => {
    const lower = name.toLowerCase();

    if (lower === "dockerfile") {
        return true;
    }

    if (lower.startsWith("dockerfile.")) {
        return true;
    }

    return lower.endsWith(".dockerfile");
};

const isComposeFile = (name: string): boolean => {
    const lower = name.toLowerCase();

    return /^(?:docker-)?compose(?:\..+)?\.ya?ml$/.test(lower);
};

const SKIP_DIRS = new Set([".git", "node_modules", ".pnpm-store", ".turbo", ".nx", "dist", "build", ".cache"]);

// `walkSync` runs `skip` patterns against the full resolved path, not the
// entry name alone. Match any path segment so e.g. `…/node_modules/sub/…`
// is pruned.
const SKIP_RE = /(?:^|\/)(?:\.git|node_modules|\.pnpm-store|\.turbo|\.nx|dist|build|\.cache)(?:\/|$)/;

/**
 * Scans the workspace for Dockerfiles (any case, any suffix) and compose
 * files (`compose.yml`, `docker-compose.yml`, `compose.prod.yml`, …).
 * Walks the tree skipping the usual heavy directories so a big monorepo
 * doesn't pay the cost of descending into `node_modules`.
 */
export const scanDockerRepository = (workspaceRoot: string): ImageReference[] => {
    const references: ImageReference[] = [];

    if (!isAccessibleSync(workspaceRoot)) {
        return references;
    }

    const collect = (absolutePath: string, kind: "dockerfile" | "compose"): void => {
        let content: string;

        try {
            content = readFileSync(absolutePath);
        } catch {
            return;
        }

        references.push(...(kind === "dockerfile" ? extractFromDockerfile(absolutePath, content) : extractFromCompose(absolutePath, content)));
    };

    for (const entry of walkSync(workspaceRoot, { includeDirs: false, includeSymlinks: false, skip: [SKIP_RE] })) {
        const { name } = entry;

        if (SKIP_DIRS.has(name)) {
            continue;
        }

        if (isDockerfile(name)) {
            collect(entry.path, "dockerfile");
        } else if (isComposeFile(name)) {
            collect(entry.path, "compose");
        }
    }

    // Top-level shortcut so we always find the root files even when the
    // walker doesn't expose them (defensive for symlink edge cases).
    for (const candidate of ["Dockerfile", "dockerfile", "compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"]) {
        const path = join(workspaceRoot, candidate);

        if (isAccessibleSync(path)) {
            const seen = references.some((reference) => reference.file === path);

            if (!seen) {
                collect(path, isDockerfile(candidate) ? "dockerfile" : "compose");
            }
        }
    }

    return references;
};
