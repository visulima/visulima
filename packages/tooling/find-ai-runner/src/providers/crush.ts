import type { AiProviderConfig } from "../types";

// crush run --yolo [-m model] "prompt"
const crush: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = ["run", "--yolo"];

        if (model) {
            args.push("-m", model);
        }

        args.push(prompt);

        return args;
    },
    command: "crush",
    defaultModel: "",
    envVariable: "CRUSH_PATH",
};

export default crush;
