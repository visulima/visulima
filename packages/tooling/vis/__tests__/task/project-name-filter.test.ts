import { describe, expect, it } from "vitest";

import { VisUserError } from "../../src/errors/vis-user-error";
import { filterProjectsByNames } from "../../src/task/project-name-filter";

const known = ["@org/web", "@org/api", "convex-audit-history"];

describe(filterProjectsByNames, () => {
    it("should narrow to the requested projects", () => {
        expect.assertions(1);

        expect(filterProjectsByNames(known, "@org/web,@org/api", known)).toStrictEqual(["@org/web", "@org/api"]);
    });

    it("should tolerate whitespace around comma-separated names", () => {
        expect.assertions(1);

        expect(filterProjectsByNames(known, " @org/web , @org/api ", known)).toStrictEqual(["@org/web", "@org/api"]);
    });

    it("should throw a user error rather than silently planning the whole workspace", () => {
        expect.assertions(1);

        expect(() => filterProjectsByNames(known, "nope", known)).toThrow(VisUserError);
    });

    it("should suggest the closest project name first on a typo", () => {
        expect.assertions(1);

        // Other names within the edit-distance cutoff may follow, but the
        // intended one has to lead — that is what makes the hint useful.
        expect(() => filterProjectsByNames(known, "@org/wed", known)).toThrow(/Did you mean: @org\/web[,?]/);
    });

    it("should point at `vis list` when nothing is close enough to suggest", () => {
        expect.assertions(1);

        expect(() => filterProjectsByNames(known, "totally-unrelated-name", known)).toThrow(/Run `vis list`/);
    });

    it("should reject an explicitly empty --projects rather than disabling the filter", () => {
        expect.assertions(2);

        // `--projects=` must not silently widen the run to every project.
        expect(() => filterProjectsByNames(known, "", known)).toThrow(VisUserError);
        expect(() => filterProjectsByNames(known, " , , ", known)).toThrow(/given no project names/);
    });

    it("should report the original request in the message", () => {
        expect.assertions(1);

        expect(() => filterProjectsByNames(known, "chat", known)).toThrow(/No matching projects found for: chat/);
    });
});
