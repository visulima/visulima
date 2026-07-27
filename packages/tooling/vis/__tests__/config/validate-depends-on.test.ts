import { describe, expect, it } from "vitest";

import { validateDependsOnEntries } from "../../src/config/workspace";

describe(validateDependsOnEntries, () => {
    it("should accept a bare target name", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries(["build"], "web", "test"); }).not.toThrow();
    });

    it("should accept the ^target dependency form", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries(["^build"], "web", "build"); }).not.toThrow();
    });

    it("should accept the object form", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries([{ projects: "api", target: "build" }], "web", "build"); }).not.toThrow();
    });

    it("should accept a target that does not exist yet", () => {
        expect.assertions(1);

        // Legal name, possibly not defined anywhere — the runner already
        // warns about that. Not this validator's job.
        expect(() => { validateDependsOnEntries(["default", "^public"], "web", "lint"); }).not.toThrow();
    });

    it("should reject a {projectRoot} token path meant for inputs", () => {
        expect.assertions(2);

        expect(() => { validateDependsOnEntries(["{projectRoot}/vite.config.ts"], "web", "test"); }).toThrow(/is a file pattern, not a target name/);
        expect(() => { validateDependsOnEntries(["{projectRoot}/vite.config.ts"], "web", "test"); }).toThrow(/belong in `inputs`/);
    });

    it("should reject a workspaceRoot token path", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries(["{workspaceRoot}/tsconfig.json"], "web", "test"); }).toThrow(/file pattern/);
    });

    it("should reject a glob", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries(["src/**/*.ts"], "web", "test"); }).toThrow(/file pattern/);
    });

    it("should name the offending project and target", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries(["{projectRoot}/x.ts"], "convex-audit-history", "lint:package-json"); }).toThrow(
            /convex-audit-history:lint:package-json/,
        );
    });

    it("should redirect a project:target string to the object form", () => {
        expect.assertions(2);

        expect(() => { validateDependsOnEntries(["api:build"], "web", "build"); }).toThrow(/looks like a task id/);
        expect(() => { validateDependsOnEntries(["api:build"], "web", "build"); }).toThrow(/\{ target: "build", projects: "api" \}/);
    });

    it("should reject an entry that names no target", () => {
        expect.assertions(2);

        expect(() => { validateDependsOnEntries([""], "web", "build"); }).toThrow(/names no target/);
        expect(() => { validateDependsOnEntries(["^"], "web", "build"); }).toThrow(/names no target/);
    });

    it("should reject a file pattern in the object form's target", () => {
        expect.assertions(1);

        // Object-form `target` reaches the same resolver as a bare string,
        // so it fails the same silent way and must be rejected the same way.
        expect(() => { validateDependsOnEntries([{ projects: "api", target: "{projectRoot}/x.ts" }], "web", "build"); }).toThrow(/file pattern/);
    });

    it("should reject a task id in the object form's target", () => {
        expect.assertions(2);

        expect(() => { validateDependsOnEntries([{ target: "api:build" }], "web", "build"); }).toThrow(/looks like a task id/);
        expect(() => { validateDependsOnEntries([{ target: "api:build" }], "web", "build"); }).toThrow(/Split it across the two fields/);
    });

    it("should reject a non-string target", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries([{ target: 42 }], "web", "build"); }).toThrow(/must be a string/);
    });

    it("should reject an object entry with no target key", () => {
        expect.assertions(1);

        expect(() => { validateDependsOnEntries([{ projects: "api" }], "web", "build"); }).toThrow(/must declare a `target`/);
    });
});
