import { describe, expect, it, vi } from "vitest";

import type { CommandExecute } from "../../../src/types/command";
import { lazyNamed } from "../../../src/util/lazy-named";

describe(lazyNamed, () => {
    it("returns a loader that resolves the named export wrapped as a default module", async () => {
        expect.assertions(3);

        const cacheListExecute: CommandExecute = vi.fn();
        const cacheCleanExecute: CommandExecute = vi.fn();

        const load = vi.fn(() => Promise.resolve({ cacheCleanExecute, cacheListExecute }));

        const loader = lazyNamed(load, "cacheListExecute");

        // The loader must be lazy: importing the module only happens on invocation.
        expect(load).not.toHaveBeenCalled();

        const loadedModule = await loader();

        expect(load).toHaveBeenCalledTimes(1);
        expect(loadedModule.default).toBe(cacheListExecute);
    });

    it("picks the correct named export when multiple handlers share a module", async () => {
        expect.assertions(1);

        const first: CommandExecute = vi.fn();
        const second: CommandExecute = vi.fn();

        const loader = lazyNamed(() => Promise.resolve({ first, second }), "second");

        const loadedModule = await loader();

        expect(loadedModule.default).toBe(second);
    });
});
