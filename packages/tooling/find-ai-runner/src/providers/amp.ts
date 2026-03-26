import type { AiProviderConfig } from "../types";

// amp -x "prompt" --dangerously-allow-all
const amp: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, _model, _maxTokens) => ["-x", prompt, "--dangerously-allow-all"],
    command: "amp",
    defaultModel: "",
    envVariable: "AMP_PATH",
};

export default amp;
