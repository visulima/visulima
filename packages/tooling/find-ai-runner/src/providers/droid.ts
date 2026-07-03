import type { AiProviderConfig } from "../types";

// droid "prompt" [--skip-permissions-unsafe] -o text [-m model]
const droid: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = [prompt];

        if (dangerous) {
            args.push("--skip-permissions-unsafe");
        }

        args.push("-o", "text");

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "droid",
    defaultModel: "",
    displayName: "Droid",
    envVariable: "DROID_PATH",
    // No verified session marker yet — droid does not mark the shells it spawns.
    sessionMarkers: [],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default droid;
