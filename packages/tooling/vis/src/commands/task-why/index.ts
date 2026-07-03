import type { Command } from "@visulima/cerebro";

const taskWhy: Command = {
    argument: {
        description: "Task ID to explain (e.g. @my/app:build)",
        name: "taskId",
        type: String,
    },
    description: "Explain why a task is included in the graph by walking its dependency chain to a root",
    examples: [
        ["vis task-why @myorg/app:build", "Show what pulls build in"],
        ["vis task-why lib-a:test", "Check the test task's triggers"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "task-why",
};

export default taskWhy;
