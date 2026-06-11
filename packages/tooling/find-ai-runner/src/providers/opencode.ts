import type { AiProviderConfig } from "../types";

// opencode run "prompt" [-m provider/model]
const opencode: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { model }) => {
        const args = ["run", prompt];

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "opencode",
    // Empty default = provider-default model, avoids pinning a stale snapshot.
    defaultModel: "",
    envVariable: "OPENCODE_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default opencode;
