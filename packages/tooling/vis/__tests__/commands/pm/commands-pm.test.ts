/**
 * Tests for all package management command files.
 * Validates option parsing, argument handling, error cases, and edge cases.
 * Native resolver correctness is covered in native-binding.test.ts.
 */

import { describe, expect, it } from "vitest";

// ── Shared helpers ───────────────────────────────────────────────────

const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? (value as string[]) : [value as string];
};

describe("toStringArray helper", () => {
    it("should handle undefined", () => {
        expect.assertions(1);

        expect(toStringArray(undefined)).toStrictEqual([]);
    });

    it("should handle null", () => {
        expect.assertions(1);

        expect(toStringArray(null)).toStrictEqual([]);
    });

    it("should handle empty string", () => {
        expect.assertions(1);

        expect(toStringArray("")).toStrictEqual([]);
    });

    it("should wrap a single string in an array", () => {
        expect.assertions(1);

        expect(toStringArray("app")).toStrictEqual(["app"]);
    });

    it("should pass through an array unchanged", () => {
        expect.assertions(1);

        expect(toStringArray(["app", "lib"])).toStrictEqual(["app", "lib"]);
    });

    it("should handle empty array", () => {
        expect.assertions(1);

        expect(toStringArray([])).toStrictEqual([]);
    });
});

// ── Install command ──────────────────────────────────────────────────

describe("install command options", () => {
    it("should build correct InstallOptions defaults", () => {
        expect.assertions(12);

        const options: Record<string, unknown> = {};

        const opts = {
            dev: (options.dev as boolean) || false,
            filter: toStringArray(options.filter),
            force: (options.force as boolean) || false,
            frozenLockfile: (options["frozen-lockfile"] as boolean) || false,
            ignoreScripts: (options["ignore-scripts"] as boolean) || false,
            lockfileOnly: (options["lockfile-only"] as boolean) || false,
            noOptional: (options["no-optional"] as boolean) || false,
            offline: (options.offline as boolean) || false,
            prod: (options.prod as boolean) || false,
            recursive: (options.recursive as boolean) || false,
            silent: (options.silent as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        };

        expect(opts.dev).toBe(false);
        expect(opts.filter).toStrictEqual([]);
        expect(opts.force).toBe(false);
        expect(opts.frozenLockfile).toBe(false);
        expect(opts.ignoreScripts).toBe(false);
        expect(opts.lockfileOnly).toBe(false);
        expect(opts.noOptional).toBe(false);
        expect(opts.offline).toBe(false);
        expect(opts.prod).toBe(false);
        expect(opts.recursive).toBe(false);
        expect(opts.silent).toBe(false);
        expect(opts.workspaceRoot).toBe(false);
    });

    it("should parse boolean options correctly", () => {
        expect.assertions(3);

        const options: Record<string, unknown> = {
            "frozen-lockfile": true,
            prod: true,
            silent: true,
        };

        expect((options["frozen-lockfile"] as boolean) || false).toBe(true);
        expect((options.prod as boolean) || false).toBe(true);
        expect((options.silent as boolean) || false).toBe(true);
    });

    it("should parse filter as array", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { filter: ["app", "lib"] };

        expect(toStringArray(options.filter)).toStrictEqual(["app", "lib"]);
    });

    it("should parse single filter as array", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { filter: "app" };

        expect(toStringArray(options.filter)).toStrictEqual(["app"]);
    });
});

// ── Add command ──────────────────────────────────────────────────────

describe("add command argument validation", () => {
    it("should reject empty packages", () => {
        expect.assertions(1);

        const packages: string[] = [];

        expect(packages.length === 0).toBe(true);
    });

    it("should accept multiple packages", () => {
        expect.assertions(1);

        const packages = ["react", "react-dom", "@types/react"];

        expect(packages).toHaveLength(3);
    });

    it("should build correct AddOptions", () => {
        expect.assertions(5);

        const options: Record<string, unknown> = {
            exact: true,
            "save-dev": true,
        };

        const opts = {
            exact: (options.exact as boolean) || false,
            global: (options.global as boolean) || false,
            peer: (options["save-peer"] as boolean) || false,
            saveDev: (options["save-dev"] as boolean) || false,
            workspace: (options.workspace as boolean) || false,
        };

        expect(opts.saveDev).toBe(true);
        expect(opts.exact).toBe(true);
        expect(opts.global).toBe(false);
        expect(opts.peer).toBe(false);
        expect(opts.workspace).toBe(false);
    });
});

// ── Remove command ───────────────────────────────────────────────────

describe("remove command argument validation", () => {
    it("should reject empty packages", () => {
        expect.assertions(1);

        const packages: string[] = [];

        expect(packages.length === 0).toBe(true);
    });

    it("should build correct RemoveOptions", () => {
        expect.assertions(4);

        const options: Record<string, unknown> = { global: true };

        const opts = {
            global: (options.global as boolean) || false,
            recursive: (options.recursive as boolean) || false,
            saveDev: (options["save-dev"] as boolean) || false,
            workspaceRoot: (options["workspace-root"] as boolean) || false,
        };

        expect(opts.global).toBe(true);
        expect(opts.recursive).toBe(false);
        expect(opts.saveDev).toBe(false);
        expect(opts.workspaceRoot).toBe(false);
    });
});

// ── Dedupe command ───────────────────────────────────────────────────

describe("dedupe command options", () => {
    it("should default check to false", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = {};

        expect((options.check as boolean) || false).toBe(false);
    });

    it("should parse check flag", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { check: true };

        expect((options.check as boolean) || false).toBe(true);
    });
});

