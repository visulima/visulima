import type { AiProviderConfig } from "../types";

// amp -x "prompt" [--dangerously-allow-all]
const amp: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous }) => {
        const args = ["-x", prompt];

        if (dangerous) {
            args.push("--dangerously-allow-all");
        }

        return args;
    },
    command: "amp",
    defaultModel: "",
    envVariable: "AMP_PATH",
    supportsMaxTokens: false,
    supportsModel: false,
};

export default amp;
