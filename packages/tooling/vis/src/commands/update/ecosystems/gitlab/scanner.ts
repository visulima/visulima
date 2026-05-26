import { isAccessibleSync, readFileSync, walkSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { ImageReference } from "../docker/scanner";
import { parseImageReference } from "../docker/scanner";

/**
 * A GitLab CI `include` reference. Both inline ref (`include: { project,
 * ref }`) and component (`include: { component }`) forms are captured.
 * Files referenced by `include:` are NOT recursively scanned — we
 * deliberately stop at the top-level file because the include target
 * lives in another repo and we have no checked-out copy to walk.
 */
export interface GitLabInclude {
    /** Full `project` path (`group/subgroup/project`) or `component` host path. */
    readonly project: string;
    /** Current ref (tag, branch, or SHA). */
    readonly ref: string;
    /** Origin file. */
    readonly file: string;
    /** Line where the `ref:` value sits — used by the applier as the rewrite anchor. */
    readonly line: number;
    /** Original ref token (with surrounding quotes if present). */
    readonly original: string;
    /** `include: { component: gitlab.com/foo/bar/baz@1.2.3 }` form. */
    readonly kind: "component" | "project";
    /** When set, the include was excluded by a `# vis-update-ignore` directive. */
    readonly ignoreReason: string | undefined;
}

const IGNORE_NEXT_RE = /vis-update-ignore-next-line/i;
const IGNORE_INLINE_RE = /vis-update-ignore(?:\s|$|:)/i;

const GITLAB_CI_FILES = new Set([".gitlab-ci.yml", ".gitlab-ci.yaml"]);

const isGitlabCiFile = (name: string): boolean => GITLAB_CI_FILES.has(name) || name.endsWith(".gitlab-ci.yml") || name.endsWith(".gitlab-ci.yaml");

/**
 * Detects `include:` blocks of the shape:
 *
 *     include:
 *       - project: group/project
 *         ref: 'v1.2.3'
 *         file: '/templates/x.yml'
 *
 * We perform a small line-by-line state machine because YAML wouldn't
 * give us the original ref formatting. The state machine remembers the
 * most recent `project:` so we can attribute the trailing `ref:` to it.
 */
const PROJECT_RE = /^(\s*-?\s*project:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const REF_RE = /^(\s*ref:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const COMPONENT_RE = /^(\s*-?\s*component:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const IMAGE_RE = /^(\s*image:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

/**
 * Limited services-list parser: matches a line of the form
 * `- name: postgres:14` (inside a `services:` block) or a bare `- postgres:14`.
 */
const SERVICE_NAME_RE = /^(\s*-\s*name:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const SERVICE_BARE_RE = /^(\s*-\s*)(['"]?)([^'"\s#:]+:[^'"\s#]+)\2(\s*#.*)?$/;

export const extractFromGitlabCi = (filePath: string, content: string): { includes: GitLabInclude[]; images: ImageReference[] } => {
    const lines = content.split(/\r?\n/);
    const includes: GitLabInclude[] = [];
    const images: ImageReference[] = [];

    let pendingProject: { project: string; line: number } | undefined;
    let pendingIgnore = false;
    let insideServices = false;
    let servicesIndent = -1;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? "";
        const trimmed = line.trim();
        const trimmedIsCommentOnly = trimmed === "" || trimmed.startsWith("#");

        // The next-line directive must live on its own line — when it's a
        // trailing comment on an `image:` / `ref:` line, it's the inline
        // form (handled by IGNORE_INLINE_RE below) and the directive
        // mustn't leak to the line that follows.
        if (IGNORE_NEXT_RE.test(line) && trimmedIsCommentOnly) {
            pendingIgnore = true;
            continue;
        }

        // `services:` can appear at any indentation — per-job nested
        // blocks (`test:\n  services:\n    - postgres:14`) are the
        // canonical form. The previous `^services:` anchor missed them
        // and left `insideServices` stuck at `false`.
        const servicesMatch = /^(\s*)services:\s*(?:#.*)?$/.exec(line);

        if (servicesMatch) {
            insideServices = true;
            servicesIndent = servicesMatch[1]?.length ?? 0;
            continue;
        }

        if (insideServices && trimmed !== "" && !trimmed.startsWith("-") && !trimmed.startsWith("#")) {
            const indent = line.search(/\S/);

            if (indent <= servicesIndent) {
                insideServices = false;
                servicesIndent = -1;
            }
        }

        // image: scalar form
        const imageMatch = IMAGE_RE.exec(line);

        if (imageMatch) {
            const value = imageMatch[3] ?? "";
            const parsed = parseImageReference(value);

            if (parsed) {
                const trailingComment = imageMatch[4]?.trim();
                let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

                if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                    ignoreReason = ignoreReason ?? "vis-update-ignore";
                }

                images.push({
                    ...parsed,
                    file: filePath,
                    ignoreReason,
                    kind: "compose",
                    line: index + 1,
                });
            }

            pendingIgnore = false;
            continue;
        }

        // services: with explicit `- name:` form
        if (insideServices) {
            const nameMatch = SERVICE_NAME_RE.exec(line);
            const bareMatch = nameMatch ? undefined : SERVICE_BARE_RE.exec(line);
            const match = nameMatch ?? bareMatch;

            if (match) {
                const value = match[3] ?? "";
                const parsed = parseImageReference(value);

                if (parsed) {
                    const trailingComment = match[4]?.trim();
                    let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

                    if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                        ignoreReason = ignoreReason ?? "vis-update-ignore";
                    }

                    images.push({
                        ...parsed,
                        file: filePath,
                        ignoreReason,
                        kind: "compose",
                        line: index + 1,
                    });
                }
            }
        }

        const projectMatch = PROJECT_RE.exec(line);

        if (projectMatch) {
            pendingProject = { line: index + 1, project: projectMatch[3] ?? "" };
            // Deliberately keep `pendingIgnore` alive across project: lines
            // — a `# vis-update-ignore-next-line` on the previous line
            // should apply to the whole include block, not just the
            // project: line (which we don't rewrite anyway).
            continue;
        }

        const refMatch = REF_RE.exec(line);

        if (refMatch && pendingProject) {
            const trailingComment = refMatch[4]?.trim();
            let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

            if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                ignoreReason = ignoreReason ?? "vis-update-ignore";
            }

            includes.push({
                file: filePath,
                ignoreReason,
                kind: "project",
                line: index + 1,
                original: refMatch[3] ?? "",
                project: pendingProject.project,
                ref: refMatch[3] ?? "",
            });

            pendingProject = undefined;
            pendingIgnore = false;
            continue;
        }

        const componentMatch = COMPONENT_RE.exec(line);

        if (componentMatch) {
            const raw = componentMatch[3] ?? "";
            const atIndex = raw.lastIndexOf("@");

            if (atIndex > 0) {
                const project = raw.slice(0, atIndex);
                const ref = raw.slice(atIndex + 1);
                const trailingComment = componentMatch[4]?.trim();
                let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

                if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                    ignoreReason = ignoreReason ?? "vis-update-ignore";
                }

                includes.push({
                    file: filePath,
                    ignoreReason,
                    kind: "component",
                    line: index + 1,
                    original: raw,
                    project,
                    ref,
                });
            }

            pendingIgnore = false;
            continue;
        }

        if (trimmed !== "" && !trimmed.startsWith("#")) {
            pendingIgnore = false;
        }
    }

    return { images, includes };
};

const SKIP_RE = /^(?:\.git|node_modules|\.pnpm-store|\.turbo|\.nx|dist|build|\.cache)$/;

export const scanGitlabRepository = (workspaceRoot: string): { includes: GitLabInclude[]; images: ImageReference[] } => {
    const allIncludes: GitLabInclude[] = [];
    const allImages: ImageReference[] = [];

    if (!isAccessibleSync(workspaceRoot)) {
        return { images: allImages, includes: allIncludes };
    }

    const collect = (path: string): void => {
        let content: string;

        try {
            content = readFileSync(path);
        } catch {
            return;
        }

        const { images, includes } = extractFromGitlabCi(path, content);

        allIncludes.push(...includes);
        allImages.push(...images);
    };

    // Root .gitlab-ci.yml — by far the common case.
    for (const candidate of [".gitlab-ci.yml", ".gitlab-ci.yaml"]) {
        const path = join(workspaceRoot, candidate);

        if (isAccessibleSync(path)) {
            collect(path);
        }
    }

    // .gitlab/ci/**/*.yml — common pattern for split pipelines.
    const gitlabDir = join(workspaceRoot, ".gitlab");

    if (isAccessibleSync(gitlabDir)) {
        for (const entry of walkSync(gitlabDir, { includeDirs: false, includeSymlinks: false, skip: [SKIP_RE] })) {
            if (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")) {
                collect(entry.path);
            }
        }
    }

    // Anything else named `*.gitlab-ci.yml` at the top level.
    for (const entry of walkSync(workspaceRoot, { includeDirs: false, includeSymlinks: false, maxDepth: 2, skip: [SKIP_RE] })) {
        if (isGitlabCiFile(entry.name) && !allImages.some((image) => image.file === entry.path) && !allIncludes.some((include) => include.file === entry.path)) {
            collect(entry.path);
        }
    }

    return { images: allImages, includes: allIncludes };
};
