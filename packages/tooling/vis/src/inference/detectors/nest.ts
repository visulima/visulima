import type { DetectedTargets, Detector } from "../types";

export const nestDetector: Detector = {
    configFiles: ["nest-cli.json"],
    // No `fallbackDependency`: `@nestjs/core` ships in plenty of
    // libraries that don't drive `nest build` themselves. The
    // `nest-cli.json` is the reliable signal.
    detect: ({ hasConfigFile, matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            build: {
                command: "nest build",
                description: "nest build (inferred)",
                inputs: [
                    "{projectRoot}/src/**/*",
                    ...(configRef ? [configRef] : []),
                    "{projectRoot}/package.json",
                    "{projectRoot}/tsconfig.json",
                    "{projectRoot}/tsconfig.build.json",
                ],
                outputs: ["{projectRoot}/dist"],
                type: "build",
            },
        };

        if (hasConfigFile) {
            targets["start"] = {
                command: "nest start",
                description: "nest start (inferred)",
                preset: "server",
            };
            targets["start:dev"] = {
                command: "nest start --watch",
                description: "nest start --watch (inferred)",
                preset: "server",
            };
        }

        return { targets };
    },
    name: "nest",
};
