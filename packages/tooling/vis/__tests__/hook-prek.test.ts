import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrekConfig } from "../src/commands/hook/prek";
import { buildHookCommand, convertPrekConfig, detectPrekConfig, detectUnsupportedPrekConfig, mapPrekStage, migrateFromPrek, parsePrekConfig, resolveStages } from "../src/commands/hook/prek";

// ─── Helpers ────────────────────────────────────────────────────────

const createTemporaryDirectory = (): { cleanup: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-prek-test-"));

    return {
        cleanup: () => {
            rmSync(root, { force: true, recursive: true });
        },
        root,
    };
};

const createTemporaryGitRepo = (): { cleanup: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-prek-test-"));
    const originalCwd = process.cwd();

    spawnSync("git", ["init"], { cwd: root, stdio: "ignore" });
    process.chdir(root);

    return {
        cleanup: () => {
            process.chdir(originalCwd);
            rmSync(root, { force: true, recursive: true });
        },
        root,
    };
};

const noopLogger = { info: (): void => undefined, warn: (): void => undefined };

const collectLogger = (): { info: (message: string) => void; messages: string[]; warn: (message: string) => void; warnings: string[] } => {
    const messages: string[] = [];
    const warnings: string[] = [];

    return {
        info: (message: string) => messages.push(message),
        messages,
        warn: (message: string) => warnings.push(message),
        warnings,
    };
};

// ─── detectPrekConfig ───────────────────────────────────────────────

describe(detectPrekConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("detects .pre-commit-config.yaml", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".pre-commit-config.yaml"), "repos: []");

        expect(detectPrekConfig(temporary.root)).toBe(".pre-commit-config.yaml");
    });

    it("detects .pre-commit-config.yml", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".pre-commit-config.yml"), "repos: []");

        expect(detectPrekConfig(temporary.root)).toBe(".pre-commit-config.yml");
    });

    it("prefers .yaml over .yml when both exist", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".pre-commit-config.yaml"), "repos: []");
        writeFileSync(join(temporary.root, ".pre-commit-config.yml"), "repos: []");

        expect(detectPrekConfig(temporary.root)).toBe(".pre-commit-config.yaml");
    });

    it("returns undefined when no config exists", () => {
        expect.assertions(1);

        expect(detectPrekConfig(temporary.root)).toBeUndefined();
    });

    it("does not match prek.toml", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "prek.toml"), "");

        expect(detectPrekConfig(temporary.root)).toBeUndefined();
        expect(detectUnsupportedPrekConfig(temporary.root)).toBe("prek.toml");
    });
});

// ─── mapPrekStage ───────────────────────────────────────────────────

describe(mapPrekStage, () => {
    it("maps legacy aliases to canonical git hook names", () => {
        expect.assertions(3);

        expect(mapPrekStage("commit")).toBe("pre-commit");
        expect(mapPrekStage("push")).toBe("pre-push");
        expect(mapPrekStage("merge-commit")).toBe("pre-merge-commit");
    });

    it("passes through canonical names unchanged", () => {
        expect.assertions(3);

        expect(mapPrekStage("pre-commit")).toBe("pre-commit");
        expect(mapPrekStage("commit-msg")).toBe("commit-msg");
        expect(mapPrekStage("pre-push")).toBe("pre-push");
    });
});

// ─── resolveStages ──────────────────────────────────────────────────

describe(resolveStages, () => {
    it("returns explicit stages when provided", () => {
        expect.assertions(1);

        expect(resolveStages({ stages: ["pre-push", "commit-msg"] }, undefined)).toStrictEqual(["pre-push", "commit-msg"]);
    });

    it("falls back to default_stages when stages is missing", () => {
        expect.assertions(1);

        expect(resolveStages({}, ["pre-push"])).toStrictEqual(["pre-push"]);
    });

    it("defaults to [pre-commit] when nothing is specified", () => {
        expect.assertions(1);

        expect(resolveStages({}, undefined)).toStrictEqual(["pre-commit"]);
    });

    it("translates legacy aliases in explicit stages", () => {
        expect.assertions(1);

        expect(resolveStages({ stages: ["commit", "push"] }, undefined)).toStrictEqual(["pre-commit", "pre-push"]);
    });
});

