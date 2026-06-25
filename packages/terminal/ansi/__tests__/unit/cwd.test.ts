import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { notifyWorkingDirectory, setWorkingDirectory } from "../../src/cwd";

describe("working directory reporting (OSC 7)", () => {
    it("should build a file URL for a single absolute path", () => {
        expect.assertions(1);
        expect(notifyWorkingDirectory("", "/home/user")).toBe(`${OSC}7;file:///home/user${BEL}`);
    });

    it("should include the host when provided", () => {
        expect.assertions(1);
        expect(notifyWorkingDirectory("myhost", "/var/log")).toBe(`${OSC}7;file://myhost/var/log${BEL}`);
    });

    it("should join multiple path segments", () => {
        expect.assertions(1);
        expect(notifyWorkingDirectory("", "/home", "user", "projects")).toBe(`${OSC}7;file:///home/user/projects${BEL}`);
    });

    it("should ensure a leading slash for relative paths", () => {
        expect.assertions(1);
        expect(notifyWorkingDirectory("", "home", "user")).toBe(`${OSC}7;file:///home/user${BEL}`);
    });

    it("should percent-encode unsafe characters", () => {
        expect.assertions(1);
        expect(notifyWorkingDirectory("", "/home/a b")).toBe(`${OSC}7;file:///home/a%20b${BEL}`);
    });

    it("should expose setWorkingDirectory as an alias", () => {
        expect.assertions(1);
        expect(setWorkingDirectory).toBe(notifyWorkingDirectory);
    });
});
