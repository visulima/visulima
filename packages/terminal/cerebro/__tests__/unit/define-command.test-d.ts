/* eslint-disable vitest/prefer-expect-assertions -- `.test-d.ts` files are
   compiled, never executed: `expectTypeOf` is the assertion, and a runtime
   assertion counter here would be dead code. */
import { describe, expectTypeOf, it } from "vitest";

import { Cerebro as Cli } from "../../src";
import defineCommand from "../../src/define-command";
import type { InferArguments, InferEnv, InferOptions } from "../../src/types/infer";

// `.test-d.ts` files are compiled, never executed, so no runtime assertion
// helpers appear here — they would be dead code.
describe("defineCommand type inference", () => {
    it("infers option values from their type constructor", () => {
        defineCommand({
            execute: ({ options }) => {
                expectTypeOf(options.count).toEqualTypeOf<number | undefined>();
                expectTypeOf(options.name).toEqualTypeOf<string | undefined>();
                expectTypeOf(options.verbose).toEqualTypeOf<boolean | undefined>();
            },
            name: "build",
            options: {
                count: { type: Number },
                name: { type: String },
                verbose: { type: Boolean },
            },
        });
    });

    it("folds hyphen segments in option names and leaves everything else alone", () => {
        // The parser runs with `camelCase: true`, which folds hyphens only —
        // `api_key` and an already-camelCase name reach the toolbox untouched.
        expectTypeOf<
            InferOptions<{ api_key: { type: StringConstructor }; "output-dir": { type: StringConstructor }; outputDir: { type: StringConstructor } }>
        >().toEqualTypeOf<{
            api_key: string | undefined;
            outputDir: string | undefined;
        }>();
    });

    it("leaves an option name containing an uppercase letter unfolded", () => {
        // The parser skips names that already carry an uppercase letter.
        expectTypeOf<InferOptions<{ "Mixed-Case": { type: StringConstructor }; UPPER: { type: StringConstructor } }>>().toEqualTypeOf<{
            "Mixed-Case": string | undefined;
            UPPER: string | undefined;
        }>();
    });

    it("drops the undefined union for required options and options with a default", () => {
        expectTypeOf<
            InferOptions<{ out: { required: true; type: StringConstructor }; retries: { defaultValue: 3; type: NumberConstructor } }>
        >().toEqualTypeOf<{
            out: string;
            retries: number;
        }>();
    });

    it("keeps a required boolean option optional, matching the parser", () => {
        // `listMissingArguments` short-circuits a missing required boolean without
        // raising, and the substituted `false` never reaches `_all` — so the value
        // really can be absent.
        expectTypeOf<InferOptions<{ force: { required: true; type: BooleanConstructor } }>>().toEqualTypeOf<{ force: boolean | undefined }>();
        expectTypeOf<InferOptions<{ force: { defaultValue: false; required: true; type: BooleanConstructor } }>>().toEqualTypeOf<{ force: boolean }>();
    });

    it("produces arrays for multiple and lazyMultiple options", () => {
        expectTypeOf<
            InferOptions<{ file: { multiple: true; type: StringConstructor }; tag: { lazyMultiple: true; type: StringConstructor } }>
        >().toEqualTypeOf<{
            file: string[] | undefined;
            tag: string[] | undefined;
        }>();
    });

    it("uses the return type of a custom transform", () => {
        expectTypeOf<InferOptions<{ since: { required: true; type: (value: unknown) => Date } }>>().toEqualTypeOf<{ since: Date }>();
    });

    it("falls back to string when no type constructor is declared", () => {
        expectTypeOf<InferOptions<{ raw: { description: "a raw value" } }>>().toEqualTypeOf<{ raw: string | undefined }>();
    });

    it("keeps a declared positive half tri-state when it has no defaultValue", () => {
        // `negatable()` declares both halves. Without a `defaultValue` the
        // parsed options carry neither key, so the value really is `undefined`
        // and the handler is meant to fall back to config.
        expectTypeOf<InferOptions<{ "no-preflight": { type: BooleanConstructor }; preflight: { type: BooleanConstructor } }>>().toEqualTypeOf<{
            preflight: boolean | undefined;
        }>();

        expectTypeOf<InferOptions<{ "no-cache": { type: BooleanConstructor }; cache: { defaultValue: true; type: BooleanConstructor } }>>().toEqualTypeOf<{
            cache: boolean;
        }>();
    });

    it("exposes a no- prefixed option under its non-negated name only", () => {
        // `addNegatableOptions` generates `clean`, `mapNegatableOptions` deletes `noClean`.
        expectTypeOf<InferOptions<{ "no-clean": { type: BooleanConstructor } }>>().toEqualTypeOf<{ clean: boolean }>();
    });

    it("lowercases env names, which the env reader does but the option parser does not", () => {
        // `processEnvVariables` lowercases the whole name before folding snake
        // segments, so these two declarations collide differently than options do.
        expectTypeOf<InferEnv<{ API_KEY: { type: StringConstructor }; PORT: { defaultValue: 3000; type: NumberConstructor } }>>().toEqualTypeOf<{
            apiKey: string | undefined;
            port: number;
        }>();
        expectTypeOf<InferEnv<{ apiKey: { type: StringConstructor } }>>().toEqualTypeOf<{ apikey: string | undefined }>();
    });

    it("types the env object inside execute", () => {
        defineCommand({
            env: { API_KEY: { type: String }, DEBUG: { type: Boolean } },
            execute: ({ env }) => {
                expectTypeOf(env.apiKey).toEqualTypeOf<string | undefined>();
                expectTypeOf(env.debug).toEqualTypeOf<boolean | undefined>();
            },
            name: "build",
        });
    });

    it("infers named positional arguments, folding both separators", () => {
        expectTypeOf<
            InferArguments<[{ name: "source-file"; required: true; type: StringConstructor }, { multiple: true; name: "targets"; type: StringConstructor }]>
        >().toEqualTypeOf<{ sourceFile: string; targets: string[] | undefined }>();
    });

    it("keeps positional names literal without an as const assertion", () => {
        defineCommand({
            // `defineCommand` declares `const TArguments`, so the tuple stays
            // literal with no ceremony at the call site.
            arguments: [
                { name: "source", required: true, type: String },
                { name: "count", type: Number },
            ],
            execute: ({ args }) => {
                expectTypeOf(args.source).toEqualTypeOf<string>();
                expectTypeOf(args.count).toEqualTypeOf<number | undefined>();
            },
            name: "copy",
        });
    });

    it("hands a defineCommand result to addCommand without a cast", () => {
        // The integration point the feature exists for. Asserted here because
        // the runtime specs are outside the type-check project, so a mismatch
        // between `DefinedCommand` and `CommandInput` would otherwise ship green.
        const build = defineCommand({
            arguments: [{ name: "entry", required: true, type: String }],
            execute: ({ args, options }) => {
                expectTypeOf(args.entry).toEqualTypeOf<string>();
                expectTypeOf(options.outDir).toEqualTypeOf<string | undefined>();
            },
            name: "build",
            options: { "out-dir": { type: String } },
        });

        new Cli("MyCLI").addCommand(build);
    });

    it("folds a name only where the parser folds it", () => {
        // Transcribed from `command-line-args`' /-([a-z])/g: a hyphen folds into
        // the next character only when it is an ASCII lowercase letter.
        expectTypeOf<
            InferOptions<{
                "a-1": { type: StringConstructor };
                "a--b": { type: StringConstructor };
                "A-b": { type: StringConstructor };
                "a-b-": { type: StringConstructor };
                "x-": { type: StringConstructor };
            }>
        >().toEqualTypeOf<{
            "a-1": string | undefined;
            "a-B": string | undefined;
            AB: string | undefined;
            "aB-": string | undefined;
            "x-": string | undefined;
        }>();
    });

    it("keeps a required boolean positional non-optional, unlike a required boolean option", () => {
        // `resolveArguments` reports every unfilled required slot whatever its
        // type, so the boolean carve-out that options need does not apply here.
        expectTypeOf<InferArguments<[{ name: "enabled"; required: true; type: BooleanConstructor }]>>().toEqualTypeOf<{ enabled: boolean }>();
        expectTypeOf<InferOptions<{ enabled: { required: true; type: BooleanConstructor } }>>().toEqualTypeOf<{ enabled: boolean | undefined }>();
    });

    it("folds positional names the same way options are folded", () => {
        expectTypeOf<
            InferArguments<[{ name: "source-file"; required: true; type: StringConstructor }, { name: "UPPER"; type: StringConstructor }]>
        >().toEqualTypeOf<{ sourceFile: string; UPPER: string | undefined }>();
    });

    it("rejects an option name that was not declared", () => {
        defineCommand({
            execute: ({ options }) => {
                // @ts-expect-error -- `typo` is not a declared option
                expectTypeOf(options.typo).toBeUnknown();
            },
            name: "build",
            options: { verbose: { type: Boolean } },
        });
    });
});
