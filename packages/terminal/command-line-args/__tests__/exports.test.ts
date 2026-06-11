import { describe, expect, it } from "vitest";

import commandLineArgsDefault, { commandLineArgs, defineOptions, parseArgs } from "../src";

describe("public exports", () => {
    it("exposes a default export equal to commandLineArgs", () => {
        expect.assertions(1);

        expect(commandLineArgsDefault).toBe(commandLineArgs);
    });

    it("exposes parseArgs as an alias of commandLineArgs", () => {
        expect.assertions(1);

        expect(parseArgs).toBe(commandLineArgs);
    });

    it("allows parseArgs without an options argument", () => {
        expect.assertions(1);

        const definitions = [{ name: "file", type: String }];

        // The original argv override is needed to avoid reading process.argv in tests;
        // the point of this test is that the call type-checks/compiles with no second arg
        // and a single explicit-argv call works.
        expect(parseArgs(definitions, { argv: ["--file", "a.txt"] })).toStrictEqual({ file: "a.txt" });
    });

    it("defineOptions returns the definitions unchanged", () => {
        expect.assertions(1);

        const definitions = [{ name: "file", type: String }] as const;

        expect(defineOptions(definitions)).toBe(definitions);
    });

    it("infers a precise result type from defineOptions (compile-time)", () => {
        expect.assertions(2);

        const definitions = defineOptions([
            { name: "file", type: String },
            { name: "verbose", type: Boolean },
        ]);

        const result = parseArgs(definitions, { argv: ["--file", "a.txt", "--verbose"] });

        // Destructuring only type-checks because the result is inferred as
        // { file: string | null; verbose: boolean; ... }.
        const { file, verbose } = result;
        const typedFile: string | null = file;
        const typedVerbose: boolean = verbose;

        expect(typedFile).toBe("a.txt");
        expect(typedVerbose).toBe(true);
    });
});
