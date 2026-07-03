import { describe, expect, it } from "vitest";

import { mockProvider } from "../src/providers/mock";
import { isOk } from "../src/utils/result";

describe(mockProvider, () => {
    it("records sent payloads and returns a successful result", async () => {
        expect.assertions(4);

        const provider = mockProvider({ channel: "sms" });

        await provider.initialize();

        const result = await provider.send({ text: "hi", to: "+15555550100" } as never);

        expect(isOk(result)).toBe(true);
        expect(result.data?.provider).toBe("mock");

        const instance = provider.getInstance?.();

        expect(instance?.sent).toHaveLength(1);
        expect(instance?.last()?.messageId).toBe(result.data?.messageId);
    });

    it("fails deterministically when configured", async () => {
        expect.assertions(2);

        const provider = mockProvider({ failWith: "boom" });
        const result = await provider.send({ text: "x", to: "+15555550100" } as never);

        expect(result.success).toBe(false);
        expect((result.error as Error).message).toContain("boom");
    });
});
