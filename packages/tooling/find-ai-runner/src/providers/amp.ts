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
    displayName: "Amp",
    envVariable: "AMP_PATH",
    sessionMarkers: [{ confidence: "definite", equals: "amp", variable: "AGENT" }],
    supportsMaxTokens: false,
    supportsModel: false,
};

export default amp;
