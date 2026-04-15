import { describe, expect, it } from "vitest";

import Output, { OutputCaches } from "../../src/ink/output";

describe("output-caches", () => {
    it("output uses provided caches instance", () => {
        expect.assertions(2);

        const caches = new OutputCaches();
        const output = new Output({
            caches,
            height: 1,
            width: 8,
        });

        output.write(0, 0, "abc", { transformers: [] });
        output.get();

        expect((output as unknown as { caches: OutputCaches }).caches).toBe(caches);
        expect(caches.styledLines.size).toBeGreaterThan(0);
    });

    it("default caches are isolated per Output instance", () => {
        expect.assertions(1);

        const output1 = new Output({
            height: 1,
            width: 8,
        });
        const output2 = new Output({
            height: 1,
            width: 8,
        });

        const output1WithCaches = output1 as unknown as { caches: OutputCaches };
        const output2WithCaches = output2 as unknown as { caches: OutputCaches };

        expect(output1WithCaches.caches).not.toBe(output2WithCaches.caches);
    });

    it("shared caches reuse entries across Output instances", () => {
        expect.assertions(2);

        const caches = new OutputCaches();

        const output1 = new Output({
            caches,
            height: 1,
            width: 8,
        });

        output1.write(0, 0, "abc", { transformers: [] });
        output1.get();

        const widthSizeAfterFirst = caches.widths.size;
        const styledLinesSizeAfterFirst = caches.styledLines.size;

        const output2 = new Output({
            caches,
            height: 1,
            width: 8,
        });

        output2.write(0, 0, "abc", { transformers: [] });
        output2.get();

        expect(caches.widths.size).toBe(widthSizeAfterFirst);
        expect(caches.styledLines.size).toBe(styledLinesSizeAfterFirst);
    });

    it("reset clears frame operations before next render", () => {
        expect.assertions(3);

        const output = new Output({
            height: 1,
            width: 8,
        });

        output.write(0, 0, "before", { transformers: [] });

        expect(output.get().output).toContain("before");

        output.reset(8, 1);
        output.write(0, 0, "after", { transformers: [] });
        const next = output.get().output;

        expect(next).toContain("after");
        expect(next).not.toContain("before");
    });

    it("getStyledLine returns a StyledLine for plain text", () => {
        expect.assertions(2);

        const caches = new OutputCaches();
        const line = caches.getStyledLine("Hello");

        expect(line).toHaveLength(5);
        expect(line.getText()).toBe("Hello");
    });

    it("getStyledLine returns a StyledLine for ANSI text", () => {
        expect.assertions(2);

        const caches = new OutputCaches();
        const line = caches.getStyledLine("\u001B[31mA\u001B[39m");

        expect(line).toHaveLength(1);
        expect(line.getText()).toBe("A");
    });

    it("getStyledLine caches results", () => {
        expect.assertions(1);

        const caches = new OutputCaches();
        const first = caches.getStyledLine("abc");
        const second = caches.getStyledLine("abc");

        expect(first).toBe(second);
    });

    it("styled rendering preserves ANSI transitions", () => {
        expect.assertions(1);

        const output = new Output({
            height: 1,
            width: 4,
        });

        output.write(0, 0, "\u001B[31mA\u001B[32mB\u001B[39m", { transformers: [] });

        expect(output.get().output).toBe("\u001B[31mA\u001B[32mB\u001B[39m");
    });

    it("getStyledLine marks full-width characters", () => {
        expect.assertions(2);

        const caches = new OutputCaches();
        const line = caches.getStyledLine("漢");

        expect(line).toHaveLength(1);
        expect(line.getFullWidth(0)).toBe(true);
    });

    it("outputCaches prunes width cache when maxEntries is exceeded", () => {
        expect.assertions(2);

        const caches = new OutputCaches({ maxEntries: 2 });

        caches.getStringWidth("a");
        caches.getStringWidth("b");
        caches.getStringWidth("c");

        expect(caches.widths.size).toBeLessThanOrEqual(2);
        expect(caches.widths.has("c")).toBe(true);
    });

    it("outputCaches prunes styledLines cache when maxEntries is exceeded", () => {
        expect.assertions(2);

        const caches = new OutputCaches({ maxEntries: 2 });

        caches.getStyledLine("a");
        caches.getStyledLine("b");
        caches.getStyledLine("c");

        expect(caches.styledLines.size).toBeLessThanOrEqual(2);
        expect(caches.styledLines.has("c")).toBe(true);
    });

    it("getLines caches split line arrays", () => {
        expect.assertions(2);

        const caches = new OutputCaches();

        const first = caches.getLines("a\nb");
        const second = caches.getLines("a\nb");

        expect(first).toBe(second);
        expect(second).toStrictEqual(["a", "b"]);
    });

    it("outputCaches prunes lines cache when maxEntries is exceeded", () => {
        expect.assertions(2);

        const caches = new OutputCaches({ maxEntries: 2 });

        caches.getLines("a");
        caches.getLines("b");
        caches.getLines("c");

        expect(caches.lines.size).toBeLessThanOrEqual(2);
        expect(caches.lines.has("c")).toBe(true);
    });

    it("outputCaches pruneToFactor controls eviction target", () => {
        expect.assertions(1);

        const caches = new OutputCaches({
            maxEntries: 10,
            pruneToFactor: 0.5,
        });

        for (let index = 0; index < 11; index += 1) {
            caches.getStringWidth(String(index));
        }

        expect(caches.widths.size).toBeLessThanOrEqual(6);
    });

    it("line memoization keeps unchanged rows and updates changed rows", () => {
        expect.assertions(2);

        const output = new Output({
            height: 2,
            width: 2,
        });

        output.write(0, 0, "ab\ncd", { transformers: [] });

        expect(output.get().output).toBe("ab\ncd");

        output.reset(2, 2);
        output.write(0, 0, "ab\nef", { transformers: [] });

        expect(output.get().output).toBe("ab\nef");
    });

    it("line memoization does not keep stale rows when content is cleared", () => {
        expect.assertions(2);

        const output = new Output({
            height: 2,
            width: 2,
        });

        output.write(0, 1, "zz", { transformers: [] });

        expect(output.get().output).toBe("\nzz");

        output.reset(2, 2);

        expect(output.get().output).toBe("\n");
    });

    it("startChildRegion applies horizontal and vertical bounds to writes", () => {
        expect.assertions(1);

        const output = new Output({
            height: 2,
            width: 6,
        });

        output.startChildRegion(1, 0, 4, 2);
        output.write(0, 0, "ABCDE\nFGHIJ", { transformers: [] });
        output.endChildRegion();

        expect(output.get().output).toBe(" BCDE\n GHIJ");
    });

    it("startChildRegion can apply vertical-only bounds", () => {
        expect.assertions(1);

        const output = new Output({
            height: 2,
            width: 8,
        });

        output.startChildRegion(0, 1, 8, 1);
        output.write(0, 0, "top\nbottom", { transformers: [] });
        output.endChildRegion();

        expect(output.get().output).toBe("\nbottom");
    });
});
