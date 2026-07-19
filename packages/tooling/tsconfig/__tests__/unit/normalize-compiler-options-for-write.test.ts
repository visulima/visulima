import { describe, expect, it } from "vitest";

import { normalizeCompilerOptionsForWrite } from "../../src/utils/normalize-compiler-options-for-write";

describe("normalizeCompilerOptionsForWrite", () => {
    it("maps numeric enum values to the string names a tsconfig parser accepts", () => {
        expect.assertions(1);

        // 99 = ScriptTarget.ESNext, 99 = ModuleKind.ESNext, 100 = ModuleResolutionKind.Bundler,
        // 4 = JsxEmit.ReactJSX — the numeric shape a resolved CompilerOptions object carries.
        expect(
            normalizeCompilerOptionsForWrite({
                jsx: 4 as never,
                module: 99 as never,
                moduleResolution: 100 as never,
                target: 99 as never,
            }),
        ).toStrictEqual({
            jsx: "react-jsx",
            module: "esnext",
            moduleResolution: "bundler",
            target: "esnext",
        });
    });

    it("passes through already-valid string enums and non-enum options untouched", () => {
        expect.assertions(1);

        expect(
            normalizeCompilerOptionsForWrite({
                lib: ["dom", "es2024"],
                module: "esnext",
                strict: true,
                target: "es2024",
            }),
        ).toStrictEqual({
            lib: ["dom", "es2024"],
            module: "esnext",
            strict: true,
            target: "es2024",
        });
    });

    it("drops an unknown numeric enum ordinal rather than emitting an invalid number", () => {
        expect.assertions(1);

        expect(normalizeCompilerOptionsForWrite({ target: 12_345 as never })).toStrictEqual({});
    });

    it("keeps TypeScript-7-removed options when no target major is given", () => {
        expect.assertions(1);

        expect(normalizeCompilerOptionsForWrite({ baseUrl: ".", strict: true })).toStrictEqual({
            baseUrl: ".",
            strict: true,
        });
    });

    it("drops options removed in the requested TypeScript major", () => {
        expect.assertions(1);

        expect(
            normalizeCompilerOptionsForWrite(
                {
                    baseUrl: ".",
                    importsNotUsedAsValues: "remove" as never,
                    strict: true,
                    target: 99 as never,
                },
                { removedForMajor: 7 },
            ),
        ).toStrictEqual({ strict: true, target: "esnext" });
    });

    it("does not mutate the input object", () => {
        expect.assertions(1);

        const input = { baseUrl: ".", target: 99 as never };

        normalizeCompilerOptionsForWrite(input, { removedForMajor: 7 });

        expect(input).toStrictEqual({ baseUrl: ".", target: 99 });
    });
});
