import type { AiProviderConfig } from "../types";

// opencode run "prompt" [-m provider/model]
const opencode: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { model }) => {
        const args = ["run"];

        if (model) {
            args.push("-m", model);
        }

        // `--` ends option parsing so a dash-prefixed prompt is never misread as a flag.
        args.push("--", prompt);

        return args;
    },
    command: "opencode",
    // Empty default = provider-default model, avoids pinning a stale snapshot.
    defaultModel: "",
    displayName: "opencode",
    envVariable: "OPENCODE_PATH",
    // opencode exposes several markers in the shells it spawns; any one identifies the session.
    sessionMarkers: [
        {
            confidence: "definite",
            label: "OPENCODE",
            match: { any: ["OPENCODE", "OPENCODE_BIN_PATH", "OPENCODE_SERVER", "OPENCODE_APP_INFO", "OPENCODE_MODES", "OPENCODE_CLIENT"] },
        },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default opencode;
