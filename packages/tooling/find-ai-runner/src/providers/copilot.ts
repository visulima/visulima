import type { AiProviderConfig } from "../types";

// copilot -p "prompt" [--allow-all-tools] [--model model]
const copilot: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["-p", prompt];

        if (dangerous) {
            args.push("--allow-all-tools");
        }

        if (model) {
            args.push("--model", model);
        }

        return args;
    },
    command: "copilot",
    defaultModel: "",
    displayName: "GitHub Copilot CLI",
    envVariable: "COPILOT_PATH",
    sessionMarkers: [
        { confidence: "definite", variable: "COPILOT_MODEL" },
        { confidence: "definite", variable: "COPILOT_ALLOW_ALL" },
        { confidence: "definite", variable: "COPILOT_GITHUB_TOKEN" },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default copilot;
