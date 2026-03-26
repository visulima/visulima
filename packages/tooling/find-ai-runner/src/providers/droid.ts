import type { AiProviderConfig } from "../types";

// droid "prompt" --skip-permissions-unsafe -o text [-m model]
const droid: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = [prompt, "--skip-permissions-unsafe", "-o", "text"];

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "droid",
    defaultModel: "",
    envVariable: "DROID_PATH",
};

export default droid;
