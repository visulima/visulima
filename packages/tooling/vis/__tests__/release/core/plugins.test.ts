import { describe, expect, it, vi } from "vitest";

import { defineReleasePlugin, runAfterPublishAllHooks, runAfterPublishHooks, runApplyDraftHooks, runWillPublishHooks } from "../../../src/release/core/plugins";
import type { PluginPackageInfo, ReleasePlan, ReleasePlugin, ReleasePluginContext } from "../../../src/release/types";

const ctxWith = (plugins: ReleasePlugin[]): ReleasePluginContext => {
    return { config: { plugins }, cwd: "/repo" };
};

const emptyPlan: ReleasePlan = { consumedChangeFiles: [], releases: [], warnings: [] };
const pkg: PluginPackageInfo = { dir: "/repo/packages/a", name: "@scope/a", oldVersion: "1.0.0", version: "1.1.0" };

describe("plugins: defineReleasePlugin", () => {
    it("returns the plugin unchanged", () => {
        expect.hasAssertions();

        const plugin = { name: "x" };

        expect(defineReleasePlugin(plugin)).toBe(plugin);
    });
});

describe("plugins: runWillPublishHooks", () => {
    it("allows the publish when no plugin vetoes", async () => {
        expect.hasAssertions();

        const verdict = await runWillPublishHooks(ctxWith([{ name: "a", willPublish: () => undefined }]), pkg);

        expect(verdict).toStrictEqual({ skip: false });
    });

    it("vetoes when a plugin returns false and reports which one", async () => {
        expect.hasAssertions();

        const verdict = await runWillPublishHooks(
            ctxWith([
                { name: "allow", willPublish: () => true },
                { name: "veto", willPublish: () => false },
            ]),
            pkg,
        );

        expect(verdict).toStrictEqual({ by: "veto", skip: true });
    });

    it("stops at the first veto", async () => {
        expect.hasAssertions();

        const second = vi.fn(() => false);

        await runWillPublishHooks(
            ctxWith([
                { name: "first", willPublish: () => false },
                { name: "second", willPublish: second },
            ]),
            pkg,
        );

        expect(second).not.toHaveBeenCalled();
    });

    it("propagates a thrown error (gating hook)", async () => {
        expect.hasAssertions();

        await expect(
            runWillPublishHooks(
                ctxWith([
                    {
                        name: "boom",
                        willPublish: () => {
                            throw new Error("nope");
                        },
                    },
                ]),
                pkg,
            ),
        ).rejects.toThrow("nope");
    });
});

describe("plugins: runApplyDraftHooks", () => {
    it("runs every applyDraft in order with the plan", async () => {
        expect.hasAssertions();

        const seen: string[] = [];

        await runApplyDraftHooks(
            ctxWith([
                {
                    applyDraft: ({ plan }) => {
                        seen.push(`a:${plan.releases.length}`);
                    },
                    name: "a",
                },
                {
                    applyDraft: () => {
                        seen.push("b");
                    },
                    name: "b",
                },
            ]),
            emptyPlan,
        );

        expect(seen).toStrictEqual(["a:0", "b"]);
    });

    it("propagates a thrown error (gating hook)", async () => {
        expect.hasAssertions();

        await expect(
            runApplyDraftHooks(
                ctxWith([
                    {
                        applyDraft: () => {
                            throw new Error("draft-fail");
                        },
                        name: "x",
                    },
                ]),
                emptyPlan,
            ),
        ).rejects.toThrow("draft-fail");
    });
});

describe("plugins: post-effect hooks swallow errors", () => {
    it("runAfterPublishHooks logs but does not throw, and keeps running later plugins", async () => {
        expect.hasAssertions();

        const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const later = vi.fn();

        await expect(
            runAfterPublishHooks(
                ctxWith([
                    {
                        afterPublish: () => {
                            throw new Error("side-effect");
                        },
                        name: "bad",
                    },
                    { afterPublish: later, name: "good" },
                ]),
                pkg,
            ),
        ).resolves.toBeUndefined();

        expect(later).toHaveBeenCalledTimes(1);
        expect(stderr).toHaveBeenCalledWith(expect.stringContaining("plugin \"bad\" afterPublish"));

        stderr.mockRestore();
    });

    it("runAfterPublishAllHooks logs but does not throw", async () => {
        expect.hasAssertions();

        const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        const summary = { failed: [], published: [{ name: "@scope/a", version: "1.1.0" }], skipped: [] };

        await expect(
            runAfterPublishAllHooks(
                ctxWith([
                    {
                        afterPublishAll: ({ result }) => {
                            if (result.published.length > 0) {
                                throw new Error("notify-fail");
                            }
                        },
                        name: "notifier",
                    },
                ]),
                summary,
            ),
        ).resolves.toBeUndefined();

        expect(stderr).toHaveBeenCalledWith(expect.stringContaining("plugin \"notifier\" afterPublishAll"));

        stderr.mockRestore();
    });
});
