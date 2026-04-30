import type { Command, CreateOptions } from "@visulima/cerebro";

const graph: Command = {
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
    options: [
        {
            alias: "f",
            defaultValue: undefined,
            description: "Output format: tui, ascii, dot, json, html (default: tui in TTY, ascii otherwise)",
            name: "format",
            type: String,
        },
        {
            alias: "o",
            description: "Write output to file instead of stdout",
            name: "output",
            type: String,
        },
        {
            alias: "d",
            description: "Maximum dependency tree depth for ASCII output (default: unlimited)",
            name: "depth",
            type: Number,
        },
    ],
};

export default graph;

export type GraphOptions = CreateOptions<{
    depth: number | undefined;
    format: string | undefined;
    output: string | undefined;
}>;
