import { describe, expect, it } from "vitest";

import { buildTaskGraph } from "../../src/staged/tasks/build";

const cwd = "/repo";
const files = ["/repo/src/index.ts", "/repo/src/lib/util.ts", "/repo/README.md"];

describe(buildTaskGraph, () => {
    it("builds one pattern with a single command for a string task", async () => {
        expect.assertions(3);

        const patterns = await buildTaskGraph({ config: { "*.ts": "eslint --fix" }, cwd, files });

        expect(patterns).toHaveLength(1);
        expect(patterns[0]?.pattern).toBe("*.ts");
        expect(patterns[0]?.commands.map((c) => c.title)).toEqual(["eslint --fix"]);
    });

    it("expands array tasks into multiple serial commands", async () => {
        expect.assertions(2);

        const patterns = await buildTaskGraph({ config: { "*.ts": ["eslint --fix", "prettier --write"] }, cwd, files });

        expect(patterns).toHaveLength(1);
        expect(patterns[0]?.commands.map((c) => c.title)).toEqual(["eslint --fix", "prettier --write"]);
    });

    it("drops patterns that match no files", async () => {
        expect.assertions(1);

        const patterns = await buildTaskGraph({ config: { "*.rs": "cargo fmt" }, cwd, files });

        expect(patterns).toEqual([]);
    });

    it("resolves function tasks by invoking them with matched files", async () => {
        expect.assertions(2);

        const patterns = await buildTaskGraph({
            config: {
                "*.ts": (matched) => `eslint --fix ${matched.length}`,
            },
            cwd,
            files,
        });

        expect(patterns[0]?.commands).toHaveLength(1);
        expect(patterns[0]?.commands[0]?.title).toBe("eslint --fix 2");
    });

    it("accepts { title, task } custom tasks", async () => {
        expect.assertions(2);

        let called = 0;

        const patterns = await buildTaskGraph({
            config: {
                "*.md": {
                    task: () => {
                        called += 1;
                    },
                    title: "custom-task",
                },
            },
            cwd,
            files,
        });

        expect(patterns[0]?.commands[0]?.title).toBe("custom-task");
        expect(called).toBe(0); // not called during build
    });

    it("throws a helpful error when a function task returns an unsupported value", async () => {
        expect.assertions(1);

        await expect(
            buildTaskGraph({
                config: {
                    "*.ts": () => 42 as unknown as string,
                },
                cwd,
                files,
            }),
        ).rejects.toThrow(/unsupported value/i);
    });
});
