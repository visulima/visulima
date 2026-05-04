import { strip } from "@visulima/ansi";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TreeNode } from "../../src/ink/index";
import { render, Text, TreeView } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

const sampleData: TreeNode[] = [
    {
        children: [
            { id: "1.1", label: "Child A" },
            {
                children: [{ id: "1.2.1", label: "Grandchild" }],
                id: "1.2",
                label: "Child B",
            },
        ],
        id: "1",
        label: "Root 1",
    },
    { id: "2", label: "Root 2" },
];

describe(TreeView, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element) => {
        const stdout = createStdout(100);
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            return strip((calls.at(-1)?.[0] ?? "") as string);
        };

        return { getOutput, stdin, stdout, unmount };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render root nodes", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<TreeView data={sampleData} />);

        const text = getOutput();

        expect(text).toContain("Root 1");
        expect(text).toContain("Root 2");
    });

    it("should not render children when collapsed", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<TreeView data={sampleData} />);

        const text = getOutput();

        expect(text).not.toContain("Child A");
        expect(text).not.toContain("Child B");
    });

    it("should render children when defaultExpanded is set", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(<TreeView data={sampleData} defaultExpanded={new Set(["1"])} />);

        const text = getOutput();

        expect(text).toContain("Child A");
        expect(text).toContain("Child B");
        // Grandchild should not be visible (1.2 not expanded)
        expect(text).not.toContain("Grandchild");
    });

    it("should render all descendants when defaultExpanded is 'all'", async () => {
        expect.assertions(5);

        const { getOutput } = await setup(<TreeView data={sampleData} defaultExpanded="all" />);

        const text = getOutput();

        expect(text).toContain("Root 1");
        expect(text).toContain("Child A");
        expect(text).toContain("Child B");
        expect(text).toContain("Grandchild");
        expect(text).toContain("Root 2");
    });

    it("should focus the first node by default", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TreeView data={sampleData} />);

        const text = getOutput();

        expect(text).toContain("❯");
    });

    it("should show expand indicators for parent nodes", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TreeView data={sampleData} />);

        const text = getOutput();

        expect(text).toContain("▸");
    });

    it("should show down triangle for expanded nodes", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TreeView data={sampleData} defaultExpanded={new Set(["1"])} />);

        const text = getOutput();

        expect(text).toContain("▾");
    });

    it("should render with custom renderNode", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(
            <TreeView
                data={sampleData}
                renderNode={({ node, state }) => (
                    <Text>
                        {"  ".repeat(state.depth)}
[
{node.label}
]
                    </Text>
                )}
            />,
        );

        const text = getOutput();

        expect(text).toContain("[Root 1]");
        expect(text).toContain("[Root 2]");
    });

    it("should show scroll indicators when using visibleNodeCount", async () => {
        expect.assertions(3);

        const manyNodes: TreeNode[] = Array.from({ length: 20 }, (_, index) => {
            return {
                id: String(index),
                label: `Node ${index}`,
            };
        });

        const { getOutput } = await setup(<TreeView data={manyNodes} visibleNodeCount={5} />);

        const text = getOutput();

        expect(text).toContain("Node 0");
        expect(text).toContain("Node 4");
        expect(text).toContain("more below");
    });

    it("should render with single selection mode", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TreeView data={sampleData} defaultSelected={new Set(["1"])} selectionMode="single" />);

        const text = getOutput();

        expect(text).toContain("✔");
    });

    it("should render with multiple selection mode", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<TreeView data={sampleData} defaultSelected={new Set(["1"])} selectionMode="multiple" />);

        const text = getOutput();

        expect(text).toContain("☒");
        expect(text).toContain("☐");
    });

    it("should render empty tree without errors", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TreeView data={[]} />);

        expect(getOutput()).toBeDefined();
    });

    describe("keyboard navigation", () => {
        it("should move focus down with arrow down", async () => {
            expect.assertions(2);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} />);

            // Initially focused on Root 1
            let text = getOutput();

            expect(text).toMatch(/❯.*Root 1/);

            // Press down arrow
            emitReadable(stdin, "\u001B[B");
            await delay(50);

            text = getOutput();

            expect(text).toMatch(/❯.*Root 2/);
        });

        it("should move focus up with arrow up", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} />);

            // Move down first, then back up
            emitReadable(stdin, "\u001B[B");
            await delay(50);
            emitReadable(stdin, "\u001B[A");
            await delay(50);

            const text = getOutput();

            expect(text).toMatch(/❯.*Root 1/);
        });

        it("should expand node with right arrow", async () => {
            expect.assertions(2);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} />);

            // Right arrow on Root 1 should expand it
            emitReadable(stdin, "\u001B[C");
            await delay(50);

            const text = getOutput();

            expect(text).toContain("Child A");
            expect(text).toContain("Child B");
        });

        it("should collapse node with left arrow", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} defaultExpanded={new Set(["1"])} />);

            // Left arrow on Root 1 should collapse it
            emitReadable(stdin, "\u001B[D");
            await delay(50);

            const text = getOutput();

            expect(text).not.toContain("Child A");
        });

        it("should toggle expand with Enter in none selection mode", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} />);

            // Enter should expand Root 1
            emitReadable(stdin, "\r");
            await delay(50);

            const text = getOutput();

            expect(text).toContain("Child A");
        });

        it("should select with Enter in single selection mode", async () => {
            expect.assertions(2);

            const onSelectChange = vi.fn();
            const { getOutput, stdin } = await setup(<TreeView data={sampleData} onSelectChange={onSelectChange} selectionMode="single" />);

            // Enter should select Root 1
            emitReadable(stdin, "\r");
            await delay(50);

            const text = getOutput();

            expect(text).toContain("✔");
            expect(onSelectChange).toHaveBeenCalledWith(new Set(["1"]));
        });

        it("should toggle checkbox with Space in multiple selection mode", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} selectionMode="multiple" />);

            // Space should toggle selection on Root 1
            emitReadable(stdin, " ");
            await delay(50);

            const text = getOutput();

            expect(text).toContain("☒");
        });

        it("should ignore input when disabled", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} isDisabled />);

            // Right arrow should not expand
            emitReadable(stdin, "\u001B[C");
            await delay(50);

            const text = getOutput();

            expect(text).not.toContain("Child A");
        });

        it("should call onFocusChange when focus moves", async () => {
            expect.assertions(1);

            const onFocusChange = vi.fn();
            const { stdin } = await setup(<TreeView data={sampleData} onFocusChange={onFocusChange} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onFocusChange).toHaveBeenCalledWith("2");
        });

        it("should call onExpandChange when node is expanded", async () => {
            expect.assertions(2);

            const onExpandChange = vi.fn();
            const { stdin } = await setup(<TreeView data={sampleData} onExpandChange={onExpandChange} />);

            emitReadable(stdin, "\u001B[C");
            await delay(50);

            expect(onExpandChange).toHaveBeenCalledWith(expect.any(Set));

            const expandedIds = onExpandChange.mock.calls[0]?.[0] as ReadonlySet<string>;

            expect(expandedIds.has("1")).toBe(true);
        });

        it("should move to first child when right arrow on expanded node", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} defaultExpanded={new Set(["1"])} />);

            // Right arrow on expanded Root 1 should focus Child A
            emitReadable(stdin, "\u001B[C");
            await delay(50);

            const text = getOutput();

            expect(text).toMatch(/❯.*Child A/);
        });

        it("should move to parent with left arrow on child", async () => {
            expect.assertions(1);

            const { getOutput, stdin } = await setup(<TreeView data={sampleData} defaultExpanded={new Set(["1"])} />);

            // Move to Child A via right arrow on expanded parent
            emitReadable(stdin, "\u001B[C");
            await delay(50);

            // Left arrow should move back to parent
            emitReadable(stdin, "\u001B[D");
            await delay(50);

            const text = getOutput();

            expect(text).toMatch(/❯.*Root 1/);
        });
    });
});
