import { describe, expect, it } from "vitest";

import getSlavicForm from "../../../../src/language/util/duration/get-slavic-form";

describe(getSlavicForm, () => {
    it("should return form 2 for non-integer counters", () => {
        expect.assertions(2);

        expect(getSlavicForm(2.5)).toBe(2);
        expect(getSlavicForm(1.1)).toBe(2);
    });

    it("should return form 0 for counters in the 5-20 / 5-9 / multiple-of-ten ranges", () => {
        expect.assertions(5);

        expect(getSlavicForm(11)).toBe(0); // counter % 100 in 5..20
        expect(getSlavicForm(25)).toBe(0); // counter % 10 in 5..9
        expect(getSlavicForm(30)).toBe(0); // counter % 10 === 0
        expect(getSlavicForm(5)).toBe(0);
        expect(getSlavicForm(0)).toBe(0);
    });

    it("should return form 1 for counters ending in 1 (but not 11)", () => {
        expect.assertions(2);

        expect(getSlavicForm(1)).toBe(1);
        expect(getSlavicForm(21)).toBe(1);
    });

    it("should return form 2 for the remaining counters greater than one", () => {
        expect.assertions(2);

        expect(getSlavicForm(2)).toBe(2);
        expect(getSlavicForm(3)).toBe(2);
    });

    it("should return form 0 for integer counters that fall through all checks", () => {
        expect.assertions(2);

        expect(getSlavicForm(-3)).toBe(0);
        expect(getSlavicForm(-7)).toBe(0);
    });
});
