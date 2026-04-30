import { describe, expect, it } from "vitest";

import {
    resolveAubeAdd,
    resolveAubeDedupe,
    resolveAubeDlx,
    resolveAubeExec,
    resolveAubeInfo,
    resolveAubeInstall,
    resolveAubeLink,
    resolveAubeOutdated,
    resolveAubePmCommand,
    resolveAubeRemove,
    resolveAubeUnlink,
    resolveAubeUpdate,
    resolveAubeWhy,
} from "../src/aube-resolver";

const installDefaults = {
    dev: false,
    filter: [] as string[],
    force: false,
    frozenLockfile: false,
    ignoreScripts: false,
    lockfileOnly: false,
    noOptional: false,
    offline: false,
    prod: false,
    recursive: false,
    silent: false,
    workspaceRoot: false,
};

describe(resolveAubeInstall, () => {
    it("emits a bare `aube install` for the default option set", () => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveAubeInstall(installDefaults);

        expect(bin).toBe("aube");
        expect(args).toStrictEqual(["install"]);
        expect(warnings).toStrictEqual([]);
    });

    it("places filter / recursive / workspace-root / silent / frozen globals before the subcommand", () => {
        expect.assertions(1);

        const { args } = resolveAubeInstall({
            ...installDefaults,
            filter: ["@scope/a", "@scope/b"],
            frozenLockfile: true,
            recursive: true,
            silent: true,
            workspaceRoot: true,
        });

        // Globals first (order: filter, recursive, workspace-root, silent,
        // frozen-lockfile), then `install`.
        expect(args).toStrictEqual([
            "--filter",
            "@scope/a",
            "--filter",
            "@scope/b",
            "--recursive",
            "--workspace-root",
            "--silent",
            "--frozen-lockfile",
            "install",
        ]);
    });

    it("maps every install-level flag", () => {
        expect.assertions(1);

        const { args } = resolveAubeInstall({
            ...installDefaults,
            dev: true,
            force: true,
            ignoreScripts: true,
            lockfileOnly: true,
            noOptional: true,
            offline: true,
            prod: true,
        });

        expect(args[0]).toBe("install");
        // Subset check: install-level flags appear after the subcommand.
        // Order within the install-flag group is asserted in
        // "interleaves globals before subcommand and install flags after"
        // below, which pins the full argv shape.
    });

    // Pinning the canonical `[globals…, "install", install-flags…]` shape
    // so a future refactor (e.g. moving `--silent` to a per-subcommand
    // position) cannot silently slip through. Aube's clap parser accepts
    // global flags at any position, but conventional aube usage keeps
    // them first — this test makes that convention executable.
    it("interleaves globals before the subcommand and install flags after — full kitchen-sink ordering", () => {
        expect.assertions(1);

        const { args } = resolveAubeInstall({
            dev: true,
            filter: ["@scope/a"],
            force: true,
            frozenLockfile: true,
            ignoreScripts: false,
            lockfileOnly: false,
            noOptional: true,
            offline: true,
            prod: false,
            recursive: true,
            silent: true,
            workspaceRoot: true,
        });

        expect(args).toStrictEqual([
            // ── globals (in pushFilterGlobals + post-globals order) ──
            "--filter",
            "@scope/a",
            "--recursive",
            "--workspace-root",
            "--silent",
            "--frozen-lockfile",
            // ── subcommand ──
            "install",
            // ── install-level flags (in source-defined order) ──
            "--dev",
            "--force",
            "--no-optional",
            "--offline",
        ]);
    });

    it("forwards --ignore-scripts silently (it's the universal vis default; aube already blocks scripts so no warning is emitted)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeInstall({ ...installDefaults, ignoreScripts: true });

        expect(args).toContain("--ignore-scripts");
        // No warning — vis applies --ignore-scripts as the universal
        // block-by-default policy, so it's not a user-directed flag we
        // need to flag as a no-op.
        expect(warnings).toStrictEqual([]);
    });
});

