import { describe, expect, it } from "vitest";

import { rewriteUvLockVersion, specifierAccepts } from "../../../src/release/core/python-plan";
import { normalizePythonName, splitRequirement } from "../../../src/release/core/python-projects";

/**
 * PEP 440 subset and uv.lock rules. A specifier is only reported when a clause
 * it can read excludes the new version; unreadable clauses never warn.
 */
describe("python-plan: specifierAccepts", () => {
    it("accepts a version inside every clause", () => {
        expect.hasAssertions();

        expect(specifierAccepts(">=0.1,<0.3", "0.2.0")).toBe(true);
        expect(specifierAccepts("~=1.2", "1.9.0")).toBe(true);
        expect(specifierAccepts("~=1.2.0", "1.2.9")).toBe(true);
    });

    it("rejects a version a clause excludes", () => {
        expect.hasAssertions();

        expect(specifierAccepts("==0.1.0", "0.2.0")).toBe(false);
        expect(specifierAccepts("<0.2", "0.2.0")).toBe(false);
        expect(specifierAccepts("~=1.2.0", "1.3.0")).toBe(false);
        expect(specifierAccepts("~=1.2", "2.0.0")).toBe(false);
    });

    it("does not warn about a clause it cannot read", () => {
        expect.hasAssertions();

        expect(specifierAccepts("===weird", "9.9.9")).toBe(true);
    });
});

describe("python-plan: rewriteUvLockVersion", () => {
    it("rewrites only the workspace-member entry, matched by normalized name", () => {
        expect.hasAssertions();

        const lock = [
            "version = 1",
            "",
            "[[package]]",
            "name = \"my-lib\"",
            "version = \"0.1.0\"",
            "source = { editable = \".\" }",
            "",
            "[[package]]",
            "name = \"requests\"",
            "version = \"2.31.0\"",
            "source = { registry = \"https://pypi.org/simple\" }",
            "",
        ].join("\n");

        const result = rewriteUvLockVersion(lock, "My_Lib", "0.2.0");

        expect(result.found).toBe(true);
        expect(result.content).toContain("name = \"my-lib\"\nversion = \"0.2.0\"");
        expect(result.content).toContain("name = \"requests\"\nversion = \"2.31.0\"");
    });

    it("never rewrites a registry entry that shares the name", () => {
        expect.hasAssertions();

        const lock = "[[package]]\nname = \"lib\"\nversion = \"1.0.0\"\nsource = { registry = \"https://pypi.org/simple\" }\n";

        expect(rewriteUvLockVersion(lock, "lib", "2.0.0")).toStrictEqual({ found: false });
    });
});

describe("python-projects: requirement parsing", () => {
    it("splits name, extras and specifier, and drops markers", () => {
        expect.hasAssertions();

        expect(splitRequirement("requests[socks]>=2.0; python_version < '3.9'")).toStrictEqual({ name: "requests", specifier: ">=2.0" });
        expect(splitRequirement("my_lib")).toStrictEqual({ name: "my_lib", specifier: "" });
    });

    it("normalizes names per PEP 503", () => {
        expect.hasAssertions();

        expect(normalizePythonName("My__Lib.Name")).toBe("my-lib-name");
    });
});
