import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrekConfig } from "../../../src/commands/hook/prek";
import {
    buildHookEntry,
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
    stageScriptBody,
} from "../../../src/commands/hook/prek";

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

describe(buildHookEntry, () => {
    it("converts a local system hook into an entry with raw values preserved", () => {
        expect.assertions(4);

        const entry = buildHookEntry({ args: ["--foo", "bar baz"], entry: "pnpm exec lint-staged", id: "lint" }, "pre-commit");

        expect(entry.entry).toBe("pnpm exec lint-staged");
        expect(entry.args).toStrictEqual(["--foo", "bar baz"]);
        expect(entry.builtin).toBeUndefined();
        expect(entry.fail).toBeUndefined();
    });

    it("marks commit-msg entries alwaysRun and drops filters (git supplies argv)", () => {
        expect.assertions(4);

        const entry = buildHookEntry({ entry: "pnpm exec commitlint --edit", files: String.raw`\.md$`, id: "commitlint", types: ["text"] }, "commit-msg");

        expect(entry.alwaysRun).toBe(true);
        expect(entry.passFilenames).toBe(false);
        expect(entry.files).toBeUndefined();
        expect(entry.types).toBeUndefined();
    });

    it("translates language: fail into a `fail` entry", () => {
        expect.assertions(3);

        const entry = buildHookEntry({ entry: "do not use console.log", id: "no-console", language: "fail" }, "pre-commit");

        expect(entry.fail).toBe("do not use console.log");
        expect(entry.entry).toBeUndefined();
        expect(entry.builtin).toBeUndefined();
    });

    it("sets `builtin` when a bundled hook id is supplied", () => {
        expect.assertions(2);

        const entry = buildHookEntry({ args: ["--fix=lf"], id: "mixed-line-ending" }, "pre-commit", "mixed-line-ending");

        expect(entry.builtin).toBe("mixed-line-ending");
        expect(entry.args).toStrictEqual(["--fix=lf"]);
    });

    it("preserves regex / type filters verbatim (no shell quoting required)", () => {
        expect.assertions(2);

        const entry = buildHookEntry({ entry: "echo", exclude: "'; rm -rf /", files: String.raw`\.ts$`, id: "exotic" }, "pre-commit");

        expect(entry.files).toBe(String.raw`\.ts$`);
        // Stored verbatim; the dispatcher passes via argv, never shell.
        expect(entry.exclude).toBe("'; rm -rf /");
    });
});