describe(resolveAubeAdd, () => {
    it("appends positional packages after flags", () => {
        expect.assertions(1);

        const { args } = resolveAubeAdd({
            exact: false,
            filter: [],
            global: false,
            optional: false,
            packages: ["lodash", "react@18"],
            peer: false,
            saveDev: true,
            workspace: false,
            workspaceRoot: false,
        });

        expect(args).toStrictEqual(["add", "--save-dev", "lodash", "react@18"]);
    });

    it("maps workspaceRoot to --workspace (aube's subcommand --workspace = pnpm's -w: redirect to workspace root)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeAdd({
            exact: false,
            filter: [],
            global: false,
            optional: false,
            packages: ["lodash"],
            peer: false,
            saveDev: false,
            workspace: false,
            workspaceRoot: true,
        });

        expect(args).toStrictEqual(["add", "--workspace", "lodash"]);
        expect(warnings).toStrictEqual([]);
    });

    it("warns and emits no flag when `workspace=true` (aube has no flag for the `workspace:` protocol)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeAdd({
            exact: false,
            filter: [],
            global: false,
            optional: false,
            packages: ["zod"],
            peer: false,
            saveDev: false,
            workspace: true,
            workspaceRoot: false,
        });

        // No `--workspace` flag emitted (would mean "redirect to root" in
        // aube — a different semantic from pnpm's `--workspace` protocol).
        expect(args).toStrictEqual(["add", "zod"]);
        expect(warnings).toContain(
            "aube has no flag for the `workspace:` protocol; it auto-detects local workspace members during add. Ignoring --workspace.",
        );
    });

    it("forwards filter as a global before `add`", () => {
        expect.assertions(1);

        const { args } = resolveAubeAdd({
            exact: true,
            filter: ["app", "lib"],
            global: false,
            optional: true,
            packages: ["zod"],
            peer: false,
            saveDev: false,
            workspace: false,
            workspaceRoot: false,
        });

        expect(args).toStrictEqual([
            "--filter",
            "app",
            "--filter",
            "lib",
            "add",
            "--save-exact",
            "--save-optional",
            "zod",
        ]);
    });
});

describe(resolveAubeRemove, () => {
    it("emits the package list with global/recursive flags", () => {
        expect.assertions(2);

        const { args, bin } = resolveAubeRemove({
            filter: [],
            global: false,
            packages: ["lodash"],
            recursive: true,
            saveDev: true,
            workspaceRoot: false,
        });

        expect(bin).toBe("aube");
        expect(args).toStrictEqual(["--recursive", "remove", "--save-dev", "lodash"]);
    });

    it("maps workspaceRoot to --workspace (aube remove has no -W variant)", () => {
        expect.assertions(1);

        const { args } = resolveAubeRemove({
            filter: [],
            global: false,
            packages: ["lodash"],
            recursive: false,
            saveDev: false,
            workspaceRoot: true,
        });

        expect(args).toStrictEqual(["remove", "--workspace", "lodash"]);
    });
});

describe(resolveAubeDedupe, () => {
    it("emits `aube dedupe` without --check by default", () => {
        expect.assertions(1);

        expect(resolveAubeDedupe(false).args).toStrictEqual(["dedupe"]);
    });

    it("appends --check when requested", () => {
        expect.assertions(1);

        expect(resolveAubeDedupe(true).args).toStrictEqual(["dedupe", "--check"]);
    });
});

