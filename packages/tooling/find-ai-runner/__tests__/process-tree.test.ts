import { describe, expect, it } from "vitest";

import { getProcessAncestry, normalizeProcessName, parsePowershellRow, parseProcStat, parsePsRow, parseWmicRow, walkAncestry } from "../src/process-tree";

describe(normalizeProcessName, () => {
    it("strips directory prefixes, executable suffixes, and lowercases", () => {
        expect.assertions(4);

        expect(normalizeProcessName("/usr/bin/Node")).toBe("node");
        expect(normalizeProcessName(String.raw`C:\Program Files\Droid\droid.EXE`)).toBe("droid");
        expect(normalizeProcessName("octofriend")).toBe("octofriend");
        expect(normalizeProcessName("claude.cmd")).toBe("claude");
    });
});

describe(walkAncestry, () => {
    it("walks parent links from the start pid to the root", () => {
        expect.assertions(1);

        const table = new Map([
            [1, { comm: "systemd", ppid: 0 }],
            [50, { comm: "zsh", ppid: 1 }],
            [100, { comm: "node", ppid: 50 }],
        ]);

        expect(walkAncestry(table, 100)).toStrictEqual(["node", "zsh", "systemd"]);
    });

    it("stops at a missing entry and cannot loop on a cycle", () => {
        expect.assertions(2);

        expect(walkAncestry(new Map([[100, { comm: "node", ppid: 999 }]]), 100)).toStrictEqual(["node"]);

        // A -> B -> A cycle must terminate via the `seen` guard.
        const cyclic = new Map([
            [1, { comm: "a", ppid: 2 }],
            [2, { comm: "b", ppid: 1 }],
        ]);

        expect(walkAncestry(cyclic, 1)).toStrictEqual(["a", "b"]);
    });
});

describe(parsePsRow, () => {
    it("parses pid/ppid and keeps a comm with spaces intact", () => {
        expect.assertions(2);

        expect(parsePsRow("  123    45 my helper")).toStrictEqual({ comm: "my helper", pid: 123, ppid: 45 });
        expect(parsePsRow("1 0 launchd")).toStrictEqual({ comm: "launchd", pid: 1, ppid: 0 });
    });

    it("rejects header and malformed rows", () => {
        expect.assertions(3);

        expect(parsePsRow("")).toBeUndefined();
        expect(parsePsRow("PID PPID")).toBeUndefined();
        expect(parsePsRow("notanumber x comm")).toBeUndefined();
    });
});

describe(parseWmicRow, () => {
    it("parses the CSV columns Node,Name,ParentProcessId,ProcessId", () => {
        expect.assertions(1);

        expect(parseWmicRow("HOST,node.exe,50,123")).toStrictEqual({ comm: "node.exe", pid: 123, ppid: 50 });
    });

    it("rejects the header and short rows", () => {
        expect.assertions(2);

        expect(parseWmicRow("Node,Name,ParentProcessId,ProcessId")).toBeUndefined();
        expect(parseWmicRow("HOST,node.exe")).toBeUndefined();
    });
});

describe(parsePowershellRow, () => {
    it("parses the quoted CSV columns ProcessId,ParentProcessId,Name", () => {
        expect.assertions(1);

        expect(parsePowershellRow("\"123\",\"50\",\"node.exe\"")).toStrictEqual({ comm: "node.exe", pid: 123, ppid: 50 });
    });

    it("rejects the header and short rows", () => {
        expect.assertions(2);

        expect(parsePowershellRow("\"ProcessId\",\"ParentProcessId\",\"Name\"")).toBeUndefined();
        expect(parsePowershellRow("\"123\",\"50\"")).toBeUndefined();
    });
});

describe(parseProcStat, () => {
    it("slices comm between the first ( and last ) and reads ppid after the state", () => {
        expect.assertions(2);

        expect(parseProcStat("123 (node) S 45 123 123 0 -1 ...")).toStrictEqual({ comm: "node", ppid: 45 });
        // comm containing spaces and parentheses must survive.
        expect(parseProcStat("200 (weird (name) :)) R 7 200 ...")).toStrictEqual({ comm: "weird (name) :)", ppid: 7 });
    });

    it("returns undefined for malformed stat content", () => {
        expect.assertions(1);

        expect(parseProcStat("no parens here")).toBeUndefined();
    });
});

describe(getProcessAncestry, () => {
    it("returns the live ancestry of the current process as an array of names", async () => {
        expect.assertions(2);

        const ancestry = await getProcessAncestry();

        expect(Array.isArray(ancestry)).toBe(true);
        // The current process chain always has at least one entry, all normalized to lowercase strings.
        expect(ancestry.every((name) => typeof name === "string" && name === name.toLowerCase())).toBe(true);
    });
});
