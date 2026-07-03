import type { AiProviderConfig } from "../types";

// copilot -p "prompt" [--allow-all-tools] [--model model]
const copilot: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["-p", prompt];

        if (dangerous) {
            args.push("--allow-all-tools");
        }

        if (model) {
            args.push("--model", model);
        }

        return args;
    },
    command: "copilot",
    defaultModel: "",
    displayName: "GitHub Copilot CLI",
    envVariable: "COPILOT_PATH",
    sessionMarkers: [
        { confidence: "definite", variable: "COPILOT_MODEL" },
        { confidence: "definite", variable: "COPILOT_ALLOW_ALL" },
        { confidence: "definite", variable: "COPILOT_GITHUB_TOKEN" },
        // Copilot's agent in VS Code marks its shell tool with GIT_PAGER=cat inside a vscode terminal.
        // Exclude CURSOR_TRACE_ID: Cursor is a VS Code fork (TERM_PROGRAM=vscode) and would otherwise be
        // mis-attributed to Copilot when a human has GIT_PAGER=cat set.
        {
            agent: "GitHub Copilot in VS Code",
            confidence: "definite",
            label: "TERM_PROGRAM+GIT_PAGER",
            match: {
                all: [
                    ["TERM_PROGRAM", "vscode"],
                    ["GIT_PAGER", "cat"],
                ],
                none: ["CURSOR_TRACE_ID"],
            },
        },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default copilot;
