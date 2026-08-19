import { getVitestConfig } from "../../../tools/get-vitest-config";

// Force colorize on before vitest loads test modules so colorize-driven
// snapshots stay stable in CI/lint-staged contexts where stdout is not a TTY.
process.env.FORCE_COLOR = "1";
delete process.env.NO_COLOR;

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
        // `defineCommand`'s value is entirely type-level, so its assertions only
        // mean anything when the compiler runs over them.
        //
        // `tsconfig.typecheck.json` widens `tsconfig.json` (src only) by one glob
        // so the `.test-d.ts` specs compile. The runtime specs under `__tests__`
        // stay out: they have never been type-checked and carry pre-existing
        // errors that would drown out these assertions. Bringing them in is its
        // own change. Keep that file's non-test globs in sync with
        // `tsconfig.json` — TypeScript has no include-merge.
        typecheck: {
            enabled: true,
            include: ["__tests__/**/*.test-d.ts"],
            tsconfig: "./tsconfig.typecheck.json",
        },
    },
});

export default config;
