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
    displayName: "Cursor Agent",
    envVariable: "CURSOR_PATH",
    sessionMarkers: [
        { confidence: "definite", variable: "CURSOR_AGENT" },
        // The agent additionally pins a scripted PAGER; CURSOR_TRACE_ID alone only proves the editor.
        { confidence: "definite", label: "CURSOR_TRACE_ID+PAGER", match: { all: ["CURSOR_TRACE_ID", ["PAGER", "head -n 10000 | cat"]] } },
        // The editor sets CURSOR_TRACE_ID in EVERY integrated terminal — a human may be typing.
        { agent: "Cursor editor", confidence: "ambient", variable: "CURSOR_TRACE_ID" },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default cursor;
