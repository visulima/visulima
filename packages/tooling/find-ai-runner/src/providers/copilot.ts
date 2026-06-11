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
    envVariable: "COPILOT_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default copilot;
