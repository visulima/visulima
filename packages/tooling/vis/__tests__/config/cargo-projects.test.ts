import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { getAffectedProjects } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildProjectGraph, discoverWorkspace } from "../../src/config/workspace";
import { lintMissingPackageJson } from "../../src/deps/missing-package-json";
import { VisUserError } from "../../src/errors/vis-user-error";
import { createVisWorkspaceReader } from "../../src/release/core/readers/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

/**
 * A JS package with a nested napi crate, one without Rust, plus a root Cargo workspace whose
 * `b` inherits a path dependency on `a` and whose `c` depends on `a` from a
 * `[target.*]` table. `crates/target/package/` holds the copy `cargo package`
 * leaves behind; were it discovered it would clash with `a`.
 */
const createFixture = (root: string): void => {
    write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/**\"\n  - \"crates/**\"\n");
    write(root, "package.json", JSON.stringify({ name: "root", private: true }));
    write(root, "packages/web/package.json", JSON.stringify({ name: "web", scripts: { test: "vitest" } }));
    write(root, "packages/web/src/index.ts", "export const web = 1;\n");
    write(root, "packages/web/native/Cargo.toml", "[package]\nname = \"web-native\"\nversion = \"0.1.0\"\n");
    write(root, "packages/web/native/src/lib.rs", "\n");
    write(root, "packages/docs/package.json", JSON.stringify({ name: "docs" }));
    write(root, "Cargo.toml", "[workspace]\nmembers = [\"crates/*\"]\n\n[workspace.dependencies]\na = { path = \"crates/a\" }\n");
    write(root, "Cargo.lock", "version = 4\n");
    write(root, "crates/a/Cargo.toml", "[package]\nname = \"a\"\nversion = \"0.1.0\"\n");
    write(root, "crates/a/src/lib.rs", "\n");
    write(root, "crates/b/Cargo.toml", "[package]\nname = \"b\"\nversion = \"0.1.0\"\n\n[dependencies]\na = { workspace = true }\n");
    write(root, "crates/b/src/lib.rs", "\n");
    write(root, "crates/c/Cargo.toml", "[package]\nname = \"c\"\nversion = \"0.1.0\"\n\n[target.'cfg(unix)'.dev-dependencies]\na = { path = \"../a\" }\n");
    write(root, "crates/c/src/lib.rs", "\n");
    write(root, "crates/target/package/a-0.1.0/Cargo.toml", "[package]\nname = \"a\"\nversion = \"0.1.0\"\n");
};

describe("cargo crates as projects", () => {
    let root: string;

    beforeEach(() => {
        // A git hook (pre-commit) exports GIT_DIR / GIT_INDEX_FILE, which would
        // point the fixture's git calls at the enclosing repository.
        for (const key of Object.keys(process.env).filter((name) => name.startsWith("GIT_"))) {
            vi.stubEnv(key, undefined);
        }

        root = mkdtempSync(join(tmpdir(), "vis-cargo-"));
        createFixture(root);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        rmSync(root, { force: true, recursive: true });
    });

    it("should discover workspace crates but not nested napi crates or target/ copies", () => {
        expect.assertions(4);

        const { packageJsons, workspace } = discoverWorkspace(root);

        expect(Object.keys(workspace.projects).toSorted()).toStrictEqual(["a", "b", "c", "docs", "web"]);
        expect(workspace.projects["a"]?.root).toBe("crates/a");
        expect(workspace.projects["web"]?.root).toBe("packages/web");
        expect([...packageJsons.keys()].toSorted()).toStrictEqual(["docs", "web"]);
    });

    it("should add path-dependency edges, including workspace = true and target tables", () => {
        expect.assertions(3);

        const { packageJsons, workspace } = discoverWorkspace(root);
        const graph = buildProjectGraph(root, workspace, packageJsons);

        expect(graph.dependencies["b"]?.map((edge) => edge.target)).toStrictEqual(["a"]);
        expect(graph.dependencies["c"]).toStrictEqual([{ source: "c", target: "a", type: "devDependency" }]);
        expect(graph.dependencies["a"]).toStrictEqual([]);
    });

    it("should error on a crate whose name collides with another project", () => {
        expect.assertions(1);

        write(root, "crates/web/Cargo.toml", "[package]\nname = \"web\"\nversion = \"0.1.0\"\n");

        expect(() => discoverWorkspace(root)).toThrow(VisUserError);
    });

    it("should exempt only directories discovery accepts from the missing package.json lint", () => {
        expect.assertions(1);

        const lintRoot = join(root, "lint-fixture");

        write(lintRoot, "pnpm-workspace.yaml", "packages:\n  - \"crates/*\"\n");
        write(lintRoot, "package.json", JSON.stringify({ name: "root", private: true }));
        write(lintRoot, "crates/crate/Cargo.toml", "[package]\nname = \"crate\"\nversion = \"0.1.0\"\n");
        write(lintRoot, "crates/tool/project.json", JSON.stringify({ name: "tool" }));
        // A virtual Cargo workspace manifest is not a project, so it must still be reported.
        write(lintRoot, "crates/virtual/Cargo.toml", "[workspace]\nmembers = []\n");

        expect(lintMissingPackageJson(lintRoot).map((issue) => issue.packageDir)).toStrictEqual(["crates/virtual"]);
    });

    it("should keep crates out of release discovery", async () => {
        expect.assertions(1);

        const packages = await createVisWorkspaceReader({ cwd: root }).listPackages();

        expect(packages.map((entry) => entry.manifest.name).toSorted()).toStrictEqual(["docs", "web"]);
    });

    describe("inferred cargo targets", () => {
        it("should infer build, test, lint and format targets scoped to the crate", () => {
            expect.assertions(7);

            const targets = discoverWorkspace(root, { inferTargets: true }).workspace.projects["a"]?.targets ?? {};

            expect(Object.fromEntries(Object.entries(targets).map(([name, target]) => [name, target.command]))).toStrictEqual({
                build: "cargo build --manifest-path Cargo.toml",
                format: "cargo fmt --manifest-path Cargo.toml",
                "format:check": "cargo fmt --check --manifest-path Cargo.toml",
                lint: "cargo clippy --manifest-path Cargo.toml",
                test: "cargo test --manifest-path Cargo.toml",
            });
            // No artifact caching for `target/`, and no auto-captured outputs for the checks.
            expect(targets["build"]).toMatchObject({ cache: false });
            expect(targets["build"]?.outputs).toBeUndefined();

            for (const name of ["test", "lint", "format:check"]) {
                expect(targets[name]).toMatchObject({ cache: true, outputs: [] });
            }

            expect(targets["test"]?.inputs).toStrictEqual(
                expect.arrayContaining([
                    "{projectRoot}/Cargo.toml",
                    "{projectRoot}/src/**/*",
                    "{projectRoot}/build.rs",
                    "{workspaceRoot}/Cargo.toml",
                    "{workspaceRoot}/Cargo.lock",
                    "{workspaceRoot}/rust-toolchain.toml",
                    "env://CARGO_TARGET_DIR",
                    "env://RUSTFLAGS",
                ]),
            );
        });

        it("should infer them on the unset default for a crate that declares no targets", () => {
            expect.assertions(1);

            expect(discoverWorkspace(root).workspace.projects["a"]?.targets?.["test"]?.command).toBe("cargo test --manifest-path Cargo.toml");
        });

        it("should infer no cargo targets on a JS package, even with a root Cargo.toml", () => {
            expect.assertions(2);

            write(root, "packages/napi/package.json", JSON.stringify({ name: "napi" }));
            write(root, "packages/napi/Cargo.toml", "[package]\nname = \"napi\"\nversion = \"0.1.0\"\n");

            const { projects } = discoverWorkspace(root, { inferTargets: true }).workspace;
            const commands = ["web", "napi"].flatMap((name) => Object.values(projects[name]?.targets ?? {}).map((target) => String(target.command)));

            expect(commands).toContain("vitest");
            expect(commands.filter((command) => command.startsWith("cargo"))).toStrictEqual([]);
        });

        it("should keep an explicit target of the same name", () => {
            expect.assertions(2);

            write(root, "crates/b/project.json", JSON.stringify({ targets: { test: { command: "cargo nextest run" } } }));

            const targets = discoverWorkspace(root, { inferTargets: true }).workspace.projects["b"]?.targets ?? {};

            expect(targets["test"]?.command).toBe("cargo nextest run");
            expect(targets["lint"]?.command).toBe("cargo clippy --manifest-path Cargo.toml");
        });

        it("should infer nothing when inference is off", () => {
            expect.assertions(2);

            expect(discoverWorkspace(root, { inferTargets: false }).workspace.projects["a"]?.targets).toStrictEqual({});
            expect(discoverWorkspace(root, { inferTargets: { cargo: false } }).workspace.projects["a"]?.targets).toStrictEqual({});
        });
    });

    describe("affected mapping", () => {
        const affected = async (changedFile: string): Promise<string[]> => {
            const { fileOwners, packageJsons, workspace } = discoverWorkspace(root);
            const result = await getAffectedProjects({
                additionalChangedFiles: [changedFile],
                base: "HEAD",
                fileOwners,
                head: "HEAD",
                projectGraph: buildProjectGraph(root, workspace, packageJsons),
                projects: workspace.projects,
                workspaceRoot: root,
            });

            return result.affectedProjects.toSorted();
        };

        beforeEach(() => {
            execFileSync("git", ["init", "--initial-branch=main"], { cwd: root, stdio: "pipe" });
            execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
            execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-m", "initial"], { cwd: root, stdio: "pipe" });
        });

        it("should select a crate's dependents when it changes", async () => {
            expect.assertions(1);

            await expect(affected("crates/a/src/lib.rs")).resolves.toStrictEqual(["a", "b", "c"]);
        });

        it("should map the Cargo workspace's root files to its crates only", async () => {
            expect.assertions(2);

            await expect(affected("Cargo.lock")).resolves.toStrictEqual(["a", "b", "c"]);
            await expect(affected("Cargo.toml")).resolves.toStrictEqual(["a", "b", "c"]);
        });

        it("should map the root toolchain file to every project with Cargo code", async () => {
            expect.assertions(2);

            await expect(affected("rust-toolchain.toml")).resolves.toStrictEqual(["a", "b", "c", "web"]);
            await expect(affected("rust-toolchain")).resolves.toStrictEqual(["a", "b", "c", "web"]);
        });

        it("should keep the root toolchain file workspace-wide when no project has Cargo code", async () => {
            expect.assertions(1);

            rmSync(join(root, "crates"), { force: true, recursive: true });
            rmSync(join(root, "packages/web/native"), { force: true, recursive: true });
            rmSync(join(root, "Cargo.toml"));

            await expect(affected("rust-toolchain.toml")).resolves.toStrictEqual(["docs", "web"]);
        });

        it("should select no crate for a JS-only change", async () => {
            expect.assertions(1);

            await expect(affected("packages/web/src/index.ts")).resolves.toStrictEqual(["web"]);
        });

        it("should map a nested napi crate change to its JS package", async () => {
            expect.assertions(1);

            await expect(affected("packages/web/native/src/lib.rs")).resolves.toStrictEqual(["web"]);
        });

        it("should still treat other root files as workspace-wide", async () => {
            expect.assertions(1);

            await expect(affected("tsconfig.json")).resolves.toStrictEqual(["a", "b", "c", "docs", "web"]);
        });
    });
});
