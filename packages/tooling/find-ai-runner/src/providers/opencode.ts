import type { AiProviderConfig } from "../types";

// opencode run "prompt" [-m provider/model]
const opencode: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = ["run", prompt];

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "opencode",
    defaultModel: "anthropic/claude-sonnet-4",
    envVariable: "OPENCODE_PATH",
};

export default opencode;