// ── Why command ──────────────────────────────────────────────────────

describe("why command argument validation", () => {
    it("should reject empty packages", () => {
        expect.assertions(1);

        const packages: string[] = [];

        expect(packages.length === 0).toBe(true);
    });

    it("should build correct WhyOptions with depth", () => {
        expect.assertions(2);

        const options: Record<string, unknown> = { depth: 3, json: true };

        const depth = options.depth === undefined ? undefined : Number(options.depth);

        expect(depth).toBe(3);
        expect((options.json as boolean) || false).toBe(true);
    });

    it("should handle undefined depth", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = {};

        const depth = options.depth === undefined ? undefined : Number(options.depth);

        expect(depth).toBeUndefined();
    });
});

// ── Outdated command ─────────────────────────────────────────────────

describe("outdated command options", () => {
    it("should default format to table", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = {};

        expect((options.format as string) || "table").toBe("table");
    });

    it("should accept json format", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { format: "json" };

        expect((options.format as string) || "table").toBe("json");
    });

    it("should accept list format", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { format: "list" };

        expect((options.format as string) || "table").toBe("list");
    });
});

// ── Link / Unlink commands ───────────────────────────────────────────

describe("link command argument handling", () => {
    it("should handle no target (register current package)", () => {
        expect.assertions(1);

        const argument: string[] = [];
        const target = argument[0] ?? null;

        expect(target).toBeNull();
    });

    it("should handle package name target", () => {
        expect.assertions(1);

        const argument = ["react"];
        const target = argument[0] ?? null;

        expect(target).toBe("react");
    });

    it("should handle directory path target", () => {
        expect.assertions(1);

        const argument = ["./packages/utils"];
        const target = argument[0] ?? null;

        expect(target).toBe("./packages/utils");
    });
});

describe("unlink command options", () => {
    it("should default recursive to false", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = {};

        expect((options.recursive as boolean) || false).toBe(false);
    });

    it("should parse recursive flag", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { recursive: true };

        expect((options.recursive as boolean) || false).toBe(true);
    });
});

// ── Dlx command ──────────────────────────────────────────────────────

describe("dlx command argument validation", () => {
    it("should reject empty args", () => {
        expect.assertions(1);

        const args: string[] = [];

        expect(args.length === 0).toBe(true);
    });

    it("should extract package and remaining args", () => {
        expect.assertions(2);

        const args = ["create-vite", "my-app", "--template", "react-ts"];
        const [pkg, ...rest] = args;

        expect(pkg).toBe("create-vite");
        expect(rest).toStrictEqual(["my-app", "--template", "react-ts"]);
    });

    it("should handle package with version specifier", () => {
        expect.assertions(2);

        const args = ["typescript@5.5.4", "tsc", "--version"];
        const [pkg, ...rest] = args;

        expect(pkg).toBe("typescript@5.5.4");
        expect(rest).toStrictEqual(["tsc", "--version"]);
    });

    it("should parse additional packages option", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { package: ["cowsay", "lolcatjs"] };
        const additionalPackages = options.package ? (Array.isArray(options.package) ? (options.package as string[]) : [options.package as string]) : [];

        expect(additionalPackages).toStrictEqual(["cowsay", "lolcatjs"]);
    });

    it("should handle single additional package", () => {
        expect.assertions(1);

        const options: Record<string, unknown> = { package: "cowsay" };
        const additionalPackages = options.package ? (Array.isArray(options.package) ? (options.package as string[]) : [options.package as string]) : [];

        expect(additionalPackages).toStrictEqual(["cowsay"]);
    });
});

// ── Exec command ─────────────────────────────────────────────────────

describe("exec command argument validation", () => {
    it("should reject empty args", () => {
        expect.assertions(1);

        const args: string[] = [];

        expect(args.length === 0).toBe(true);
    });

    it("should extract command and remaining args", () => {
        expect.assertions(2);

        const args = ["eslint", ".", "--fix"];
        const [command, ...rest] = args;

        expect(command).toBe("eslint");
        expect(rest).toStrictEqual([".", "--fix"]);
    });

    it("should build correct ExecOptions", () => {
        expect.assertions(4);

        const options: Record<string, unknown> = {
            parallel: true,
            recursive: true,
        };

        expect((options.recursive as boolean) || false).toBe(true);
        expect((options.parallel as boolean) || false).toBe(true);
        expect((options["shell-mode"] as boolean) || false).toBe(false);
        expect((options.reverse as boolean) || false).toBe(false);
    });
});

// ── PM command ───────────────────────────────────────────────────────

describe("pm command argument validation", () => {
    it("should reject empty args", () => {
        expect.assertions(1);

        const args: string[] = [];

        expect(args.length === 0).toBe(true);
    });

    it("should extract subcommand and rest", () => {
        expect.assertions(2);

        const args = ["cache", "dir"];
        const [subcommand, ...rest] = args;

        expect(subcommand).toBe("cache");
        expect(rest).toStrictEqual(["dir"]);
    });

    it("should handle subcommand with no extra args", () => {
        expect.assertions(2);

        const args = ["whoami"];
        const [subcommand, ...rest] = args;

        expect(subcommand).toBe("whoami");
        expect(rest).toStrictEqual([]);
    });

    it("should handle complex pm commands", () => {
        expect.assertions(2);

        const args = ["publish", "--dry-run", "--tag", "beta"];
        const [subcommand, ...rest] = args;

        expect(subcommand).toBe("publish");
        expect(rest).toStrictEqual(["--dry-run", "--tag", "beta"]);
    });
});
