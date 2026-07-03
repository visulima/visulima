import { describe, expect, it } from "vitest";

import { hasPeerDependencyWarnings } from "../../src/util/peer-warnings";

describe(hasPeerDependencyWarnings, () => {
    it("matches the pnpm summary line", () => {
        expect.assertions(1);

        expect(hasPeerDependencyWarnings(" WARN  Issues with peer dependencies found\n")).toBe(true);
    });

    it("matches a per-line pnpm `unmet peer` row", () => {
        expect.assertions(1);

        expect(hasPeerDependencyWarnings("└── ✕ unmet peer marked@^18.0.3: found 15.0.12\n")).toBe(true);
    });

    it("matches npm ERESOLVE", () => {
        expect.assertions(1);

        expect(hasPeerDependencyWarnings("npm WARN ERESOLVE overriding peer dependency\n")).toBe(true);
    });

    it("matches yarn classic `unmet peer dependency`", () => {
        expect.assertions(1);

        expect(hasPeerDependencyWarnings("warning \"foo > bar\" has unmet peer dependency \"baz@^1.0.0\".\n")).toBe(true);
    });

    it("matches yarn berry YN0060", () => {
        expect.assertions(1);

        expect(hasPeerDependencyWarnings("➤ YN0060: │ react is listed by your project with version 19.0.0\n")).toBe(true);
    });

    it("returns false on clean output", () => {
        expect.assertions(2);

        expect(hasPeerDependencyWarnings("")).toBe(false);
        expect(hasPeerDependencyWarnings("Done in 4.2s.\n+ react 19.2.0\n")).toBe(false);
    });
});
