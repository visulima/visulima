import type { AiProviderConfig } from "../types";

// claude [--dangerously-skip-permissions] [--model <m>] --output-format text -p "prompt"
const claude: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args: string[] = [];

        if (dangerous) {
            args.push("--dangerously-skip-permissions");
        }

        if (model) {
            args.push("--model", model);
        }

        args.push("--output-format", "text", "-p", prompt);

        return args;
    },
    command: "claude",
    // Empty default = provider-default model, avoids pinning a stale snapshot.
    defaultModel: "",
    envVariable: "CLAUDE_PATH",
    supportsMaxTokens: false,
    supportsModel: true,
};

export default claude;
