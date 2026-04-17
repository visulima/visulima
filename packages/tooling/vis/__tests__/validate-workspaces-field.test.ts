import { describe, expect, it } from "vitest";

import { validateWorkspacesField } from "../src/workspace";

describe(validateWorkspacesField, () => {
    it("returns the array unchanged for a valid string[] form", () => {
        expect.assertions(1);
        expect(validateWorkspacesField(["packages/*", "apps/*"])).toStrictEqual(["packages/*", "apps/*"]);
    });

    it("returns packages from the object form (yarn berry compat)", () => {
        expect.assertions(1);
        expect(validateWorkspacesField({ packages: ["packages/*"] })).toStrictEqual(["packages/*"]);
    });

    it("rejects an empty array with a clear message", () => {
        expect.assertions(1);
        expect(() => validateWorkspacesField([])).toThrow(/empty array/);
    });

    it("rejects non-string entries", () => {
        expect.assertions(1);

        expect(() => validateWorkspacesField([123 as any])).toThrow(/non-empty glob string/);
    });

    it("rejects object form without packages", () => {
        expect.assertions(1);

        expect(() => validateWorkspacesField({} as any)).toThrow(/requires a `packages` array/);
    });

    it("rejects object form with non-array packages", () => {
        expect.assertions(1);

        expect(() => validateWorkspacesField({ packages: "packages/*" } as any)).toThrow(/expected an array/);
    });

    it("rejects scalar workspaces value", () => {
        expect.assertions(1);

        expect(() => validateWorkspacesField("packages/*" as any)).toThrow(/expected an array or/);
    });
});
