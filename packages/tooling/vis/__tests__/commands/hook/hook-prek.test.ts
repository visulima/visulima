import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrekConfig } from "../../../src/commands/hook/prek";
import {
    buildHookCommand,
    buildRunnerInvocation,
    convertPrekConfig,
    detectPrekConfig,
    loadPrekConfig,
    mapPrekStage,
    mergeAdditionalDependencies,
    migrateFromPrek,
    normalizeRepoKey,
    parseAdditionalDep,
    parsePrekConfig,
    resolveStages,
} from "../../../src/commands/hook/prek";

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

    it("detects prek.toml when no YAML is present", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "prek.toml"), "");

        expect(detectPrekConfig(temporary.root)).toBe("prek.toml");
    });

    it("prefers YAML over prek.toml when both are present", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".pre-commit-config.yaml"), "repos: []");
        writeFileSync(join(temporary.root, "prek.toml"), "");

        expect(detectPrekConfig(temporary.root)).toBe(".pre-commit-config.yaml");
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
    it("routes pre-commit hooks through the runner with entry + args passed via argv", () => {
        expect.assertions(3);

        const command = buildHookCommand({ args: ["--foo", "bar baz"], entry: "pnpm exec lint-staged" }, "pre-commit");

        expect(command).toContain('node "$(dirname "$0")/.builtins/prek-runner.mjs"');
        expect(command).toContain("-- pnpm exec lint-staged");
        expect(command).toContain("'--foo' 'bar baz'");
    });

    it('forwards "$@" for commit-msg stage with pass_filenames default', () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "pnpm exec commitlint --edit" }, "commit-msg");

        expect(command).toBe('pnpm exec commitlint --edit "$@"');
    });

    it('omits "$@" when pass_filenames is false even for commit-msg', () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "bash scripts/verify.sh", pass_filenames: false }, "commit-msg");

        expect(command).toBe("bash scripts/verify.sh");
    });

    it("translates language: fail into echo + exit 1", () => {
        expect.assertions(1);

        const command = buildHookCommand({ entry: "do not use console.log", id: "no-console", language: "fail" }, "pre-commit");

        expect(command).toBe("echo 'do not use console.log'; exit 1");
    });

    it("escapes embedded single quotes in args when routed via the runner", () => {
        expect.assertions(1);

        const command = buildHookCommand({ args: ["it's fine"], entry: "echo" }, "pre-commit");

        expect(command).toContain(String.raw`'it'\''s fine'`);
    });

    it("emits a --builtin dispatch when a builtin id is supplied", () => {
        expect.assertions(2);

        const command = buildHookCommand({ args: ["--fix=lf"], id: "mixed-line-ending" }, "pre-commit", "mixed-line-ending");

        expect(command).toContain("--builtin mixed-line-ending");
        expect(command).toContain("-- '--fix=lf'");
    });

    it("emits filter flags with single-quoted regex to prevent shell injection", () => {
        expect.assertions(2);

        const command = buildRunnerInvocation({ exclude: "'; rm -rf /", files: String.raw`\.ts$` });

        expect(command).toContain(String.raw`--files '\.ts$'`);
        // Embedded single quote is escaped via '\'' — never breaks out of the quoted string.
        expect(command).toContain(String.raw`--exclude ''\''; rm -rf /'`);
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

    it("skips remote repos with no bundled equivalent", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [{ id: "some-python-hook" }],
                    repo: "https://github.com/psf/black",
                    rev: "24.1.0",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.scripts.size).toBe(0);
        expect(result.skippedHooks).toHaveLength(1);
        expect(result.skippedHooks[0]?.reason).toContain("has no bundled equivalent");
    });

    it("translates known remote hooks via the bundled runner", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [{ id: "trailing-whitespace" }, { id: "end-of-file-fixer" }],
                    repo: "https://github.com/pre-commit/pre-commit-hooks",
                    rev: "v4.5.0",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.skippedHooks).toHaveLength(0);
        expect(result.scripts.get("pre-commit")).toContain("--builtin trailing-whitespace");
        expect(result.scripts.get("pre-commit")).toContain("--builtin end-of-file-fixer");
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

    it("collects additional_dependencies as structured deps (not manual steps)", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            additional_dependencies: ["@commitlint/cli", "lodash@4.17.21"],
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

        expect(result.additionalDeps).toHaveLength(2);
        expect(result.additionalDeps[0]).toStrictEqual({ hookId: "commitlint", name: "@commitlint/cli", raw: "@commitlint/cli", version: "latest" });
        expect(result.additionalDeps[1]).toStrictEqual({ hookId: "commitlint", name: "lodash", raw: "lodash@4.17.21", version: "4.17.21" });
    });

    it("routes pip-style additional_dependencies to manual steps", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            additional_dependencies: ["black==24.1.0"],
                            entry: "black",
                            id: "black",
                            language: "system",
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.additionalDeps).toHaveLength(0);
        expect(result.manualSteps).toHaveLength(1);
        expect(result.manualSteps[0]).toContain("pip-style");
    });

    it("preserves file filters via the runner invocation", () => {
        expect.assertions(3);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "pnpm exec eslint",
                            files: String.raw`\.ts$`,
                            id: "eslint",
                            language: "system",
                            types: ["typescript"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);
        const script = result.scripts.get("pre-commit") ?? "";

        expect(script).toContain(String.raw`--files '\.ts$'`);
        expect(script).toContain("--types 'typescript'");
        expect(script).toContain("-- pnpm exec eslint");
    });

    it("warns on unsupported types without suppressing the hook", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "echo",
                            id: "exotic",
                            language: "system",
                            types: ["haskell", "ocaml"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.droppedFilters.some((note) => note.includes("haskell"))).toBe(true);
        expect(result.scripts.has("pre-commit")).toBe(true);
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

    it("wraps the emitted command in `set -x` when verbose is true", () => {
        expect.assertions(2);

        const config: PrekConfig = {
            repos: [
                {
                    hooks: [{ entry: "echo hi", id: "noisy", language: "system", verbose: true }],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);
        const script = result.scripts.get("pre-commit") ?? "";

        expect(script).toContain("(set -x;");
        expect(script).toContain("echo hi");
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

    it.skipIf(process.platform === "win32")("warns about skipped remote repos with no bundled equivalent", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: https://github.com/psf/black
    rev: 24.1.0
    hooks:
      - id: black
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
            expect(logger.warnings.some((w) => w.includes("black"))).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("writes the prek-runner when a translated hook uses it", () => {
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
      - id: check-json
`,
            );

            const result = migrateFromPrek(root, ".vis-hooks", noopLogger);

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, ".vis-hooks", ".builtins", "prek-runner.mjs"))).toBe(true);
            expect(readFileSync(join(root, ".vis-hooks", "pre-commit"), "utf8")).toContain("--builtin trailing-whitespace");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("merges additional_dependencies into devDependencies", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "fixture", version: "0.0.0" }, undefined, 4)}\n`);
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: local
    hooks:
      - id: commitlint
        entry: pnpm exec commitlint --edit
        language: system
        additional_dependencies: ['@commitlint/cli', 'lodash@4.17.21']
        stages: [commit-msg]
`,
            );

            migrateFromPrek(root, ".vis-hooks", noopLogger);

            const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

            expect(pkg.devDependencies).toBeDefined();
            expect(pkg.devDependencies["@commitlint/cli"]).toBe("latest");
            expect(pkg.devDependencies.lodash).toBe("4.17.21");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("does not clobber an already-declared dependency", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, "package.json"),
                `${JSON.stringify({ devDependencies: { lodash: "3.0.0" }, name: "fixture", version: "0.0.0" }, undefined, 4)}\n`,
            );
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: local
    hooks:
      - id: a
        entry: echo hi
        language: system
        additional_dependencies: ['lodash@4.17.21']
`,
            );

            const logger = collectLogger();

            migrateFromPrek(root, ".vis-hooks", logger);

            const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

            expect(pkg.devDependencies.lodash).toBe("3.0.0");
            expect(logger.messages.some((m) => m.includes("Skipped"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});

// ─── parseAdditionalDep ─────────────────────────────────────────────

describe(parseAdditionalDep, () => {
    it("handles bare package names", () => {
        expect.assertions(1);

        expect(parseAdditionalDep("lodash")).toStrictEqual({ name: "lodash", version: "latest" });
    });

    it("handles name@version", () => {
        expect.assertions(1);

        expect(parseAdditionalDep("lodash@4.17.21")).toStrictEqual({ name: "lodash", version: "4.17.21" });
    });

    it("handles scoped packages", () => {
        expect.assertions(1);

        expect(parseAdditionalDep("@commitlint/cli@19.0.0")).toStrictEqual({ name: "@commitlint/cli", version: "19.0.0" });
    });

    it("handles scoped packages without a version", () => {
        expect.assertions(1);

        expect(parseAdditionalDep("@scope/pkg")).toStrictEqual({ name: "@scope/pkg", version: "latest" });
    });

    it("rejects pip-style pins", () => {
        expect.assertions(3);

        expect(parseAdditionalDep("black==24.1.0")).toBeUndefined();
        expect(parseAdditionalDep("foo>=1.0")).toBeUndefined();
        expect(parseAdditionalDep("bar~=2.0")).toBeUndefined();
    });

    it("falls back to latest when the version suffix is empty", () => {
        expect.assertions(2);

        expect(parseAdditionalDep("lodash@")).toStrictEqual({ name: "lodash", version: "latest" });
        expect(parseAdditionalDep("@scope/pkg@")).toStrictEqual({ name: "@scope/pkg", version: "latest" });
    });
});

// ─── normalizeRepoKey ───────────────────────────────────────────────

describe(normalizeRepoKey, () => {
    it("normalises https, git, and ssh GitHub URLs", () => {
        expect.assertions(3);

        expect(normalizeRepoKey("https://github.com/pre-commit/pre-commit-hooks")).toBe("pre-commit/pre-commit-hooks");
        expect(normalizeRepoKey("git@github.com:pre-commit/pre-commit-hooks.git")).toBe("pre-commit/pre-commit-hooks");
        expect(normalizeRepoKey("https://github.com/pre-commit/pre-commit-hooks.git")).toBe("pre-commit/pre-commit-hooks");
    });

    it("returns the input unchanged for non-GitHub URLs", () => {
        expect.assertions(1);

        expect(normalizeRepoKey("https://gitlab.com/foo/bar")).toBe("https://gitlab.com/foo/bar");
    });
});

// ─── mergeAdditionalDependencies ────────────────────────────────────

describe(mergeAdditionalDependencies, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("adds new deps to devDependencies", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), `${JSON.stringify({ name: "x", version: "0.0.0" }, undefined, 4)}\n`);

        const result = mergeAdditionalDependencies(temporary.root, [{ hookId: "a", name: "foo", raw: "foo", version: "latest" }]);

        expect(result.added).toStrictEqual(["foo"]);
        expect(JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8")).devDependencies.foo).toBe("latest");
    });

    it("does nothing when package.json is missing", () => {
        expect.assertions(1);

        const result = mergeAdditionalDependencies(temporary.root, [{ hookId: "a", name: "foo", raw: "foo", version: "1.0.0" }]);

        expect(result.added).toStrictEqual([]);
    });

    it("preserves the existing JSON indent when it is 2 spaces", () => {
        expect.assertions(1);

        const packageJson = { name: "x", version: "0.0.0" };

        writeFileSync(join(temporary.root, "package.json"), `${JSON.stringify(packageJson, undefined, 2)}\n`);
        mergeAdditionalDependencies(temporary.root, [{ hookId: "a", name: "foo", raw: "foo", version: "1.0.0" }]);

        const text: string = readFileSync(join(temporary.root, "package.json"), "utf8");

        expect(text).toContain('\n  "devDependencies"');
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

    it.skipIf(process.platform === "win32")("migrates a prek.toml config end-to-end", () => {
        expect.assertions(4);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, "prek.toml"),
                `[[repos]]
repo = "local"

[[repos.hooks]]
id = "lint-staged"
name = "lint staged files"
entry = "pnpm exec lint-staged"
language = "system"
pass_filenames = false
stages = ["pre-commit"]
`,
            );

            const result = migrateFromPrek(root, ".vis-hooks", noopLogger);

            expect(result.isError).toBe(false);
            expect(readFileSync(join(root, ".vis-hooks", "pre-commit"), "utf8")).toContain("pnpm exec lint-staged");
            expect(existsSync(join(root, "prek.toml"))).toBe(false);
            expect(existsSync(join(root, "prek.toml.bak"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});

// ─── loadPrekConfig ─────────────────────────────────────────────────

describe(loadPrekConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("loads a YAML config by extension", () => {
        expect.assertions(1);

        const path = join(temporary.root, ".pre-commit-config.yaml");

        writeFileSync(
            path,
            `repos:
  - repo: local
    hooks:
      - id: a
        entry: echo hi
        language: system
`,
        );

        expect(loadPrekConfig(path)?.repos?.[0]?.hooks?.[0]?.id).toBe("a");
    });

    it("loads a TOML config by extension via @visulima/fs/toml", () => {
        expect.assertions(1);

        const path = join(temporary.root, "prek.toml");

        writeFileSync(
            path,
            `[[repos]]
repo = "local"

[[repos.hooks]]
id = "b"
entry = "echo hi"
language = "system"
`,
        );

        expect(loadPrekConfig(path)?.repos?.[0]?.hooks?.[0]?.id).toBe("b");
    });
});

// ─── migrateFromPrek --dry-run ──────────────────────────────────────

describe("migrateFromPrek --dry-run", () => {
    it.skipIf(process.platform === "win32")("does not write any files but still reports the plan", () => {
        expect.assertions(5);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            writeFileSync(
                join(root, ".pre-commit-config.yaml"),
                `repos:
  - repo: local
    hooks:
      - id: lint-staged
        entry: pnpm exec lint-staged
        language: system
        pass_filenames: false
        stages: [pre-commit]
`,
            );

            const logger = collectLogger();
            const result = migrateFromPrek(root, ".vis-hooks", logger, { dryRun: true });

            expect(result.isError).toBe(false);
            expect(result.message).toContain("would migrate");
            expect(existsSync(join(root, ".vis-hooks", "pre-commit"))).toBe(false);
            expect(existsSync(join(root, ".pre-commit-config.yaml"))).toBe(true);
            expect(logger.messages.some((m) => m.includes("(would write)"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});
