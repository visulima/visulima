import { describe, expect, it } from "vitest";

import type { PromptIO } from "../../../../src/commands/update/ecosystems/prompt";
import { promptEcosystemSelection } from "../../../../src/commands/update/ecosystems/prompt";
import type { EcosystemUpdate } from "../../../../src/commands/update/ecosystems/types";

const makeUpdate = (overrides: Partial<EcosystemUpdate> & Pick<EcosystemUpdate, "name" | "updateType">): EcosystemUpdate => {
    return {
        currentRef: "v1.0.0",
        currentVersion: "v1.0.0",
        ecosystem: "actions",
        file: "/repo/.github/workflows/ci.yml",
        line: 10,
        newRef: "v2.0.0",
        newVersion: "v2.0.0",
        original: "uses: foo@v1.0.0",
        replacement: "uses: foo@v2.0.0",
        ...overrides,
    };
};

const scriptedIO = (answers: string[]): { closeCalls: number; io: PromptIO; lines: string[] } => {
    const lines: string[] = [];
    let closeCalls = 0;
    const queue = [...answers];

    const io: PromptIO = {
        ask: async () => queue.shift() ?? "",
        close: () => {
            closeCalls += 1;
        },
        write: (line) => {
            lines.push(line);
        },
    };

    return {
        get closeCalls() {
            return closeCalls;
        },
        io,
        lines,
    };
};

describe(promptEcosystemSelection, () => {
    const updates = [
        makeUpdate({ name: "actions/checkout", updateType: "major" }),
        makeUpdate({ name: "actions/setup-node", updateType: "minor" }),
        makeUpdate({ ecosystem: "docker", name: "node", updateType: "patch" }),
    ];

    it("returns all updates on `a`", async () => {
        expect.assertions(2);

        const { io } = scriptedIO(["a"]);
        const selected = await promptEcosystemSelection(updates, io);

        expect(selected).toHaveLength(3);
        expect(selected.map((update) => update.name)).toStrictEqual(["actions/checkout", "actions/setup-node", "node"]);
    });

    it("returns only non-breaking updates on `s`", async () => {
        expect.assertions(2);

        const { io } = scriptedIO(["safe"]);
        const selected = await promptEcosystemSelection(updates, io);

        expect(selected).toHaveLength(2);
        expect(selected.every((update) => update.updateType !== "major")).toBe(true);
    });

    it("returns nothing on `n`", async () => {
        expect.assertions(1);

        const { io } = scriptedIO(["none"]);

        await expect(promptEcosystemSelection(updates, io)).resolves.toStrictEqual([]);
    });

    it("returns nothing on empty input (safe default)", async () => {
        expect.assertions(1);

        const { io } = scriptedIO([""]);

        await expect(promptEcosystemSelection(updates, io)).resolves.toStrictEqual([]);
    });

    it("parses comma-separated indices, ignoring out-of-range values", async () => {
        expect.assertions(2);

        const { io } = scriptedIO(["1, 3, 9"]);
        const selected = await promptEcosystemSelection(updates, io);

        expect(selected).toHaveLength(2);
        expect(selected.map((update) => update.name)).toStrictEqual(["actions/checkout", "node"]);
    });

    it("falls back to none on garbage input", async () => {
        expect.assertions(1);

        const { io } = scriptedIO(["maybe?"]);

        await expect(promptEcosystemSelection(updates, io)).resolves.toStrictEqual([]);
    });

    it("annotates breaking entries with [BREAKING] in the listing", async () => {
        expect.assertions(1);

        const { io, lines } = scriptedIO(["n"]);

        await promptEcosystemSelection(updates, io);

        expect(lines.some((line) => line.includes("actions/checkout") && line.includes("[BREAKING]"))).toBe(true);
    });

    it("closes the IO exactly once on every branch", async () => {
        expect.assertions(4);

        for (const answer of ["a", "safe", "n", "1"]) {
            const probe = scriptedIO([answer]);

            await promptEcosystemSelection(updates, probe.io);

            expect(probe.closeCalls).toBe(1);
        }
    });

    it("returns [] and closes immediately when given an empty update list", async () => {
        expect.assertions(2);

        const probe = scriptedIO([]);
        const selected = await promptEcosystemSelection([], probe.io);

        expect(selected).toStrictEqual([]);
        expect(probe.closeCalls).toBe(1);
    });
});
