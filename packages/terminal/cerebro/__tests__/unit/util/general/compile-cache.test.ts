/* eslint-disable n/no-unsupported-features/node-builtins */
import Module from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

import enableCompileCache from "../../../../src/util/general/compile-cache";

type EnableCompileCacheFunction = (...arguments_: unknown[]) => unknown;

interface ModuleWithCache {
    enableCompileCache?: EnableCompileCacheFunction;
}

const moduleWithCache = Module as unknown as ModuleWithCache;

const setNativeApi = (api: EnableCompileCacheFunction | undefined): void => {
    if (api === undefined) {
        delete moduleWithCache.enableCompileCache;
    } else {
        moduleWithCache.enableCompileCache = api;
    }
};

describe(enableCompileCache, () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls Module.enableCompileCache when the native API is available", () => {
        expect.assertions(1);

        // The native API ships on Node 22.8+. On Node 24 it's always present.
        // We stub it to a spy so the test is deterministic on any Node version.
        const spy = vi.fn();
        const originalApi = moduleWithCache.enableCompileCache;

        setNativeApi(spy);

        try {
            enableCompileCache();

            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            setNativeApi(originalApi);
        }
    });

    it("does not throw when Module.enableCompileCache is unavailable", () => {
        expect.assertions(1);

        const originalApi = moduleWithCache.enableCompileCache;

        setNativeApi(undefined);

        try {
            // Falls through to require("v8-compile-cache"). That package is not
            // installed in this workspace, so the inner try/catch swallows the
            // ENOENT and the call must complete without throwing.
            const run = (): void => {
                enableCompileCache();
            };

            expect(run).not.toThrow();
        } finally {
            setNativeApi(originalApi);
        }
    });

    it("does not throw when the native API itself throws", () => {
        expect.assertions(1);

        const originalApi = moduleWithCache.enableCompileCache;

        setNativeApi(() => {
            throw new Error("native failure");
        });

        try {
            const run = (): void => {
                enableCompileCache();
            };

            expect(run).not.toThrow();
        } finally {
            setNativeApi(originalApi);
        }
    });
});
