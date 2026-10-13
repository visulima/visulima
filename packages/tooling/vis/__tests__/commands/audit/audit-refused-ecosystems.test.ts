import { describe, expect, it } from "vitest";

import { refusedEcosystemMessage } from "../../../src/commands/audit/handler";

/**
 * Pub (Dart) has a range matcher, so it is no longer refused. NuGet and SwiftURL
 * have last_affected ranges that the matcher cannot treat as inclusive, so the
 * audit refuses them instead of reporting a clean result.
 */
describe("vis audit refused ecosystems", () => {
    it("does not refuse Pub, its dart alias, or the canonical name", () => {
        expect.assertions(3);

        expect(refusedEcosystemMessage(["pub"])).toBeUndefined();
        expect(refusedEcosystemMessage(["dart"])).toBeUndefined();
        expect(refusedEcosystemMessage(["Pub"])).toBeUndefined();
    });

    it("refuses NuGet and names the last_affected reason", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["nuget"])).toContain("--ecosystem nuget is not supported");
        expect(refusedEcosystemMessage(["NuGet"])).toContain("last_affected");
    });

    it("keeps refusing SwiftURL under both of its names", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["swift"])).toContain("--ecosystem swift is not supported");
        expect(refusedEcosystemMessage(["swifturl"])).toContain("--ecosystem swifturl is not supported");
    });

    it("keeps refusing hex and zig", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["hex"])).toContain("Hex packages");
        expect(refusedEcosystemMessage(["zig"])).toContain("Zig");
    });

    it("refuses a mixed list when any entry is refused, and passes a clean list", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["npm", "pub", "nuget"])).toContain("--ecosystem nuget");
        expect(refusedEcosystemMessage(["npm", "pub", "cargo"])).toBeUndefined();
    });

    it("does not treat inherited object keys as refused ecosystems", () => {
        expect.assertions(1);

        expect(refusedEcosystemMessage(["constructor", "__proto__"])).toBeUndefined();
    });
});