describe(stageScriptBody, () => {
    it("emits a thin shim that defers to vis hook run", () => {
        expect.assertions(2);

        const body = stageScriptBody("pre-commit");

        expect(body).toContain("exec vis hook run pre-commit \"$@\"");
        expect(body).toMatch(/^#!\/usr\/bin\/env sh/);
    });
});

describe(convertPrekConfig, () => {
    it("converts a local system hook into a pre-commit entry", () => {
        expect.assertions(4);

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
        const entries = result.config.stages["pre-commit"];

        expect(entries).toHaveLength(1);
        expect(entries?.[0]?.entry).toBe("pnpm exec lint-staged");
        expect(entries?.[0]?.passFilenames).toBe(false);
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

        expect(Object.keys(result.config.stages)).toHaveLength(0);
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
        const entries = result.config.stages["pre-commit"];

        expect(result.skippedHooks).toHaveLength(0);
        expect(entries?.[0]?.builtin).toBe("trailing-whitespace");
        expect(entries?.[1]?.builtin).toBe("end-of-file-fixer");
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

    it("preserves file filters on the converted entry", () => {
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
        const entry = result.config.stages["pre-commit"]?.[0];

        expect(entry?.files).toBe(String.raw`\.ts$`);
        expect(entry?.types).toStrictEqual(["typescript"]);
        expect(entry?.entry).toBe("pnpm exec eslint");
    });

    it("warns on unsupported types without suppressing the hook", () => {
        expect.assertions(2);

        // Use genuinely unknown tag names — prek-identify covers ~311 real
        // tags (haskell, ocaml, etc. all included), so the "unknown" warning
        // only fires for typos or made-up names.
        const config: PrekConfig = {
            repos: [
                {
                    hooks: [
                        {
                            entry: "echo",
                            id: "exotic",
                            language: "system",
                            types: ["totally-fake-tag-zzz", "another-bogus-tag"],
                        },
                    ],
                    repo: "local",
                },
            ],
        };

        const result = convertPrekConfig(config);

        expect(result.droppedFilters.some((note) => note.includes("totally-fake-tag-zzz"))).toBe(true);
        expect(result.config.stages["pre-commit"]).toBeDefined();
    });

    it("merges multiple hooks into the same stage entry list in declaration order", () => {
        expect.assertions(3);

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
        const entries = result.config.stages["pre-commit"];

        expect(entries).toHaveLength(2);
        expect(entries?.[0]?.entry).toBe("echo first");
        expect(entries?.[1]?.entry).toBe("echo second");
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

        expect(result.config.stages["pre-push"]).toBeDefined();
        expect(result.config.stages["pre-commit"]).toBeUndefined();
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

        expect(Object.keys(result.config.stages)).toHaveLength(0);
        expect(result.skippedHooks).toHaveLength(0);
    });

    it("sets failFast on the config when fail_fast is true", () => {
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

        expect(result.config.failFast).toBe(true);
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

        expect(result.config.stages["pre-commit"]).toBeDefined();
        expect(result.config.stages["pre-push"]).toBeDefined();
    });

    it("marks the entry verbose when prek hook sets verbose: true", () => {
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
        const entry = result.config.stages["pre-commit"]?.[0];

        expect(entry?.verbose).toBe(true);
        expect(entry?.entry).toBe("echo hi");
    });
});

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

describe(migrateFromPrek, () => {
    it.skipIf(process.platform === "win32")("performs a full local-hook migration", () => {
        expect.assertions(8);

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
            const result = migrateFromPrek(root, ".vis/hooks", logger);

            expect(result.isError).toBe(false);
            expect(result.message).toContain("Migration complete");

            const preCommit = readFileSync(join(root, ".vis/hooks", "pre-commit"), "utf8");
            const commitMsg = readFileSync(join(root, ".vis/hooks", "commit-msg"), "utf8");

            expect(preCommit).toContain("exec vis hook run pre-commit \"$@\"");
            expect(commitMsg).toContain("exec vis hook run commit-msg \"$@\"");

            const hookConfig = JSON.parse(readFileSync(join(root, ".vis/hooks", "config.json"), "utf8"));

            expect(hookConfig.stages["pre-commit"][0].entry).toBe("pnpm exec lint-staged");
            expect(hookConfig.stages["commit-msg"][0].entry).toBe("pnpm exec commitlint --edit");

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
            const result = migrateFromPrek(root, ".vis/hooks", logger);

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, ".vis/hooks", "pre-commit"))).toBe(true);
            expect(logger.warnings.some((w) => w.includes("black"))).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("records translated remote hooks as builtin entries in config.json", () => {
        expect.assertions(4);

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

            const result = migrateFromPrek(root, ".vis/hooks", noopLogger);

            expect(result.isError).toBe(false);
            expect(readFileSync(join(root, ".vis/hooks", "pre-commit"), "utf8")).toContain("exec vis hook run pre-commit \"$@\"");

            const hookConfig = JSON.parse(readFileSync(join(root, ".vis/hooks", "config.json"), "utf8"));
            const entries = hookConfig.stages["pre-commit"];

            expect(entries[0].builtin).toBe("trailing-whitespace");
            expect(entries[1].builtin).toBe("check-json");
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

            migrateFromPrek(root, ".vis/hooks", noopLogger);

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

            migrateFromPrek(root, ".vis/hooks", logger);

            const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

            expect(pkg.devDependencies.lodash).toBe("3.0.0");
            expect(logger.messages.some((m) => m.includes("Skipped"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});

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

        expect(text).toContain("\n  \"devDependencies\"");
    });

    it.skipIf(process.platform === "win32")("errors when config is missing", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            const result = migrateFromPrek(root, ".vis/hooks", noopLogger);

            expect(result.isError).toBe(true);
            expect(result.message).toContain("No prek configuration found");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("migrates a prek.toml config end-to-end", () => {
        expect.assertions(5);

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

            const result = migrateFromPrek(root, ".vis/hooks", noopLogger);

            expect(result.isError).toBe(false);
            expect(readFileSync(join(root, ".vis/hooks", "pre-commit"), "utf8")).toContain("exec vis hook run pre-commit \"$@\"");

            const hookConfig = JSON.parse(readFileSync(join(root, ".vis/hooks", "config.json"), "utf8"));

            expect(hookConfig.stages["pre-commit"][0].entry).toBe("pnpm exec lint-staged");

            expect(existsSync(join(root, "prek.toml"))).toBe(false);
            expect(existsSync(join(root, "prek.toml.bak"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});

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
            const result = migrateFromPrek(root, ".vis/hooks", logger, { dryRun: true });

            expect(result.isError).toBe(false);
            expect(result.message).toContain("would migrate");
            expect(existsSync(join(root, ".vis/hooks", "pre-commit"))).toBe(false);
            expect(existsSync(join(root, ".pre-commit-config.yaml"))).toBe(true);
            expect(logger.messages.some((m) => m.includes("(would write)"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});
