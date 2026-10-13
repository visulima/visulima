import { describe, expect, it } from "vitest";

import { refusedEcosystemMessage } from "../../../src/commands/audit/handler";

/**
 * Pub, NuGet and SwiftURL have range matchers that treat OSV last_affected as an inclusive bound,
 * so the audit scans them. Hex and Zig stay refused: no Hex lockfile reader or matcher exists here,
 * and OSV has no Zig ecosystem.
 */
describe("vis audit refused ecosystems", () => {
    it("does not refuse Pub, its dart alias, or the canonical name", () => {
        expect.assertions(3);

        expect(refusedEcosystemMessage(["pub"])).toBeUndefined();
        expect(refusedEcosystemMessage(["dart"])).toBeUndefined();
        expect(refusedEcosystemMessage(["Pub"])).toBeUndefined();
    });

    it("does not refuse NuGet", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["nuget"])).toBeUndefined();
        expect(refusedEcosystemMessage(["NuGet"])).toBeUndefined();
    });

    it("does not refuse SwiftURL under either of its names", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["swift"])).toBeUndefined();
        expect(refusedEcosystemMessage(["swifturl"])).toBeUndefined();
    });

    it("keeps refusing hex and zig", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["hex"])).toContain("Hex packages");
        expect(refusedEcosystemMessage(["zig"])).toContain("Zig");
    });

    it("refuses a mixed list when any entry is refused, and passes a clean list", () => {
        expect.assertions(2);

        expect(refusedEcosystemMessage(["npm", "pub", "hex"])).toContain("--ecosystem hex");
        expect(refusedEcosystemMessage(["npm", "pub", "nuget", "cargo"])).toBeUndefined();
    });

    it("does not treat inherited object keys as refused ecosystems", () => {
        expect.assertions(1);

        expect(refusedEcosystemMessage(["constructor", "__proto__"])).toBeUndefined();
    });
});
