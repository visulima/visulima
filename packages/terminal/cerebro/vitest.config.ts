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
        typecheck: {
            enabled: true,
            include: ["__tests__/**/*.test-d.ts"],
            tsconfig: "./tsconfig.typecheck.json",
        },
    },
});

export default config;
