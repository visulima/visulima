import type { Detector } from "../types";

export const changesetDetector: Detector = {
    configFiles: [".changeset/config.json"],
    // No `fallbackDependency`: `@changesets/cli` ships in plenty of
    // monorepos that release through other tooling (multi-semantic-release,
    // changelogen, …). Only emit changeset targets when an actual
    // `.changeset/config.json` exists.
    detect: () => ({
        targets: {
            "changeset:publish": {
                command: "changeset publish",
                description: "changeset publish (inferred)",
            },
            "changeset:status": {
                command: "changeset status",
                description: "changeset status (inferred)",
            },
            "changeset:version": {
                command: "changeset version",
                description: "changeset version (inferred)",
            },
        },
    }),
    name: "changeset",
};
