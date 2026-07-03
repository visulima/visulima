/**
 * Vis-native workspace reader.
 *
 * Visulima is itself the nx/changesets/turborepo alternative — so when a
 * vis user wants `vis release` to honour the same project set as
 * `vis run-many` / `vis affected`, they should NOT have to wire a
 * third-party project-graph adapter. This reader plugs directly into vis's
 * own `discoverWorkspace()` (from `src/config/workspace`) and surfaces the
 * resulting `WorkspaceConfiguration` to the release subsystem.
 *
 * Compared to the default PM-adapter discovery the release orchestrator uses
 * by default, this reader:
 *   - reads `project.json` tags for filtering (parity with `vis affected -t`)
 *   - includes projects that the PM-adapter misses (apps / libs added via
 *     project.json without being in package.json#workspaces)
 *   - is synchronous + uses `@visulima/fs` (no async PM CLI shellouts)
 *
 * Usage in user code:
 *   ```ts
 *   import { createVisWorkspaceReader } from "@visulima/vis/release/readers/workspace";
 *
 *   const reader = createVisWorkspaceReader({ cwd: process.cwd(), tag: "type:package" });
 *   ```
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type { VisConfig } from "../../../config/types";
import { discoverWorkspace } from "../../../config/workspace";
import type { PackageManifest } from "../../types";
import type { PackageJsonReader } from "../workspace";

export interface VisWorkspaceReaderOptions {
    /**
     * Override the loaded vis config (rarely needed — `discoverWorkspace` reads
     * from disk by default; supply this to bypass the loader for tests).
     */
    config?: VisConfig;
    /** Workspace root (where pnpm-workspace.yaml or package.json#workspaces lives). */
    cwd: string;

    /**
     * Restrict to a project type (`"library"` or `"application"`) — mirrors
     * `project.json#projectType`. Default: include both.
     */
    projectType?: "application" | "library";

    /**
     * Filter projects by `project.json#tags`. Equivalent to `vis affected -t &lt;tag>`.
     * Default: include every discovered project.
     */
    tag?: string;
}

export const createVisWorkspaceReader = (options: VisWorkspaceReaderOptions): PackageJsonReader => {
    return {
        listPackages: async () => {
            const { workspace } = discoverWorkspace(options.cwd, options.config ?? {});
            const { projectType, tag } = options;

            const settled = await Promise.all(
                Object.values(workspace.projects).map(async (project) => {
                    if (tag && !project.tags?.includes(tag)) {
                        return undefined;
                    }

                    if (projectType && project.projectType !== projectType) {
                        return undefined;
                    }

                    const projectRoot = isAbsolute(project.root) ? project.root : join(options.cwd, project.root);
                    const manifestPath = join(projectRoot, "package.json");

                    try {
                        const content = await readFile(manifestPath, "utf8");
                        const manifest = JSON.parse(content) as PackageManifest;

                        return { manifest, manifestPath };
                    } catch {
                        // Pure vis projects without a package.json (e.g. e2e harnesses) are skipped.
                        return undefined;
                    }
                }),
            );

            return settled.filter((entry): entry is { manifest: PackageManifest; manifestPath: string } => entry !== undefined);
        },
    };
};
