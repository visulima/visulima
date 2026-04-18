import { describe, expect, it } from "vitest";

import { isRemoteSource } from "../../src/generate/remote";

describe(isRemoteSource, () => {
    it("should recognise giget-compatible protocols", () => {
        expect.assertions(7);

        expect(isRemoteSource("git://github.com/org/repo#main")).toBe(true);
        expect(isRemoteSource("npm://@scope/pkg")).toBe(true);
        expect(isRemoteSource("https://github.com/org/repo/archive/main.tar.gz")).toBe(true);
        expect(isRemoteSource("github:org/repo")).toBe(true);
        expect(isRemoteSource("gitlab:org/repo")).toBe(true);
        expect(isRemoteSource("bitbucket:org/repo")).toBe(true);
        expect(isRemoteSource("sourcehut:org/repo")).toBe(true);
    });

    it("should reject local paths and bare names", () => {
        expect.assertions(4);

        expect(isRemoteSource("package")).toBe(false);
        expect(isRemoteSource("./templates/foo")).toBe(false);
        expect(isRemoteSource("/abs/path")).toBe(false);
        expect(isRemoteSource("")).toBe(false);
    });
});
