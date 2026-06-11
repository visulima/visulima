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
    envVariable: "KIMI_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default kimi;
