/**
 * Opt-in gate for the ecosystems `vis sbom` reads without a task-graph entry: Maven, Gradle, Hex,
 * Go, Dart, Swift, NuGet and Zig. An ecosystem is in the BOM only when its discover key is on
 * (`maven.discover`, ...) or its id is listed in `sbom.ecosystems`.
 *
 * Presence of a file is not use of the ecosystem: `go.sum` can sit in a JavaScript repo, and a
 * root `pom.xml` can be a leftover. So a found-but-not-opted-in ecosystem is reported, never
 * included. Cargo, Python, Composer and Gem are not gated here.
 */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import type { VisConfig } from "../config/types";
import { VisUserError } from "../errors/vis-user-error";
import { gradleLockfilePaths } from "./gradle";

export const GATED_ECOSYSTEMS = ["maven", "gradle", "hex", "go", "dart", "swift", "nuget", "zig"] as const;

export type GatedEcosystem = (typeof GATED_ECOSYSTEMS)[number];

/** The file that marks each ecosystem as present, read from the workspace root. Gradle is found per project. */
const DETECTION_FILE: Record<Exclude<GatedEcosystem, "gradle">, string> = {
    dart: "pubspec.lock",
    go: "go.sum",
    hex: "mix.lock",
    maven: "pom.xml",
    nuget: "packages.lock.json",
    swift: "Package.resolved",
    zig: "build.zig.zon",
};

/**
 * The workspace-relative files that found an ecosystem by file. Existence only: no lock file is parsed,
 * so a malformed file that is not opted in does not fail `vis sbom`.
 */
export const findGatedEcosystems = (workspaceRoot: string): { file: string; id: GatedEcosystem }[] => {
    const found: { file: string; id: GatedEcosystem }[] = [];

    for (const id of GATED_ECOSYSTEMS) {
        if (id === "gradle") {
            for (const path of gradleLockfilePaths(workspaceRoot)) {
                found.push({ file: relative(workspaceRoot, path).split("\\").join("/"), id });
            }

            continue;
        }

        if (existsSync(join(workspaceRoot, DETECTION_FILE[id]))) {
            found.push({ file: DETECTION_FILE[id], id });
        }
    }

    return found;
};

/** The config key that opts an ecosystem in directly. */
const discoverKey = (id: GatedEcosystem): string => `${id}.discover`;

/**
 * The ecosystems opted in by config: a discover key set to `true`, or the id in `sbom.ecosystems`.
 * An unknown id in `sbom.ecosystems` fails, so a typo cannot silently leave an ecosystem out.
 */
export const optedInEcosystems = (config: VisConfig | undefined): Set<GatedEcosystem> => {
    const optedIn = new Set<GatedEcosystem>();

    for (const id of GATED_ECOSYSTEMS) {
        if (config?.[id]?.discover === true) {
            optedIn.add(id);
        }
    }

    for (const id of config?.sbom?.ecosystems ?? []) {
        if (!(GATED_ECOSYSTEMS as ReadonlyArray<string>).includes(id)) {
            throw new VisUserError(`sbom.ecosystems: unknown ecosystem "${id}". Expected one of: ${GATED_ECOSYSTEMS.join(", ")}.`);
        }

        optedIn.add(id);
    }

    return optedIn;
};

/**
 * The one-line stderr notice for found-but-not-opted-in ecosystems, or undefined when there are none.
 * It says the ecosystem was found by file and gives the key that would include it.
 */
export const skippedEcosystemsNotice = (skipped: ReadonlyArray<{ file: string; id: GatedEcosystem }>): string | undefined => {
    if (skipped.length === 0) {
        return undefined;
    }

    const clauses = skipped.map(({ file, id }) => `${file} found; not included. Set ${discoverKey(id)} or add '${id}' to sbom.ecosystems.`);

    return `vis sbom: ecosystems found by file, which does not show they are used. ${clauses.join(" ")}`;
};
