import type { AiProviderConfig } from "../types";

// agent -p --force --output-format text --model <m> "prompt"
const cursor: AiProviderConfig = {
    alternateCommands: ["cursor"],
    buildArgs: (prompt, model, _maxTokens) => {
        const args = ["-p", "--force", "--output-format", "text"];

        if (model) {
            args.push("--model", model);
        }

        args.push(prompt);

        return args;
    },
    command: "agent",
    defaultModel: "",
    envVariable: "CURSOR_PATH",
};

export default cursor;
