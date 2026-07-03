import { getVitestConfig } from "../../../tools/get-vitest-config";

// Force colorize on before vitest loads test modules so colorize-driven
// snapshots stay stable in CI/lint-staged contexts where stdout is not a TTY.
process.env.FORCE_COLOR = "1";
delete process.env.NO_COLOR;

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
    },
});

export default config;
