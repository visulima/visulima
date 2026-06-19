import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installPolyfills } from "../../src/runtime/polyfills";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe(installPolyfills, () => {
    let workspace: string;

    beforeEach(() => {
        workspace = createTemporaryDirectory("vis-polyfill-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspace);
        vi.restoreAllMocks();
    });

    it("is a no-op when the global is already native (URLPattern on modern Node)", async () => {
        expect.hasAssertions();

        // URLPattern is native on the supported floor — feature-detect should skip
        // it entirely: no resolution attempt, no warning.
        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        await installPolyfills("urlpattern", workspace);

        expect(warn).not.toHaveBeenCalled();
    });

    it("warns (does not throw) when an opt-in polyfill package can't be resolved from cwd", async () => {
        expect.hasAssertions();

        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        // Temporal isn't native and @js-temporal/polyfill isn't installed in the
        // temp project → graceful warning, no throw, global stays absent.
        await expect(installPolyfills("temporal", workspace)).resolves.toBeUndefined();

        expect((globalThis as Record<string, unknown>)["Temporal"]).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String((warn.mock.calls[0] as unknown[])[0])).toContain("@js-temporal/polyfill");
    });

    it("ignores unknown polyfill names", async () => {
        expect.hasAssertions();

        const warn = vi.spyOn(process.stderr, "write").mockReturnValue(true);

        await installPolyfills("doesnotexist", workspace);

        expect(warn).not.toHaveBeenCalled();
    });
});
