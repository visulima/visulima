import { describe, expect, it } from "vitest";

import { decidePty } from "../../src/task/pty-decision";

describe(decidePty, () => {
    describe("per-task override wins over workspace state", () => {
        it("task.pty: true forces PTY even when workspace and interactive both disable", () => {
            expect.assertions(1);

            expect(
                decidePty({
                    interactive: false,
                    taskPty: true,
                    workspacePty: false,
                }),
            ).toBe(true);
        });

        it("task.pty: false suppresses PTY even when workspace + interactive both want it", () => {
            expect.assertions(1);

            // The originally-flagged gap: existing tests covered
            // the "force on" direction (task.pty: true); this one
            // proves the "force off" direction works too.
            expect(
                decidePty({
                    interactive: true,
                    taskPty: false,
                    workspacePty: true,
                }),
            ).toBe(false);
        });
    });

    describe("workspace fall-through when task doesn't override", () => {
        it("interactive + workspacePty undefined → PTY", () => {
            expect.assertions(1);
            expect(decidePty({ interactive: true, taskPty: undefined, workspacePty: undefined })).toBe(true);
        });

        it("interactive + workspacePty true → PTY", () => {
            expect.assertions(1);
            expect(decidePty({ interactive: true, taskPty: undefined, workspacePty: true })).toBe(true);
        });

        it("interactive + workspacePty false → no PTY (workspace explicitly disabled)", () => {
            expect.assertions(1);
            expect(decidePty({ interactive: true, taskPty: undefined, workspacePty: false })).toBe(false);
        });

        it("non-interactive → no PTY regardless of workspacePty", () => {
            expect.assertions(2);
            expect(decidePty({ interactive: false, taskPty: undefined, workspacePty: true })).toBe(false);
            expect(decidePty({ interactive: false, taskPty: undefined, workspacePty: undefined })).toBe(false);
        });
    });
});
