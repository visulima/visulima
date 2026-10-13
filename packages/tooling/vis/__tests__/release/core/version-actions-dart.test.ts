import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { DartVersionActions } from "../../../src/release/core/version-actions/dart";
import { safeFetchVersionMetadata } from "../../../src/release/core/version-actions/fetch";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import type { WorkspacePackage } from "../../../src/release/types";

vi.mock(import("../../../src/release/core/version-actions/fetch"), () => {
    return {
        safeFetchVersionMetadata: vi.fn(),
    };
});

/**
 * The `dart` versionActions publishes with `dart pub publish --force` in the package
 * directory, after a `dart --version` probe and a pub.dev lookup. A dry run calls
 * none of them.
 */
describe(DartVersionActions, () => {
    const pkg: WorkspacePackage = {
        dir: "/work/core",
        ecosystem: "dart",
        manifest: { name: "core", private: false, version: "1.0.0" },
        manifestPath: "/work/core/pubspec.yaml",
        name: "core",
        private: false,
        version: "1.0.0",
    };

    const runs: { args: string[]; command: string; options: unknown }[] = [];

    const runner = (exitCode = 0): CommandRunner => {
        return {
            run: async (command: string, args: ReadonlyArray<string>, options: unknown) => {
                runs.push({ args: [...args], command, options });

                return { exitCode: args[0] === "pub" ? exitCode : 0, stderr: "boom", stdout: "" };
            },
        };
    };

    const context = (overrides: Partial<PublishContext> & { runnerExit?: number } = {}): PublishContext => ({
        catalogs: { default: {}, named: {} },
        pkg,
        pm: { id: "npm", minVersion: "8.0.0", runner: runner(overrides.runnerExit ?? 0) } as never,
        release: { name: "core", newVersion: "1.1.0" } as never,
        ...overrides,
    } as PublishContext);

    const fetchJson = (body: unknown, ok = true) => {
        vi.mocked(safeFetchVersionMetadata).mockResolvedValueOnce({
            ok,
            text: async () => JSON.stringify(body),
        } as never);
    };

    beforeEach(() => {
        runs.length = 0;
        vi.mocked(safeFetchVersionMetadata).mockReset();
    });

    it("dry run returns the planned command without any call", async () => {
        expect.hasAssertions();

        const result = await new DartVersionActions().publish(context({ dryRun: true }));

        expect(result).toMatchObject({ published: true });
        expect(result.output).toContain("dart pub publish --force");
        expect(runs).toHaveLength(0);
        expect(safeFetchVersionMetadata).not.toHaveBeenCalled();
    });

    it.skipIf(process.platform === "win32")("publishes with the exact argv, no shell, in the package directory", async () => {
        expect.hasAssertions();

        fetchJson({ name: "core", versions: [{ version: "1.0.0" }] });

        const result = await new DartVersionActions().publish(context());

        expect(result.published).toBe(true);
        expect(runs).toStrictEqual([
            { args: ["--version"], command: "dart", options: { cwd: "/work/core", silent: true } },
            { args: ["pub", "publish", "--force"], command: "dart", options: { cwd: "/work/core", silent: false } },
        ]);
        expect(vi.mocked(safeFetchVersionMetadata).mock.calls[0]?.[0]).toBe("https://pub.dev/api/packages/core");
    });

    it.skipIf(process.platform === "win32")("skips a version pub.dev already lists", async () => {
        expect.hasAssertions();

        fetchJson({ name: "core", versions: [{ version: "1.1.0" }] });

        const result = await new DartVersionActions().publish(context());

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
        expect(runs.map((run) => run.args)).toStrictEqual([["--version"]]);
    });

    it.skipIf(process.platform === "win32")("treats a failed lookup as not published and lets the publish report the error", async () => {
        expect.hasAssertions();

        vi.mocked(safeFetchVersionMetadata).mockRejectedValueOnce(new Error("offline"));

        await expect(new DartVersionActions().publish(context({ runnerExit: 1 }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });

    it.skipIf(process.platform === "win32")("throws PUBLISH_FAILED with a hint when the publish exits non-zero", async () => {
        expect.hasAssertions();

        fetchJson({ versions: [] });

        await expect(new DartVersionActions().publish(context({ runnerExit: 1 }))).rejects.toMatchObject({
            code: "PUBLISH_FAILED",
            hint: expect.stringContaining("dart pub token add"),
        });
    });

    it.skipIf(process.platform === "win32")("refuses when the Dart SDK is missing", async () => {
        expect.hasAssertions();

        const missing: CommandRunner = {
            run: async () => {
                throw new Error("ENOENT");
            },
        };

        await expect(new DartVersionActions().publish({ ...context(), pm: { id: "npm", runner: missing } as never })).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });

    it("refuses on win32 after the dry run", async () => {
        expect.hasAssertions();

        const original = Object.getOwnPropertyDescriptor(process, "platform")!;

        Object.defineProperty(process, "platform", { value: "win32" });

        try {
            await expect(new DartVersionActions().publish(context())).rejects.toMatchObject({ code: "CONFIG_INVALID" });
            expect(runs).toHaveLength(0);
        } finally {
            Object.defineProperty(process, "platform", original);
        }
    });
});
