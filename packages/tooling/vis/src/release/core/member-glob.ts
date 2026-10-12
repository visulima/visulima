/**
 * Expand a workspace `members` entry (Cargo `[workspace].members`, uv
 * `[tool.uv.workspace].members`) into directories under `cwd`.
 */
import { readdir } from "node:fs/promises";
import { join, sep } from "node:path";

import zeptomatch from "zeptomatch";

import { VisReleaseError } from "../errors";

export /**
        * Expand one `[workspace].members` entry. Each path segment is either literal
        * or a `zeptomatch` pattern over the directory's entries. `**` is refused
        * instead of guessed, because it would walk the whole tree.
        */
const expandMember = async (cwd: string, pattern: string): Promise<string[]> => {
    let current = [cwd];

    for (const segment of pattern.split("/").filter((part) => part !== "" && part !== ".")) {
        if (segment === "**") {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `Unsupported [workspace].members pattern "${pattern}": "**" is not supported. List the crate directories explicitly or use "dir/*".`,
            });
        }

        const isPattern = /[*?[{]/.test(segment);
        const next: string[] = [];

        for (const base of current) {
            if (!isPattern) {
                next.push(join(base, segment));

                continue;
            }

            const entries = await readdir(base, { withFileTypes: true }).catch(() => []);

            for (const entry of entries) {
                if (entry.isDirectory() && zeptomatch(segment, entry.name)) {
                    next.push(join(base, entry.name));
                }
            }
        }

        current = next;
    }

    return current;
};

/**
 * Whether `dir` is one of `roots` or lies inside one of them. A fixture or
 * nested project below a claimed package belongs to that package, so it is
 * never a second release or task project.
 */
export const isWithinAny = (dir: string, roots: ReadonlySet<string>): boolean => {
    for (const root of roots) {
        if (dir === root || dir.startsWith(`${root}${sep}`)) {
            return true;
        }
    }

    return false;
};
