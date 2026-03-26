import type { AiProviderConfig } from "../types";

// copilot -p "prompt" --allow-all-tools [--model model]
const copilot: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = ["-p", prompt, "--allow-all-tools"];

        if (model) {
            args.push("--model", model);
        }

        return args;
    },
    command: "copilot",
    defaultModel: "",
    envVariable: "COPILOT_PATH",
};

export default copilot;
