import type { AiProviderConfig } from "../types";

// droid [--skip-permissions-unsafe] -o text [-m model] -- "prompt"
const droid: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args: string[] = [];

        if (dangerous) {
            args.push("--skip-permissions-unsafe");
        }

        args.push("-o", "text");

        if (model) {
            args.push("-m", model);
        }

        // Flags precede the prompt and `--` ends option parsing, so a dash-prefixed prompt is never misread as a flag.
        args.push("--", prompt);

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
