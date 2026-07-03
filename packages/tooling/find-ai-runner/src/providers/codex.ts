import type { AiProviderConfig } from "../types";

// Modern (Rust) Codex CLI: codex exec [--model <m>] [--dangerously-bypass-approvals-and-sandbox] "prompt"
// The retired TypeScript CLI used `--approval-mode full-auto --quiet --max-tokens`; those flags are
// rejected by current installs, so we target `codex exec` instead.
const codex: AiProviderConfig = {
    alternateCommands: ["openai-codex"],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["exec"];

        if (model) {
            args.push("--model", model);
        }

        if (dangerous) {
            args.push("--dangerously-bypass-approvals-and-sandbox");
        }

        args.push(prompt);

        return args;
    },
    command: "codex",
    defaultModel: "",
    displayName: "Codex",
    envVariable: "CODEX_PATH",
    sessionMarkers: [
        { confidence: "definite", variable: "CODEX_SANDBOX" },
        { confidence: "definite", variable: "CODEX_THREAD_ID" },
        { confidence: "definite", variable: "CODEX_CI" },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default codex;
