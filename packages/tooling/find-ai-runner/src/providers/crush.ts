import type { AiProviderConfig } from "../types";

// crush run [--yolo] [-m model] "prompt"
const crush: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["run"];

        if (dangerous) {
            args.push("--yolo");
        }

        if (model) {
            args.push("-m", model);
        }

        args.push(prompt);

        return args;
    },
    command: "crush",
    defaultModel: "",
    envVariable: "CRUSH_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default crush;
