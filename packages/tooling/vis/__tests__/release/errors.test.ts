import { describe, expect, it } from "vitest";

import { VisReleaseError, visReleaseError } from "../../src/release/errors";

describe(VisReleaseError, () => {
    it("preserves the code on the constructed instance", () => {
        const error = new VisReleaseError({ code: "CONFIG_INVALID", message: "bad" });

        expect(error.code).toBe("CONFIG_INVALID");
        expect(error.message).toBe("bad");
        expect(error.name).toBe("VisReleaseError");
    });

    it("is an instance of Error", () => {
        const error = new VisReleaseError({ code: "CONFIG_INVALID", message: "x" });

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(VisReleaseError);
    });

    it("attaches hint/docsUrl/packageName/file/line when provided", () => {
        const error = new VisReleaseError({
            code: "BUMP_FILE_INVALID",
            docsUrl: "https://example.com",
            file: ".vis/release/x.md",
            hint: "delete it",
            line: 7,
            message: "parse error",
            packageName: "@s/a",
        });

        expect(error.hint).toBe("delete it");
        expect(error.docsUrl).toBe("https://example.com");
        expect(error.packageName).toBe("@s/a");
        expect(error.file).toBe(".vis/release/x.md");
        expect(error.line).toBe(7);
    });

    it("leaves optional fields undefined when not passed", () => {
        const error = new VisReleaseError({ code: "PUBLISH_FAILED", message: "x" });

        expect(error.hint).toBeUndefined();
        expect(error.docsUrl).toBeUndefined();
        expect(error.packageName).toBeUndefined();
        expect(error.file).toBeUndefined();
        expect(error.line).toBeUndefined();
    });

    it("preserves `cause` for stack-trace continuity", () => {
        const inner = new Error("inner");
        const error = new VisReleaseError({ cause: inner, code: "PUBLISH_FAILED", message: "outer" });

        expect(error.cause).toBe(inner);
    });

    it("is catchable as a plain Error", () => {
        const fn = (): never => {
            throw new VisReleaseError({ code: "TAG_COLLISION", message: "boom" });
        };

        let caught: unknown;

        try {
            fn();
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(VisReleaseError);
        expect((caught as VisReleaseError).code).toBe("TAG_COLLISION");
    });
});

describe("visReleaseError factory", () => {
    it("produces a VisReleaseError with identical shape to `new`", () => {
        const a = visReleaseError({ code: "CONFIG_INVALID", hint: "fix it", message: "x" });
        const b = new VisReleaseError({ code: "CONFIG_INVALID", hint: "fix it", message: "x" });

        expect(a).toBeInstanceOf(VisReleaseError);
        expect(a.code).toBe(b.code);
        expect(a.message).toBe(b.message);
        expect(a.hint).toBe(b.hint);
    });
});
