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
    displayName: "opencode",
    envVariable: "OPENCODE_PATH",
    sessionMarkers: [{ confidence: "definite", variable: "OPENCODE_CLIENT" }],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default opencode;
