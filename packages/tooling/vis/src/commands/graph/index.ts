import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const graphOptionDefinitions = {
    depth: {
        alias: "d",
        description: "Maximum dependency tree depth for ASCII output (default: unlimited)",
        type: Number,
    },
    format: {
        alias: "f",
        defaultValue: undefined,
        description: "Output format: tui, ascii, dot, json, html (default: tui in TTY, ascii otherwise)",
        type: String,
    },
    output: {
        alias: "o",
        description: "Write output to file instead of stdout",
        type: String,
    },
} as const;

const graph = defineCommand({
    description: "Visualize the project dependency graph",
    examples: [
        ["vis graph", "Show colored dependency graph (TUI in TTY, ASCII otherwise)"],
        ["vis graph --format=ascii", "Force ASCII tree output"],
        ["vis graph --format=dot", "Output in Graphviz DOT format"],
        ["vis graph --format=html --output=graph.html", "Generate interactive HTML graph"],
        ["vis graph --format=json --output=graph.json", "Save JSON graph to file"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "graph",
    options: graphOptionDefinitions,
});

export default graph;

export type GraphOptions = InferOptions<typeof graphOptionDefinitions>;