// ─── buildHookCommand ───────────────────────────────────────────────

describe(buildHookCommand, () => {
    it("emits entry verbatim with quoted args", () => {
        expect.assertions(1);

        const command = buildHookCommand({ args: ["--foo", "bar baz"], entry: "pnpm exec lint-staged" }, "pre-commit");

        expect(command).toBe("pnpm exec lint-staged '--foo' 'bar baz'");
    });

    it("forwards \"$@\" for commit-msg stage with pass_filenames default", () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "pnpm exec commitlint --edit" }, "commit-msg");

        expect(command).toBe('pnpm exec commitlint --edit "$@"');
    });

    it("omits \"$@\" for pre-commit stage (shell cannot compute staged files)", () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "pnpm exec lint-staged" }, "pre-commit");

        expect(command).toBe("pnpm exec lint-staged");
    });

    it("omits \"$@\" when pass_filenames is false even for commit-msg", () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "bash scripts/verify.sh", pass_filenames: false }, "commit-msg");

        expect(command).toBe("bash scripts/verify.sh");
    });

    it("translates language: fail into echo + exit 1", () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "do not use console.log", id: "no-console", language: "fail" }, "pre-commit");

        expect(command).toBe("echo 'do not use console.log'; exit 1");
    });

    it("escapes embedded single quotes in args", () => {
        expect.assertions(1);

        const command = buildHookCommand({ args: ["it's fine"], entry: "echo" }, "pre-commit");

        expect(command).toBe(String.raw`echo 'it'\''s fine'`);
    });
});

// ─── convertPrekConfig ──────────────────────────────────────────────

describe(convertPrekConfig, () => {
    it("converts a local system hook into a pre-commit script", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "pnpm exec lint-staged",
                            id: "lint-staged",
                            language: "system",
                            name: "lint-staged",
                            pass_filenames: false,
                            stages: ["pre-commit"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.has("pre-commit")).toBe(true);
        expect(result.scripts.get("pre-commit")).toContain("pnpm exec lint-staged");
        expect(result.skippedHooks).toHaveLength(0);
    });

    it("skips remote repos with a reason", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [{ id: "trailing-whitespace" }],
                    repo: "https://github.com/pre-commit/pre-commit-hooks",
                    rev: "v4.5.0",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.size).toBe(0);
        expect(result.skippedHooks).toHaveLength(1);
        expect(result.skippedHooks[0]?.reason).toContain("requires the prek binary");
    });

    it("skips local hooks with non-translatable languages", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            additional_dependencies: ["black"],
                            entry: "black",
                            id: "black",
                            language: "python",
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.skippedHooks).toHaveLength(1);
        expect(result.skippedHooks[0]?.reason).toContain("isolated toolchain");
    });

    it("records a manual step when additional_dependencies is present on a translatable hook", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            additional_dependencies: ["@commitlint/cli"],
                            entry: "commitlint",
                            id: "commitlint",
                            language: "system",
                            stages: ["commit-msg"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.manualSteps).toHaveLength(1);
        expect(result.manualSteps[0]).toContain("@commitlint/cli");
    });

    it("records dropped file filters without discarding the hook", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "pnpm exec eslint",
                            files: String.raw`\.ts$`,
                            id: "eslint",
                            language: "system",
                            types: ["javascript"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.droppedFilters.some((note) => note.includes("eslint"))).toBe(true);
        expect(result.scripts.get("pre-commit")).toContain("pnpm exec eslint");
    });

    it("merges multiple hooks into the same stage script in declaration order", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        { entry: "echo first", id: "first", language: "system" },
                        { entry: "echo second", id: "second", language: "system" },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);
        const script = result.scripts.get("pre-commit") ?? "";

        expect(script.indexOf("echo first")).toBeGreaterThan(-1);
        expect(script.indexOf("echo first")).toBeLessThan(script.indexOf("echo second"));
    });

    it("honors default_stages when hook omits stages", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            default_stages: ["pre-push"],
            repos: [
                {
                    hooks: [{ entry: "pnpm run test", id: "test", language: "system" }],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.has("pre-push")).toBe(true);
        expect(result.scripts.has("pre-commit")).toBe(false);
    });

    it("skips manual stage entries silently", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "pnpm run audit",
                            id: "audit",
                            language: "system",
                            stages: ["manual"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.size).toBe(0);
        expect(result.skippedHooks).toHaveLength(0);
    });

    it("prepends `set -e` when fail_fast is true", () => {
        expect.assertions(1);

        const config: PrekConfig = {
            fail_fast: true,
            repos: [
                {
                    hooks: [{ entry: "echo hi", id: "a", language: "system" }],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.get("pre-commit")).toContain("set -e");
    });

    it("maps legacy stage aliases into canonical hook names", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [{ entry: "echo hi", id: "a", language: "system", stages: ["commit", "push"] }],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.has("pre-commit")).toBe(true);
        expect(result.scripts.has("pre-push")).toBe(true);
    });
});

