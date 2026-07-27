import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataGrid, Digits, DirectoryTree, FileChange, Image, Json, Log, QrCode } from "../../src/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

const setup = async (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    await delay(50);

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    return { getOutput, stdin, unmount };
};

describe(Json, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders keys and scalar values", async () => {
        expect.assertions(2);

        const s = await setup(<Json data={{ count: 3, name: "vis" }} interactive={false} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("name");
        expect(s.getOutput()).toContain("vis");
    });

    it("collapses nested containers at collapseDepth", async () => {
        expect.assertions(1);

        const s = await setup(<Json collapseDepth={0} data={{ nested: { deep: 1 } }} interactive={false} />);

        unmount = s.unmount;

        expect(s.getOutput()).not.toContain("deep");
    });
});

describe(DataGrid, () => {
    let unmount: (() => void) | undefined;

    const columns = [
        { header: "Name", key: "name" as const },
        { align: "right" as const, header: "Age", key: "age" as const },
    ];
    const rows = [
        { age: 30, name: "Bob" },
        { age: 20, name: "Amy" },
    ];

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders headers and cells", async () => {
        expect.assertions(2);

        const s = await setup(<DataGrid columns={columns} data={rows} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("Name");
        expect(s.getOutput()).toContain("Bob");
    });

    it("selects the cursor row on Enter", async () => {
        expect.assertions(1);

        const onSelect = vi.fn();
        const s = await setup(<DataGrid autoFocus columns={columns} data={rows} onSelect={onSelect} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "\r");
        await waitFor(() => onSelect.mock.calls.some((call) => call[0] === rows[0]));

        expect(onSelect).toHaveBeenCalledWith(rows[0]);
    });
});

describe(Log, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("tails to maxLines", async () => {
        expect.assertions(2);

        const s = await setup(<Log entries={[{ message: "first" }, { message: "second" }, { level: "error", message: "third" }]} maxLines={2} />);

        unmount = s.unmount;

        expect(s.getOutput()).not.toContain("first");
        expect(s.getOutput()).toContain("third");
    });
});

describe(Digits, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders three rows", async () => {
        expect.assertions(1);

        const s = await setup(<Digits value="12:30" />);

        unmount = s.unmount;

        // three-row font → at least two newlines in the frame region
        expect(s.getOutput().split("\n").length).toBeGreaterThan(2);
    });
});

describe(FileChange, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders path and counts", async () => {
        expect.assertions(2);

        const s = await setup(<FileChange additions={5} deletions={2} path="src/x.ts" status="modified" />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("src/x.ts");
        expect(s.getOutput()).toContain("+5");
    });
});

describe(DirectoryTree, () => {
    let unmount: (() => void) | undefined;

    const nodes = [{ children: [{ name: "index.ts", type: "file" as const }], name: "src", type: "directory" as const }];

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders directories collapsed", async () => {
        expect.assertions(2);

        const s = await setup(<DirectoryTree nodes={nodes} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("src");
        expect(s.getOutput()).not.toContain("index.ts");
    });

    it("expands on the right arrow", async () => {
        expect.assertions(1);

        const s = await setup(<DirectoryTree autoFocus nodes={nodes} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "[C");
        await waitFor(() => s.getOutput().includes("index.ts"));

        expect(s.getOutput()).toContain("index.ts");
    });
});

describe(Image, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders half-block cells for pixels", async () => {
        expect.assertions(1);

        const s = await setup(
            <Image
                pixels={[
                    ["red", "green"],
                    ["blue", "yellow"],
                ]}
            />,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("▀");
    });
});

describe(QrCode, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders a provided module matrix", async () => {
        expect.assertions(1);

        const matrix = [
            [true, false],
            [false, true],
        ];
        const s = await setup(<QrCode matrix={matrix} quietZone={0} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("▀");
    });
});
