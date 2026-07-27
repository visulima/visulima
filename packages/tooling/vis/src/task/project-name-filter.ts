import { VisUserError } from "../errors/vis-user-error";
import { suggestTargets } from "./target-discovery";

/**
 * Narrow `projectNames` to the comma-separated set named in `--projects`.
 *
 * Shared by `vis run` and `vis action-graph` so the two can't drift — the
 * flag used to exist on only one of them, and the other silently planned
 * the entire workspace instead of erroring.
 *
 * Throws a `VisUserError` naming the closest known project when nothing
 * matches: at monorepo scale the intended name is usually one edit away,
 * and making the user go read `vis list` to find it is pure friction.
 * @param projectNames Projects surviving selector resolution so far.
 * @param requested Raw `--projects` value (comma-separated).
 * @param knownProjects Every project name in the workspace, for suggestions.
 * @returns The intersection of `projectNames` and `requested`.
 */
export const filterProjectsByNames = (projectNames: string[], requested: string, knownProjects: string[]): string[] => {
    const wanted = new Set(
        requested
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
    );

    // `--projects=` / `--projects=,,`. Suggesting a nearest match would be
    // nonsense here, so say what is actually wrong.
    if (wanted.size === 0) {
        throw new VisUserError(`--projects was given no project names. Pass a comma-separated list, or omit the flag to include every project.`);
    }

    const filtered = projectNames.filter((name) => wanted.has(name));

    if (filtered.length > 0) {
        return filtered;
    }

    const suggestions = [...wanted].flatMap((name) => suggestTargets(name, knownProjects)).filter((name, index, all) => all.indexOf(name) === index);

    const hint
        = suggestions.length > 0
            ? `\nDid you mean: ${suggestions.slice(0, 3).join(", ")}?`
            : `\nRun \`vis list\` to see the ${String(knownProjects.length)} known project name(s).`;

    throw new VisUserError(`No matching projects found for: ${requested}${hint}`);
};
