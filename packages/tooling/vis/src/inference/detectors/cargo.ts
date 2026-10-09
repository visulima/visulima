import type { DetectedTargets, Detector } from "../types";

// The workspace-root files cover a crate in the root Cargo workspace, which is
// the only one vis maps (see `cargo-projects.ts`). For a standalone crate they
// are a harmless over-invalidation; cargo walks up to an enclosing workspace anyway.
// ponytail: a member of a Cargo workspace rooted below the vis root misses that
// root's Cargo.toml / Cargo.lock; add them per project when someone needs it.
const inputs = [
    "{projectRoot}/Cargo.toml",
    "{projectRoot}/Cargo.lock",
    "{projectRoot}/build.rs",
    "{projectRoot}/rust-toolchain.toml",
    "{projectRoot}/rust-toolchain",
    "{projectRoot}/rustfmt.toml",
    "{projectRoot}/.rustfmt.toml",
    "{projectRoot}/clippy.toml",
    "{projectRoot}/.clippy.toml",
    "{projectRoot}/src/**/*",
    "{projectRoot}/tests/**/*",
    "{projectRoot}/benches/**/*",
    "{projectRoot}/examples/**/*",
    "{workspaceRoot}/Cargo.toml",
    "{workspaceRoot}/Cargo.lock",
    "{workspaceRoot}/rust-toolchain.toml",
    "{workspaceRoot}/rust-toolchain",
    "{workspaceRoot}/rustfmt.toml",
    "{workspaceRoot}/.rustfmt.toml",
    "{workspaceRoot}/clippy.toml",
    "{workspaceRoot}/.clippy.toml",
    "env://CARGO_TARGET_DIR",
    "env://RUSTFLAGS",
];

// `--manifest-path` (resolved against the crate directory, the task's cwd)
// keeps a Cargo workspace member from building or formatting the whole
// workspace, without reading the crate name.
const manifest = "--manifest-path Cargo.toml";

/**
 * Applies only to crate projects (a root `Cargo.toml` with `[package]` and no
 * `package.json`); `discoverWorkspace` keeps it off JS packages, nested napi
 * crates included.
 *
 * Checks use `type: "test"`: cacheable pass/fail with no outputs. `type: "build"`
 * would give them auto-captured outputs, and clippy writes into `target/`.
 */
export const cargoDetector: Detector = {
    configFiles: ["Cargo.toml"],
    detect: () => {
        const targets: DetectedTargets["targets"] = {
            // ponytail: no artifact caching for cargo build — `target/` runs to
            // gigabytes and sits at the Cargo workspace root or CARGO_TARGET_DIR.
            // Declare `outputs` (and `cache: true`) in project.json to opt in.
            build: {
                cache: false,
                command: `cargo build ${manifest}`,
                description: "cargo build (inferred)",
                inputs,
            },
            // Writes files, so uncached like the other formatters' `format`.
            format: {
                command: `cargo fmt ${manifest}`,
                description: "cargo fmt (inferred)",
            },
            "format:check": {
                command: `cargo fmt --check ${manifest}`,
                description: "cargo fmt --check (inferred)",
                inputs,
                outputs: [],
                type: "test",
            },
            lint: {
                command: `cargo clippy ${manifest}`,
                description: "cargo clippy (inferred)",
                inputs,
                outputs: [],
                type: "test",
            },
            test: {
                command: `cargo test ${manifest}`,
                description: "cargo test (inferred)",
                inputs,
                outputs: [],
                type: "test",
            },
        };

        return { targets };
    },
    name: "cargo",
};