// ─── parsePrekConfig ────────────────────────────────────────────────

describe(parsePrekConfig, () => {
    it("parses valid YAML", () => {
        expect.assertions(1);

        const content = `repos:
  - repo: local
    hooks:
      - id: lint
        entry: pnpm lint
        language: system
`;

        const parsed = parsePrekConfig(content);

        expect(parsed?.repos?.[0]?.repo).toBe("local");
    });

    it("returns undefined for empty content", () => {
        expect.assertions(1);

        expect(parsePrekConfig("")).toBeUndefined();
    });
});

// ─── migrateFromPrek (integration) ──────────────────────────────────

describe(migrateFromPrek, () => {
    it.skipIf(process.platform === "win32")("performs a full local-hook migration", () => {
        expect.assertions(6);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: local
    hooks:
      - id: lint-staged
        name: lint staged files
        entry: pnpm exec lint-staged
        language: system
        pass_filenames: false
        stages: [pre-commit]
      - id: commitlint
        name: validate commit message
        entry: pnpm exec commitlint --edit
        language: system
        stages: [commit-msg]
`,
            );

            const logger = collectLogger();
            const result = migrateFromPrek(root, ".vis-hooks", logger);

            expect(result.isError).toBe(false);
            expect(result.message).toContain("Migration complete");

            expect(readFileSync(join(root, ".vis-hooks", "pre-commit"), "utf8")).toContain("pnpm exec lint-staged");
            expect(readFileSync(join(root, ".vis-hooks", "commit-msg"), "utf8")).toContain("pnpm exec commitlint --edit");

            expect(existsSync(join(root, ".pre-commit-config.yaml"))).toBe(false);
            expect(existsSync(join(root, ".pre-commit-config.yaml.bak"))).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("warns about skipped remote repos but still migrates local hooks", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
  - repo: local
    hooks:
      - id: local-hook
        entry: echo hi
        language: system
`,
            );

            const logger = collectLogger();
            const result = migrateFromPrek(root, ".vis-hooks", logger);

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, ".vis-hooks", "pre-commit"))).toBe(true);
            expect(logger.warnings.some((w) => w.includes("trailing-whitespace"))).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("errors when config is missing", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            const result = migrateFromPrek(root, ".vis-hooks", noopLogger);

            expect(result.isError).toBe(true);
            expect(result.message).toContain("No prek configuration found");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("errors with TOML guidance when prek.toml is the only config", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(join(root, "prek.toml"), "");

            const result = migrateFromPrek(root, ".vis-hooks", noopLogger);

            expect(result.isError).toBe(true);
            expect(result.message).toContain("toml-to-yaml");
        } finally {
            cleanup();
        }
    });
});
