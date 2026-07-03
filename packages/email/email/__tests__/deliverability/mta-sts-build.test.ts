import { describe, expect, it } from "vitest";

import { buildMtaStsPolicy, parseMtaStsPolicy } from "../../src/deliverability";

describe(buildMtaStsPolicy, () => {
    it("generates a policy that round-trips through the parser", () => {
        expect.assertions(4);

        const policy = buildMtaStsPolicy({ maxAge: 604_800, mode: "enforce", mx: ["mail.example.com", "*.example.com"] });

        expect(policy).toContain("version: STSv1");
        expect(policy).toContain("mx: *.example.com");

        const parsed = parseMtaStsPolicy(policy);

        expect(parsed.mode).toBe("enforce");
        expect(parsed.mx).toStrictEqual(["mail.example.com", "*.example.com"]);
    });
});
