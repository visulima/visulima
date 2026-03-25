import type { AiProviderConfig } from "../types";

// kimi --quiet -p "prompt" [-m model]
const kimi: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = ["--quiet", "-p", prompt];

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "kimi",
    defaultModel: "",
    envVariable: "KIMI_PATH",
    priority: 25,
};

export default kimi;
