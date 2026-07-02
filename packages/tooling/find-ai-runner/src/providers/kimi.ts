import type { AiProviderConfig } from "../types";

// kimi --quiet -p "prompt" [-m model]
const kimi: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { model }) => {
        const args = ["--quiet", "-p", prompt];

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "kimi",
    defaultModel: "",
    displayName: "Kimi CLI",
    envVariable: "KIMI_PATH",
    // No verified session marker yet — kimi does not mark the shells it spawns.
    sessionMarkers: [],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default kimi;
