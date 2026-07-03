import { beforeEach, describe, expect, it, vi } from "vitest";

import { isRegistrySpec, maybeGateFirstRun, parsePackageSpec } from "../../src/dlx/first-run";
import { markSeen } from "../../src/dlx/first-run-state";
import type { PackageInfo } from "../../src/dlx/package-info";
import { gatherPackageInfo } from "../../src/dlx/package-info";

vi.mock(import("../../src/dlx/package-info"), () => {
    return { gatherPackageInfo: vi.fn() };
});
vi.mock(import("../../src/dlx/first-run-state"), () => {
    return {
        getSeenEntry: () => undefined,
        markSeen: vi.fn(),
        readDlxSeen: () => {
            return { packages: {}, version: 1 };
        },
        shouldReprompt: () => true,
    };
});

const INFO: PackageInfo = {
    changelog: { lines: ["- fix: a thing"], source: "package-file", version: "1.0.0" },
    name: "demo",
    permissions: { bins: ["demo"], capabilities: [], lifecycleScripts: ["postinstall"] },
    security: { alerts: [], available: true, highSeverityKeys: [], score: 84 },
    size: { fileCount: 10, tarballBytes: 4096, unpackedBytes: 1_234_567 },
    version: "1.0.0",
};

const mockedGather = vi.mocked(gatherPackageInfo);

describe(parsePackageSpec, () => {
    it.each([
        ["create-vite", { name: "create-vite" }],
        ["typescript@5.5.4", { name: "typescript", spec: "5.5.4" }],
        ["pkg@next", { name: "pkg", spec: "next" }],
        ["@scope/pkg", { name: "@scope/pkg" }],
        ["@scope/pkg@1.2.3", { name: "@scope/pkg", spec: "1.2.3" }],
    ])("parses %s", (argument, expected) => {
        expect.assertions(1);

        expect(parsePackageSpec(argument)).toStrictEqual(expected);
    });
});

describe(isRegistrySpec, () => {
    it.each([
        ["create-vite", true],
        ["typescript@5.5.4", true],
        ["@scope/pkg@1.2.3", true],
        ["", false],
        ["./local/dir", false],
        ["/abs/path", false],
        ["git+https://github.com/x/y.git", false],
        ["file:../foo", false],
        ["npm:left-pad@1.0.0", false],
        ["github:user/repo", false],
    ])("classifies %s", (pkg, expected) => {
        expect.assertions(1);

        expect(isRegistrySpec(pkg)).toBe(expected);
    });

    it("skips the gate for a non-registry spec without gathering info", async () => {
        expect.assertions(2);

        const result = await maybeGateFirstRun({
            isCi: false,
            isTty: true,
            output: () => {},
            pkg: "git+https://github.com/x/y.git",
            readline: async () => "n",
        });

        expect(result).toStrictEqual({ proceed: true });
        expect(mockedGather).not.toHaveBeenCalled();
    });
});

describe(maybeGateFirstRun, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGather.mockResolvedValue(INFO);
    });

    it("skips entirely when --no-info", async () => {
        expect.assertions(2);

        const result = await maybeGateFirstRun({ noInfo: true, pkg: "demo" });

        expect(result).toStrictEqual({ proceed: true });
        expect(mockedGather).not.toHaveBeenCalled();
    });

    it("takes the fast path under --yes without gathering info", async () => {
        expect.assertions(2);

        const result = await maybeGateFirstRun({ isCi: false, isTty: true, pkg: "demo", yes: true });

        expect(result).toStrictEqual({ proceed: true });
        expect(mockedGather).not.toHaveBeenCalled();
    });

    it("auto-proceeds without a panel when non-interactive", async () => {
        expect.assertions(2);

        const result = await maybeGateFirstRun({ isCi: false, isTty: false, pkg: "demo" });

        expect(result).toStrictEqual({ proceed: true });
        expect(mockedGather).not.toHaveBeenCalled();
    });

    it("shows the panel and aborts when the user declines", async () => {
        expect.assertions(3);

        const chunks: string[] = [];
        const result = await maybeGateFirstRun({
            isCi: false,
            isTty: true,
            output: (chunk) => chunks.push(chunk),
            pkg: "demo",
            readline: async () => "n",
        });

        expect(result).toStrictEqual({ proceed: false });
        expect(chunks.join("")).toContain("first run: demo@1.0.0");
        expect(markSeen).not.toHaveBeenCalled();
    });

    it("records approval and proceeds when the user accepts", async () => {
        expect.assertions(2);

        const result = await maybeGateFirstRun({
            isCi: false,
            isTty: true,
            now: 123,
            output: () => {},
            pkg: "demo",
            readline: async () => "y",
        });

        expect(result).toStrictEqual({ proceed: true });
        expect(markSeen).toHaveBeenCalledWith("demo", "1.0.0", [], 123);
    });

    it("proceeds without blocking when the package cannot be resolved", async () => {
        expect.assertions(1);

        mockedGather.mockResolvedValue(undefined);

        const result = await maybeGateFirstRun({ isCi: false, isTty: true, output: () => {}, pkg: "ghost", readline: async () => "n" });

        expect(result).toStrictEqual({ proceed: true });
    });
});
