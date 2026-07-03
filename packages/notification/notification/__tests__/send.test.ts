import { describe, expect, it } from "vitest";

import { send } from "../src/notification";
import type { MockProviderInstance } from "../src/providers/mock";
import { mockProvider } from "../src/providers/mock";

describe(send, () => {
    it("delivers a one-shot send through a single provider", async () => {
        expect.assertions(2);

        const provider = mockProvider({ channel: "sms", id: "sms-mock" });
        const receipt = await send("sms", provider, { text: "hi", to: "+15555550100" });

        expect(receipt.successful).toBe(true);
        expect((provider.getInstance?.() as MockProviderInstance).sent).toHaveLength(1);
    });

    it("returns a failure receipt when the provider fails", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms", failWith: "down", id: "sms-mock" });
        const receipt = await send("sms", provider, { text: "hi", to: "+15555550100" });

        expect(receipt.successful).toBe(false);
    });
});
