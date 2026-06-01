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
    /**
     * Component-name segment for `kind === "component"`. The full
     * component path the user wrote is `${project}/${componentName}`; we
     * keep them split because the API lookup targets `project` but the
     * replacement we write back must include the component name.
     */
    readonly componentName?: string;
    /** Origin file. */
    readonly file: string;
    /** When set, the include was excluded by a `# vis-update-ignore` directive. */
    readonly ignoreReason: string | undefined;
    /** `include: { component: gitlab.com/foo/bar/baz@1.2.3 }` form. */
    readonly kind: "component" | "project";
    /** Line where the `ref:` value sits — used by the applier as the rewrite anchor. */
    readonly line: number;
    /** Original ref token (with surrounding quotes if present). */
    readonly original: string;

    /**
     * Project path used for tag-lookup (`group/subgroup/project`). For
     * component refs this is the parent project — the trailing
     * component-name segment is stored separately in `componentName`
     * because GitLab resolves tags against the project, not against the
     * component path.
     */
    readonly project: string;
    /** Current ref (tag, branch, or SHA). */
    readonly ref: string;
}

const IGNORE_NEXT_RE = /vis-update-ignore-next-line/i;
const IGNORE_INLINE_RE = /vis-update-ignore(?:\s|$|:)/i;

const GITLAB_CI_FILES = new Set([".gitlab-ci.yaml", ".gitlab-ci.yml"]);

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
const PROJECT_RE = /^\s*-?\s*project:\s*(['"]?)([^'"\s#]+)\1(?:\s*#.*)?$/;

const REF_RE = /^\s*ref:\s*(['"]?)([^'"\s#]+)\1(\s*#.*)?$/;

const COMPONENT_RE = /^\s*-?\s*component:\s*(['"]?)([^'"\s#]+)\1(\s*#.*)?$/;

const IMAGE_RE = /^\s*image:\s*(['"]?)([^'"\s#]+)\1(\s*#.*)?$/;

/**
 * Inline (flow-style) include mapping on a single line:
 *
 *     include: { project: 'foo/bar', ref: 'v1.2.3' }
 *     - { project: 'foo/bar', ref: 'main', file: '/x.yml' }
 *
 * We don't parse the brace content as full YAML — we just pull
 * `project: …` and `ref: …` out of the slice between the braces. A
 * line that's missing either key is treated as not-an-include and
 * dropped through to the rest of the state machine.
 */
const FLOW_LINE_RE = /^\s*(?:-\s*)?(?:include:\s*)?\{([^}]*)\}\s*(?:#.*)?$/;

const FLOW_PROJECT_RE = /project:\s*(['"]?)([^'"\s,}]+)\1/;

const FLOW_REF_RE = /ref:\s*(['"]?)([^'"\s,}]+)\1/;

const FLOW_COMPONENT_RE = /component:\s*(['"]?)([^'"\s,}]+)\1/;

/**
 * Limited services-list parser: matches a line of the form
 * `- name: postgres:14` (inside a `services:` block) or a bare `- postgres:14`.
 */
const SERVICE_NAME_RE = /^(\s*-\s*name:\s*)(['"]?)([^'"\s#]+)\2(\s*#.*)?$/;

const SERVICE_BARE_RE = /^(\s*-\s*)(['"]?)([^'"\s#:]+:[^'"\s#]+)\2(\s*#.*)?$/;

/**
 * YAML block-opener lines — a mapping key followed by no inline value
 * (the value lives on subsequent indented lines). Examples: `include:`,
 * `default:`, `before_script:`. These are structural and shouldn't
 * consume a pending `# vis-update-ignore-next-line` directive, otherwise
 * the directive gets eaten by the `include:` line and never reaches the
 * `project:` / `ref:` that follows.
 */
const BLOCK_OPENER_RE = /^\s*-?\s*[a-z_][\w-]*:\s*(?:#.*)?$/i;

export const extractFromGitlabCi = (filePath: string, content: string): { images: ImageReference[]; includes: GitLabInclude[] } => {
    const lines = content.split(/\r?\n/);
    const includes: GitLabInclude[] = [];
    const images: ImageReference[] = [];

    let pendingProject: { line: number; project: string } | undefined;
    let pendingIgnore = false;
    let insideServices = false;
    let servicesIndent = -1;

    for (const [index, rawLine] of lines.entries()) {
        const line = rawLine ?? "";
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
            const value = imageMatch[2] ?? "";
            const parsed = parseImageReference(value);

            if (parsed) {
                const trailingComment = imageMatch[3]?.trim();
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
            pendingProject = { line: index + 1, project: projectMatch[2] ?? "" };
            // Deliberately keep `pendingIgnore` alive across project: lines
            // — a `# vis-update-ignore-next-line` on the previous line
            // should apply to the whole include block, not just the
            // project: line (which we don't rewrite anyway).
            continue;
        }

        const refMatch = REF_RE.exec(line);

        if (refMatch && pendingProject) {
            const trailingComment = refMatch[3]?.trim();
            let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

            if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                ignoreReason = ignoreReason ?? "vis-update-ignore";
            }

            includes.push({
                file: filePath,
                ignoreReason,
                kind: "project",
                line: index + 1,
                original: refMatch[2] ?? "",
                project: pendingProject.project,
                ref: refMatch[2] ?? "",
            });

            pendingProject = undefined;
            pendingIgnore = false;
            continue;
        }

        const componentMatch = COMPONENT_RE.exec(line);

        if (componentMatch) {
            const raw = componentMatch[2] ?? "";
            const atIndex = raw.lastIndexOf("@");

            if (atIndex > 0) {
                const fullPath = raw.slice(0, atIndex);
                const ref = raw.slice(atIndex + 1);
                const lastSlash = fullPath.lastIndexOf("/");
                const project = lastSlash > 0 ? fullPath.slice(0, lastSlash) : fullPath;
                const componentName = lastSlash > 0 ? fullPath.slice(lastSlash + 1) : undefined;
                const trailingComment = componentMatch[3]?.trim();
                let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

                if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                    ignoreReason = ignoreReason ?? "vis-update-ignore";
                }

                includes.push({
                    componentName,
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

        const flowMatch = FLOW_LINE_RE.exec(line);

        if (flowMatch) {
            const inner = flowMatch[1] ?? "";
            const trailingComment = /#(.*)$/.exec(line)?.[1]?.trim();
            let ignoreReason = pendingIgnore ? "vis-update-ignore-next-line" : undefined;

            if (trailingComment && IGNORE_INLINE_RE.test(trailingComment)) {
                ignoreReason = ignoreReason ?? "vis-update-ignore";
            }

            const componentInline = FLOW_COMPONENT_RE.exec(inner);

            if (componentInline) {
                const raw = componentInline[2] ?? "";
                const atIndex = raw.lastIndexOf("@");

                if (atIndex > 0) {
                    const fullPath = raw.slice(0, atIndex);
                    const ref = raw.slice(atIndex + 1);
                    const lastSlash = fullPath.lastIndexOf("/");
                    const project = lastSlash > 0 ? fullPath.slice(0, lastSlash) : fullPath;
                    const componentName = lastSlash > 0 ? fullPath.slice(lastSlash + 1) : undefined;

                    includes.push({
                        componentName,
                        file: filePath,
                        ignoreReason,
                        kind: "component",
                        line: index + 1,
                        original: raw,
                        project,
                        ref,
                    });
                }
            } else {
                const projectInline = FLOW_PROJECT_RE.exec(inner);
                const refInline = FLOW_REF_RE.exec(inner);

                if (projectInline && refInline) {
                    includes.push({
                        file: filePath,
                        ignoreReason,
                        kind: "project",
                        line: index + 1,
                        original: refInline[2] ?? "",
                        project: projectInline[2] ?? "",
                        ref: refInline[2] ?? "",
                    });
                }
            }

            pendingIgnore = false;
            continue;
        }

        // YAML key-only lines (`include:`, `services:`, `some-job:`) sit
        // between a `# vis-update-ignore-next-line` directive and the
        // value-bearing line that the user actually wants to ignore.
        // Treat them like comments for the purpose of the lookahead so
        // the directive survives to the next `ref:` / `image:` line.
        if (trimmed !== "" && !trimmed.startsWith("#") && !BLOCK_OPENER_RE.test(line)) {
            pendingIgnore = false;
        }
    }

    return { images, includes };
};

const SKIP_RE = /^(?:\.git|node_modules|\.pnpm-store|\.turbo|\.nx|dist|build|\.cache)$/;

export const scanGitlabRepository = (workspaceRoot: string): { images: ImageReference[]; includes: GitLabInclude[] } => {
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
        if (
            isGitlabCiFile(entry.name)
            && !allImages.some((image) => image.file === entry.path)
            && !allIncludes.some((include) => include.file === entry.path)
        ) {
            collect(entry.path);
        }
    }

    return { images: allImages, includes: allIncludes };
};
