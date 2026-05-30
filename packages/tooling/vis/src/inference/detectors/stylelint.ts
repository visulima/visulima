import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { Detector } from "../types";

export const stylelintDetector: Detector = {
    configFiles: TOOL_SIGNATURES.stylelint.configFiles,
    detect: ({ matchedConfigs }) => {
        return {
            targets: {
                // CSS-only — distinct from `lint` so eslint/biome/oxlint
                // can coexist with stylelint in the same project.
                "lint:css": {
                    command: "stylelint \"**/*.{css,scss,sass,less,vue,svelte,astro}\"",
                    description: "stylelint (inferred)",
                    inputs: [
                        "{projectRoot}/src/**/*.css",
                        "{projectRoot}/src/**/*.scss",
                        "{projectRoot}/src/**/*.sass",
                        "{projectRoot}/src/**/*.less",
                        "{projectRoot}/src/**/*.vue",
                        "{projectRoot}/src/**/*.svelte",
                        "{projectRoot}/src/**/*.astro",
                        ...matchedConfigs.map((file) => `{projectRoot}/${file}`),
                        "{projectRoot}/package.json",
                    ],
                    outputs: [],
                    type: "build",
                },
            },
        };
    },
    fallbackDependency: "stylelint",
    name: "stylelint",
};
