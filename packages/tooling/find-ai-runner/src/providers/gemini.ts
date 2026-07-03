import type { AiProviderConfig } from "../types";

// gemini [--sandbox] [--model <m>] --max-output-tokens <n> -p "prompt"
// `--sandbox` is gemini's safety boundary, so it is the *opposite* of a bypass flag:
// we keep it on by default and only drop it when the caller opts into `dangerous`.
const gemini: AiProviderConfig = {
    alternateCommands: ["gemini-cli"],
    buildArgs: (prompt, { dangerous, maxTokens, model }) => {
        const args: string[] = [];

        if (!dangerous) {
            args.push("--sandbox");
        }

        if (model) {
            args.push("--model", model);
        }

        args.push("--max-output-tokens", String(maxTokens), "-p", prompt);

        return args;
    },
    command: "gemini",
    defaultModel: "gemini-2.5-pro",
    displayName: "Gemini CLI",
    envVariable: "GEMINI_PATH",
    // Qwen Code (a gemini-cli fork) also sets GEMINI_CLI, so exclude it here — the QWEN_CODE marker on
    // the qwen provider claims those sessions. This makes attribution order-independent.
    sessionMarkers: [{ confidence: "definite", label: "GEMINI_CLI", match: { all: ["GEMINI_CLI"], none: ["QWEN_CODE"] } }],
    supportsMaxTokens: true,
    supportsModel: true,
};

export default gemini;
