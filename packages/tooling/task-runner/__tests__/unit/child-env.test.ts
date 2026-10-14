import { describe, expect, it } from "vitest";

import {
    buildChildEnv,
    childEnvNameFilter,
    CLEAN_ENV_BASE_NAMES,
    CLEAN_ENV_POSIX_NAMES,
    CLEAN_ENV_WIN32_NAMES,
    cleanEnvEssentialNames,
    pickChildParentEnv,
    resolveChildEnvPolicy,
} from "../../src/child-env";

// Every check passes the platform explicitly so the suite gives the same
// answer on Linux, macOS and Windows runners.
describe(resolveChildEnvPolicy, () => {
    it("defaults to inherit with no allow-list when nothing is configured", () => {
        expect.assertions(1);

        expect(resolveChildEnvPolicy()).toStrictEqual({ allow: [], mode: "inherit" });
    });

    it("applies a clean workspace policy to a task with no override", () => {
        expect.assertions(1);

        expect(resolveChildEnvPolicy({ allow: ["NODE_ENV"], mode: "clean" })).toStrictEqual({ allow: ["NODE_ENV"], mode: "clean" });
    });

    it("lets a target opt out of a clean workspace", () => {
        expect.assertions(1);

        expect(resolveChildEnvPolicy({ allow: ["NODE_ENV"], mode: "clean" }, { mode: "inherit" })).toStrictEqual({ allow: [], mode: "inherit" });
    });

    it("gives a target clean mode with its own allow-list under an inherit workspace", () => {
        expect.assertions(1);

        expect(resolveChildEnvPolicy({ mode: "inherit" }, { allow: ["DATABASE_URL"], mode: "clean" })).toStrictEqual({
            allow: ["DATABASE_URL"],
            mode: "clean",
        });
    });

    it("adds a target's allow-list to the workspace allow-list", () => {
        expect.assertions(1);

        expect(resolveChildEnvPolicy({ allow: ["NODE_ENV"], mode: "clean" }, { allow: ["DATABASE_URL"], mode: "clean" })).toStrictEqual({
            allow: ["NODE_ENV", "DATABASE_URL"],
            mode: "clean",
        });
    });
});

describe(childEnvNameFilter, () => {
    it("keeps every name under inherit", () => {
        expect.assertions(1);

        const keep = childEnvNameFilter({ mode: "inherit" }, "linux");

        expect(keep("ANYTHING_AT_ALL")).toBe(true);
    });

    it("keeps the base names and drops an unrelated name under clean", () => {
        expect.assertions(2);

        const keep = childEnvNameFilter({ mode: "clean" }, "linux");

        expect(CLEAN_ENV_BASE_NAMES.map((name) => keep(name))).toStrictEqual(CLEAN_ENV_BASE_NAMES.map(() => true));
        expect(keep("G2_UNRELATED")).toBe(false);
    });

    it("keeps the POSIX essentials, including the LC_* family, on POSIX", () => {
        expect.assertions(1);

        const keep = childEnvNameFilter({ mode: "clean" }, "darwin");

        expect(CLEAN_ENV_POSIX_NAMES.filter((name) => !name.includes("*")).every((name) => keep(name))).toBe(true);
    });

    it("keeps LC_* names on POSIX", () => {
        expect.assertions(2);

        const keep = childEnvNameFilter({ mode: "clean" }, "linux");

        expect(keep("LC_ALL")).toBe(true);
        expect(keep("LC_CTYPE")).toBe(true);
    });

    it("keeps the Windows essentials on win32 and not the POSIX ones", () => {
        expect.assertions(3);

        const keep = childEnvNameFilter({ mode: "clean" }, "win32");

        expect(CLEAN_ENV_WIN32_NAMES.map((name) => keep(name))).toStrictEqual(CLEAN_ENV_WIN32_NAMES.map(() => true));
        expect(keep("TMPDIR")).toBe(false);
        expect(keep("LC_ALL")).toBe(false);
    });

    it("matches names case-insensitively on win32 but case-sensitively elsewhere", () => {
        expect.assertions(4);

        const windows = childEnvNameFilter({ mode: "clean" }, "win32");
        const posix = childEnvNameFilter({ mode: "clean" }, "linux");

        // Windows stores the variable as `Path` and `SystemRoot`, but a
        // caller may spell them differently; both must still match.
        expect(windows("Path")).toBe(true);
        expect(windows("systemroot")).toBe(true);
        expect(posix("Path")).toBe(false);
        expect(posix("path")).toBe(false);
    });

    it("applies allow-list names and wildcard patterns", () => {
        expect.assertions(4);

        const keep = childEnvNameFilter({ allow: ["G2_EXACT", "G2_WILD_*"], mode: "clean" }, "linux");

        expect(keep("G2_EXACT")).toBe(true);
        expect(keep("G2_WILD_ONE")).toBe(true);
        expect(keep("G2_WILD_")).toBe(true);
        expect(keep("G2_EXACT_NOT")).toBe(false);
    });

    it("keeps the essentials the platform exposes", () => {
        expect.assertions(1);

        expect(cleanEnvEssentialNames("win32")).toContain("SystemRoot");
    });
});

