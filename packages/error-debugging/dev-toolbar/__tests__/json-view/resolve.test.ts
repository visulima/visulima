import { describe, expect, it } from "vitest";

import { evaluateVisibility, resolveElementProps } from "../../src/json-view/resolve";

describe(evaluateVisibility, () => {
    it("treats an absent condition as visible", () => {
        expect.hasAssertions();

        expect(evaluateVisibility(undefined, {})).toBe(true);
    });

    it("honours a literal boolean", () => {
        expect.hasAssertions();

        expect(evaluateVisibility(true, {})).toBe(true);
        expect(evaluateVisibility(false, {})).toBe(false);
    });

    it("tests the truthiness of the value at the path", () => {
        expect.hasAssertions();

        expect(evaluateVisibility({ $state: "/open" }, { open: true })).toBe(true);
        expect(evaluateVisibility({ $state: "/open" }, { open: false })).toBe(false);
        expect(evaluateVisibility({ $state: "/open" }, {})).toBe(false);
    });

    it("compares with eq, including against undefined", () => {
        expect.hasAssertions();

        expect(evaluateVisibility({ $state: "/tab", eq: "server" }, { tab: "server" })).toBe(true);
        expect(evaluateVisibility({ $state: "/tab", eq: "server" }, { tab: "build" })).toBe(false);
        expect(evaluateVisibility({ $state: "/tab", eq: undefined }, {})).toBe(true);
    });

    it("compares with neq", () => {
        expect.hasAssertions();

        expect(evaluateVisibility({ $state: "/tab", neq: "server" }, { tab: "build" })).toBe(true);
        expect(evaluateVisibility({ $state: "/tab", neq: "server" }, { tab: "server" })).toBe(false);
    });

    it("inverts whichever test ran with not", () => {
        expect.hasAssertions();

        expect(evaluateVisibility({ $state: "/open", not: true }, { open: false })).toBe(true);
        expect(evaluateVisibility({ $state: "/tab", eq: "server", not: true }, { tab: "server" })).toBe(false);
    });
});

describe(resolveElementProps, () => {
    it("replaces a binding with the value it points at", () => {
        expect.hasAssertions();

        expect(resolveElementProps({ expanded: { $state: "/open" } }, { open: true })).toStrictEqual({ expanded: true });
    });

    it("leaves a plain value alone", () => {
        expect.hasAssertions();

        expect(resolveElementProps({ label: "Refresh" }, {})).toStrictEqual({ label: "Refresh" });
    });

    it("does not mistake an ordinary object for a binding", () => {
        expect.hasAssertions();

        const rows = [{ key: "a", value: "b" }];

        expect(resolveElementProps({ rows, tabs: { $other: 1 } }, {})).toStrictEqual({ rows, tabs: { $other: 1 } });
    });

    it("resolves an unset path to undefined rather than throwing", () => {
        expect.hasAssertions();

        expect(resolveElementProps({ expanded: { $state: "/nope/deep" } }, {})).toStrictEqual({ expanded: undefined });
    });

    it("returns a fresh object so the spec cannot be mutated", () => {
        expect.hasAssertions();

        const properties = { label: "x" };

        expect(resolveElementProps(properties, {})).not.toBe(properties);
    });
});
