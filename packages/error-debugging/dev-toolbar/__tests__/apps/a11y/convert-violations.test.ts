import { describe, expect, it } from "vitest";

import { convertViolations, nodeSelector } from "../../../src/apps/a11y/a11y-store";

type Violation = Parameters<typeof convertViolations>[0][number];

const violation = (overrides: Partial<Violation> = {}): Violation => {
    return {
        help: "Elements must have sufficient colour contrast",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.8/color-contrast",
        id: "color-contrast",
        impact: "serious",
        nodes: [{ html: "<a>x</a>", target: [".link"] }],
        tags: ["wcag2aa", "wcag143", "cat.color"],
        ...overrides,
    };
};

describe(nodeSelector, () => {
    it("takes the last entry of the target path", () => {
        expect.hasAssertions();

        expect(nodeSelector(["#outer", ".inner"])).toBe(".inner");
    });

    it("joins a nested target, which is how a frame selector arrives", () => {
        expect.hasAssertions();

        expect(nodeSelector(["iframe#preview", ["html", "body", ".btn"]])).toBe("html body .btn");
    });

    it("returns an empty string for an empty target", () => {
        expect.hasAssertions();

        expect(nodeSelector([])).toBe("");
    });
});

describe(convertViolations, () => {
    it("maps a violation onto the panel's issue shape", () => {
        expect.hasAssertions();

        expect(convertViolations([violation()], [])).toStrictEqual([
            {
                helpUrl: "https://dequeuniversity.com/rules/axe/4.8/color-contrast",
                id: "color-contrast",
                impact: "serious",
                message: "Elements must have sufficient colour contrast",
                nodes: [{ html: "<a>x</a>", selector: ".link" }],
                wcagTags: ["wcag2aa", "wcag143"],
            },
        ]);
    });

    it("skips a rule the user disabled", () => {
        expect.hasAssertions();

        expect(convertViolations([violation()], ["color-contrast"])).toStrictEqual([]);
    });

    it("keeps other rules when one is disabled", () => {
        expect.hasAssertions();

        const issues = convertViolations([violation(), violation({ id: "image-alt" })], ["color-contrast"]);

        expect(issues.map((issue) => issue.id)).toStrictEqual(["image-alt"]);
    });

    it("defaults a missing impact to minor rather than undefined", () => {
        expect.hasAssertions();

        expect(convertViolations([violation({ impact: undefined })], [])[0]?.impact).toBe("minor");
    });

    it("keeps only wcag tags and best-practice", () => {
        expect.hasAssertions();

        const issues = convertViolations([violation({ tags: ["wcag2a", "best-practice", "cat.forms", "section508"] })], []);

        expect(issues[0]?.wcagTags).toStrictEqual(["wcag2a", "best-practice"]);
    });
});
