import { describe, expect, it } from "vitest";

import { checkStrictEnv, extractEnvReferences, formatStrictEnvError } from "../../src/task/strict-env";

describe(extractEnvReferences, () => {
    it("returns an empty list when the command has no references", () => {
        expect.assertions(1);
        expect(extractEnvReferences("vitest run")).toEqual([]);
    });

    it("parses bare $VAR references", () => {
        expect.assertions(1);
        expect(extractEnvReferences("psql $DB_URL")).toEqual([{ hasDefault: false, name: "DB_URL" }]);
    });

    it("parses braced ${VAR} references", () => {
        expect.assertions(1);
        expect(extractEnvReferences("psql ${DB_URL}/app")).toEqual([{ hasDefault: false, name: "DB_URL" }]);
    });

    it("marks ${VAR:-default} as having a default", () => {
        expect.assertions(1);
        expect(extractEnvReferences('echo "${LOG_LEVEL:-info}"')).toEqual([{ hasDefault: true, name: "LOG_LEVEL" }]);
    });

    it("treats a mixed reference (one with default, one without) as required", () => {
        expect.assertions(1);
        // The unconditional reference will silently expand to "" if
        // unset — the fact that it's also referenced WITH a default
        // somewhere doesn't save it.
        expect(extractEnvReferences("echo $TOKEN && echo ${TOKEN:-x}")).toEqual([
            { hasDefault: false, name: "TOKEN" },
        ]);
    });

    it("dedupes repeated references", () => {
        expect.assertions(1);
        expect(extractEnvReferences("$A $A ${A}")).toEqual([{ hasDefault: false, name: "A" }]);
    });

    it("ignores POSIX special vars ($@, $*, $#, $$)", () => {
        expect.assertions(1);
        expect(extractEnvReferences('node script.js "$@" $#')).toEqual([]);
    });

    it("ignores numeric positional params ($0, $1)", () => {
        expect.assertions(1);
        expect(extractEnvReferences("echo $0 $1")).toEqual([]);
    });
});

describe(checkStrictEnv, () => {
    const baseOptions = {
        command: "psql $DB_URL",
        processEnv: {},
        taskEnv: {},
        taskId: "@app/api:test",
    };

    it("returns undefined when the command has no references", () => {
        expect.assertions(1);
        expect(checkStrictEnv({ ...baseOptions, command: "vitest run" })).toBeUndefined();
    });

    it("returns undefined when every reference is set in taskEnv", () => {
        expect.assertions(1);
        expect(checkStrictEnv({ ...baseOptions, taskEnv: { DB_URL: "postgres://..." } })).toBeUndefined();
    });

    it("returns undefined when a reference is set in processEnv", () => {
        expect.assertions(1);
        expect(checkStrictEnv({ ...baseOptions, processEnv: { DB_URL: "postgres://..." } })).toBeUndefined();
    });

    it("treats an empty-string env value as set (user explicitly chose it)", () => {
        expect.assertions(1);
        expect(checkStrictEnv({ ...baseOptions, taskEnv: { DB_URL: "" } })).toBeUndefined();
    });

    it("returns a violation listing the missing var", () => {
        expect.assertions(1);
        expect(checkStrictEnv(baseOptions)).toEqual({ missing: ["DB_URL"], taskId: "@app/api:test" });
    });

    it("returns missing names sorted alphabetically", () => {
        expect.assertions(1);
        expect(
            checkStrictEnv({
                ...baseOptions,
                command: "$DB_URL $API_KEY $REDIS_HOST",
                taskEnv: {},
            }),
        ).toEqual({ missing: ["API_KEY", "DB_URL", "REDIS_HOST"], taskId: "@app/api:test" });
    });

    it("does not flag a var that has a default", () => {
        expect.assertions(1);
        expect(
            checkStrictEnv({ ...baseOptions, command: 'echo "${LOG_LEVEL:-info}"' }),
        ).toBeUndefined();
    });
});

describe(formatStrictEnvError, () => {
    it("renders one missing var with singular grammar", () => {
        expect.assertions(2);

        const message = formatStrictEnvError({ missing: ["DB_URL"], taskId: "@app/api:test" });

        expect(message).toContain("@app/api:test references unset variable $DB_URL");
        expect(message).toContain("Set it");
    });

    it("renders multiple missing vars with plural grammar", () => {
        expect.assertions(2);

        const message = formatStrictEnvError({ missing: ["API_KEY", "DB_URL"], taskId: "@app/api:test" });

        expect(message).toContain("unset variables $API_KEY, $DB_URL");
        expect(message).toContain("Set them");
    });
});