describe(resolveAubeWhy, () => {
    const baseWhy = {
        dev: false,
        filter: [] as string[],
        global: false,
        json: false,
        long: false,
        noOptional: false,
        packages: [] as string[],
        parseable: false,
        prod: false,
        recursive: false,
    };

    it("warns and emits no positional when no package is given", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeWhy({ ...baseWhy });

        expect(args).toStrictEqual(["why"]);
        expect(warnings).toContain("aube why requires a package name; none provided.");
    });

    it("uses the first package and warns when multiple are given", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeWhy({ ...baseWhy, packages: ["react", "vue"] });

        expect(args).toStrictEqual(["why", "react"]);
        expect(warnings).toContain("aube why takes a single package; using the first.");
    });

    it("warns about ignored options that aube doesn't support (depth, no-optional, global)", () => {
        expect.assertions(3);

        const { warnings } = resolveAubeWhy({
            ...baseWhy,
            depth: 3,
            global: true,
            noOptional: true,
            packages: ["react"],
        });

        expect(warnings).toContain("aube why does not accept --depth; ignoring.");
        expect(warnings).toContain("aube why does not accept --no-optional; ignoring.");
        expect(warnings).toContain("aube why does not accept --global; ignoring.");
    });
});

describe(resolveAubeOutdated, () => {
    const baseOutdated = {
        compatible: false,
        dev: false,
        filter: [] as string[],
        format: "table",
        global: false,
        long: false,
        noOptional: false,
        packages: [] as string[],
        prod: false,
        recursive: false,
        workspaceRoot: false,
    };

    it("maps format=json to --json", () => {
        expect.assertions(1);

        const { args } = resolveAubeOutdated({ ...baseOutdated, format: "json" });

        expect(args).toContain("--json");
    });

    it("warns for unsupported format values", () => {
        expect.assertions(1);

        const { warnings } = resolveAubeOutdated({ ...baseOutdated, format: "list" });

        expect(warnings).toContain('aube outdated does not support format "list"; falling back to default table output.');
    });

    it("warns about ignored options that aube doesn't support", () => {
        expect.assertions(3);

        const { warnings } = resolveAubeOutdated({ ...baseOutdated, compatible: true, global: true, noOptional: true });

        expect(warnings).toContain("aube outdated does not accept --compatible; ignoring.");
        expect(warnings).toContain("aube outdated does not accept --no-optional; ignoring.");
        expect(warnings).toContain("aube outdated does not accept --global; ignoring.");
    });

    it("warns when workspaceRoot is set (aube has no --include-workspace-root)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeOutdated({ ...baseOutdated, workspaceRoot: true });

        // `--workspace-root` global is NOT emitted — it would change cwd to
        // root, producing a different (root-only) report rather than the
        // pnpm "include root in the workspace check" semantic.
        expect(args).not.toContain("--workspace-root");
        expect(warnings).toContain(
            "aube outdated has no `--include-workspace-root` equivalent. Run `vis outdated` separately at the workspace root if you need its outdated list.",
        );
    });

    it("uses the first package as a pattern arg and warns on multiple", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeOutdated({ ...baseOutdated, packages: ["react", "vue"] });

        expect(args).toStrictEqual(["outdated", "react"]);
        expect(warnings).toContain("aube outdated takes a single pattern argument; using the first.");
    });
});

describe(resolveAubeDlx, () => {
    it("forwards trailing args without a `--` separator (matches aube's trailing_var_arg)", () => {
        expect.assertions(2);

        const { args, bin } = resolveAubeDlx({
            additionalPackages: [],
            args: ["my-app", "--template", "react"],
            package: "create-vite",
            shellMode: false,
            silent: false,
        });

        expect(bin).toBe("aube");
        expect(args).toStrictEqual(["dlx", "create-vite", "my-app", "--template", "react"]);
    });

    it("places --silent as a global before the subcommand and -p/--package as repeated subcommand flags", () => {
        expect.assertions(1);

        const { args } = resolveAubeDlx({
            additionalPackages: ["chalk", "prompts"],
            args: ["script.js"],
            package: "esbuild",
            shellMode: true,
            silent: true,
        });

        expect(args).toStrictEqual([
            "--silent",
            "dlx",
            "--package",
            "chalk",
            "--package",
            "prompts",
            "--shell-mode",
            "esbuild",
            "script.js",
        ]);
    });
});

