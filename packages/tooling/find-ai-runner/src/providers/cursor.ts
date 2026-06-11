import type { AiProviderConfig } from "../types";

// agent -p [--force] --output-format text [--model <m>] "prompt"
const cursor: AiProviderConfig = {
    alternateCommands: ["cursor"],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["-p"];

        if (dangerous) {
            args.push("--force");
        }

        args.push("--output-format", "text");

        if (model) {
            args.push("--model", model);
        }

        args.push(prompt);

        return args;
    },
    command: "agent",
    defaultModel: "",
    envVariable: "CURSOR_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default cursor;