describe(pickChildParentEnv, () => {
    it("drops unset entries and keeps only the policy names", () => {
        expect.assertions(2);

        const parent = { G2_ALLOWED: "a", G2_UNRELATED: "u", HOME: "/home/x", PATH: "/bin", UNDEFINED_VALUE: undefined };
        const picked = pickChildParentEnv(parent, { allow: ["G2_ALLOWED"], mode: "clean" }, "linux");

        expect(picked).toStrictEqual({ G2_ALLOWED: "a", HOME: "/home/x", PATH: "/bin" });
        expect(picked).not.toHaveProperty("UNDEFINED_VALUE");
    });
});

describe(buildChildEnv, () => {
    it("lays injected entries over the filtered parent env without filtering them", () => {
        expect.assertions(3);

        const env = buildChildEnv({
            injected: { UNSET: undefined, VIS_ARG_MODE: "fast", VIS_TASK_SLOTS: "3" },
            parentEnv: { G2_UNRELATED: "u", PATH: "/bin" },
            platform: "linux",
            policy: { mode: "clean" },
        });

        // Injected names survive clean mode even though nothing allow-lists them.
        expect(env).toStrictEqual({ PATH: "/bin", VIS_ARG_MODE: "fast", VIS_TASK_SLOTS: "3" });
        expect(env).not.toHaveProperty("G2_UNRELATED");
        expect(env).not.toHaveProperty("UNSET");
    });

    it("keeps the whole parent env under inherit", () => {
        expect.assertions(1);

        const env = buildChildEnv({ injected: {}, parentEnv: { G2_UNRELATED: "u", PATH: "/bin" }, platform: "linux", policy: { mode: "inherit" } });

        expect(env).toStrictEqual({ G2_UNRELATED: "u", PATH: "/bin" });
    });
});

// The Windows branch is selected by the platform argument, so it is covered on
// any OS: Windows environment names are case-insensitive, and the clean policy
// keeps the Windows essentials.
describe("windows child environment", () => {
    const clean = { allow: [], mode: "clean" as const };

    it("keeps a parent name that differs only in case from an allow-listed name", () => {
        expect.assertions(1);

        const keep = childEnvNameFilter({ allow: ["node_env"], mode: "clean" }, "win32");

        expect(keep("NODE_ENV")).toBe(true);
    });

    it("keeps the Windows essentials whatever their case, and drops the POSIX ones", () => {
        expect.assertions(4);

        const picked = pickChildParentEnv(
            { COMSPEC: "cmd.exe", Path: String.raw`C:\bin`, PATHEXT: ".EXE", SystemRoot: String.raw`C:\Windows`, systemroot: String.raw`C:\Windows`, TMPDIR: "/tmp" },
            clean,
            "win32",
        );

        expect(picked).toHaveProperty("Path", String.raw`C:\bin`);
        expect(picked).toHaveProperty("PATHEXT", ".EXE");
        expect(picked).toHaveProperty("systemroot", String.raw`C:\Windows`);
        expect(picked).not.toHaveProperty("TMPDIR");
    });

    it("keeps each required Windows variable name", () => {
        expect.hasAssertions();

        const parent = Object.fromEntries(CLEAN_ENV_WIN32_NAMES.map((name) => [name, `v-${name}`]));
        const picked = pickChildParentEnv(parent, clean, "win32");

        for (const name of CLEAN_ENV_WIN32_NAMES) {
            expect(picked[name], name).toBe(`v-${name}`);
        }
    });

    it("drops the POSIX essentials on Windows and the Windows essentials on POSIX", () => {
        expect.assertions(2);

        const parent = { PATHEXT: ".EXE", SystemRoot: String.raw`C:\Windows`, TMPDIR: "/tmp" };

        expect(pickChildParentEnv(parent, clean, "win32")).not.toHaveProperty("TMPDIR");
        expect(pickChildParentEnv(parent, clean, "linux")).not.toHaveProperty("SystemRoot");
    });

    it("lets an injected PATH replace a kept parent Path, leaving one variable", () => {
        expect.assertions(2);

        const env = buildChildEnv({
            injected: { PATH: String.raw`C:\injected` },
            parentEnv: { Path: String.raw`C:\parent` },
            platform: "win32",
            // Allow-listed by its exact spelling, so the parent name survives on every
            // platform and only the Windows fold can make the result single-valued.
            policy: { allow: ["Path"], mode: "clean" },
        });

        expect(env).toStrictEqual({ PATH: String.raw`C:\injected` });
        expect(Object.keys(env).filter((name) => name.toUpperCase() === "PATH")).toHaveLength(1);
    });

    it("keeps Path and PATH as separate names on POSIX", () => {
        expect.assertions(1);

        const env = buildChildEnv({
            injected: { PATH: "/injected" },
            parentEnv: { Path: "/parent" },
            platform: "linux",
            policy: { allow: ["Path"], mode: "clean" },
        });

        expect(env).toStrictEqual({ PATH: "/injected", Path: "/parent" });
    });
});