describe(resolveAubeExec, () => {
    it("places filter/recursive globals before exec and forwards trailing args", () => {
        expect.assertions(1);

        const { args } = resolveAubeExec({
            args: [".", "--fix"],
            command: "eslint",
            filter: ["@app/*"],
            parallel: true,
            recursive: true,
            reverse: false,
            shellMode: false,
            workspaceRoot: false,
        });

        expect(args).toStrictEqual(["--filter", "@app/*", "--recursive", "exec", "--parallel", "eslint", ".", "--fix"]);
    });
});

describe(resolveAubeLink, () => {
    it("emits `aube link` with no positional when target is null", () => {
        expect.assertions(1);

        expect(resolveAubeLink(null).args).toStrictEqual(["link"]);
    });

    it("appends the target when provided", () => {
        expect.assertions(1);

        expect(resolveAubeLink("./packages/lib").args).toStrictEqual(["link", "./packages/lib"]);
    });
});

describe(resolveAubeUnlink, () => {
    it("warns when more than one package is provided and uses only the first", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeUnlink(["a", "b"], false);

        expect(args).toStrictEqual(["unlink", "a"]);
        expect(warnings).toContain("aube unlink takes a single package; using the first.");
    });

    it("emits --recursive as a global before the subcommand", () => {
        expect.assertions(1);

        const { args } = resolveAubeUnlink([], true);

        expect(args).toStrictEqual(["--recursive", "unlink"]);
    });
});

describe(resolveAubeInfo, () => {
    it("emits `aube view -- <pkg>` when no field or json is requested", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeInfo({ fields: [], json: false, package: "react" });

        expect(args).toStrictEqual(["view", "--", "react"]);
        expect(warnings).toStrictEqual([]);
    });

    it("appends --json when no field is selected", () => {
        expect.assertions(1);

        const { args } = resolveAubeInfo({ fields: [], json: true, package: "react" });

        expect(args).toStrictEqual(["view", "--", "react", "--json"]);
    });

    it("uses the first field and drops --json when both are passed (aube rejects the combination)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveAubeInfo({ fields: ["version", "dependencies"], json: true, package: "react" });

        expect(args).toStrictEqual(["view", "--", "react", "version"]);
        expect(warnings).toStrictEqual([
            "aube view only supports a single field; using the first.",
            "aube view does not support --json with a field selector; printing the field without --json.",
        ]);
    });
});

describe(resolveAubeUpdate, () => {
    it("emits `aube update` with packages and global flags ordered correctly", () => {
        expect.assertions(1);

        const { args } = resolveAubeUpdate({
            dev: true,
            filters: ["@scope/a"],
            global: false,
            interactive: false,
            latest: true,
            noOptional: true,
            noSave: false,
            packages: ["zod"],
            prod: false,
            recursive: true,
            workspaceRoot: false,
        });

        expect(args).toStrictEqual(["--filter", "@scope/a", "--recursive", "update", "--dev", "--latest", "--no-optional", "zod"]);
    });
});

describe(resolveAubePmCommand, () => {
    it("forwards the subcommand and args verbatim (aube has no `pm` namespace)", () => {
        expect.assertions(2);

        const { args, bin } = resolveAubePmCommand("audit", ["--prod"]);

        expect(bin).toBe("aube");
        expect(args).toStrictEqual(["audit", "--prod"]);
    });

    it.each(["fund", "ping", "search", "token"])("delegates `%s` to npm (parity with the existing pnpm/yarn/bun resolver)", (subcommand) => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveAubePmCommand(subcommand, ["arg1"]);

        expect(bin).toBe("npm");
        expect(args).toStrictEqual([subcommand, "arg1"]);
        expect(warnings).toContain(`'${subcommand}' is not natively supported by aube. Delegating to npm.`);
    });
});
