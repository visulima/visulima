import { describe, expect, it } from "vitest";

import { createLoggerStorage } from "../../../../src/middleware/shared/storage";
import type { WideEvent } from "../../../../src/wide-event";

describe(createLoggerStorage, () => {
    it("should throw when useLogger is called outside a storage context", () => {
        expect.assertions(1);

        const { useLogger } = createLoggerStorage("test middleware context.");

        expect(() => useLogger()).toThrow("test middleware context.");
    });

    it("should return the stored logger when called within storage.run", () => {
        expect.assertions(1);

        const { storage, useLogger } = createLoggerStorage("test middleware context.");
        const fakeLogger = { name: "fake" } as unknown as WideEvent;

        const resolved = storage.run(fakeLogger, () => useLogger());

        expect(resolved).toBe(fakeLogger);
    });
});
