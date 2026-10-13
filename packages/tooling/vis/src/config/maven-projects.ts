/**
 * Maven projects for the task graph. A directory with a `pom.xml` that has a
 * project-root `&lt;artifactId>` and no `package.json` is a project, named by that
 * artifactId. A parent pom that only groups modules is one too.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { scanPom } from "../util/maven-pom";

/** The project-root `&lt;artifactId>` of a pom-only directory, or undefined when it is not one. */
export const readMavenProjectArtifact = (directory: string): string | undefined => {
    const manifestPath = join(directory, "pom.xml");

    if (!isAccessibleSync(manifestPath) || isAccessibleSync(join(directory, "package.json"))) {
        return undefined;
    }

    try {
        const artifactId = scanPom(readFileSync(manifestPath)).artifactId?.value;

        return artifactId !== undefined && artifactId !== "" ? artifactId : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Workspace-relative Maven project directories among `candidates`, skipping
 * anything already claimed (a JS package, a Cargo crate or a Python project).
 */
export const resolveMavenProjectDirectories = (workspaceRoot: string, candidates: string[], claimed: string[]): string[] => {
    const accepted: string[] = [];

    for (const directory of [...new Set(candidates)].toSorted()) {
        if (claimed.includes(directory) || accepted.includes(directory)) {
            continue;
        }

        if (readMavenProjectArtifact(join(workspaceRoot, directory)) !== undefined) {
            accepted.push(directory);
        }
    }

    return accepted;
};
