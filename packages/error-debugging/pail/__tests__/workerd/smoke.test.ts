import { describe, expect, it } from "vitest";

describe("workerd smoke", () => {
    it("runs inside workerd, not node", () => {
        expect.assertions(1);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- workerd always provides `navigator`
        expect(navigator.userAgent).toBe("Cloudflare-Workers");
    });
});
