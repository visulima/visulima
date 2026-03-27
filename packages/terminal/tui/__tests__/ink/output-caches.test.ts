import { describe, expect, it } from "vitest";
import Output, { OutputCaches } from "../../src/ink/output.js";

it("Output uses provided caches instance", () => {
    const caches = new OutputCaches();
    const output = new Output({
        width: 8,
        height: 1,
        caches,
    });

    output.write(0, 0, "abc", { transformers: [] });
    output.get();

    expect((output as unknown as { caches: OutputCaches }).caches).toBe(caches);
    expect(caches.styledChars.size).toBeGreaterThan(0);
});

it("default caches are isolated per Output instance", () => {
    const output1 = new Output({
        width: 8,
        height: 1,
    });
    const output2 = new Output({
        width: 8,
        height: 1,
    });

    const output1WithCaches = output1 as unknown as { caches: OutputCaches };
    const output2WithCaches = output2 as unknown as { caches: OutputCaches };

    expect(output1WithCaches.caches).not.toBe(output2WithCaches.caches);
});

it("shared caches reuse entries across Output instances", () => {
    const caches = new OutputCaches();

    const output1 = new Output({
        width: 8,
        height: 1,
        caches,
    });
    output1.write(0, 0, "abc", { transformers: [] });
    output1.get();

    const widthSizeAfterFirst = caches.widths.size;
    const styledCharsSizeAfterFirst = caches.styledChars.size;

    const output2 = new Output({
        width: 8,
        height: 1,
        caches,
    });
    output2.write(0, 0, "abc", { transformers: [] });
    output2.get();

    expect(caches.widths.size).toBe(widthSizeAfterFirst);
    expect(caches.styledChars.size).toBe(styledCharsSizeAfterFirst);
});

it("reset clears frame operations before next render", () => {
    const output = new Output({
        width: 8,
        height: 1,
    });

    output.write(0, 0, "before", { transformers: [] });
    expect(output.get().output.includes("before")).toBe(true);

    output.reset(8, 1);
    output.write(0, 0, "after", { transformers: [] });
    const next = output.get().output;

    expect(next.includes("after")).toBe(true);
    expect(next.includes("before")).toBe(false);
});

it("getCharacterWidth fast-path avoids cache writes for printable ASCII and full-width chars", () => {
    const caches = new OutputCaches();

    const asciiWidth = caches.getCharacterWidth({
        type: "char",
        value: "A",
        fullWidth: false,
        styles: [],
    });
    const cjkWidth = caches.getCharacterWidth({
        type: "char",
        value: "漢",
        fullWidth: true,
        styles: [],
    });

    expect(asciiWidth).toBe(1);
    expect(cjkWidth).toBe(2);
    expect(caches.widths.has("A")).toBe(false);
    expect(caches.widths.has("漢")).toBe(false);
});

it("getCharacterWidth falls back to string-width for non-ASCII narrow chars", () => {
    const caches = new OutputCaches();

    const width = caches.getCharacterWidth({
        type: "char",
        value: "é",
        fullWidth: false,
        styles: [],
    });

    expect(width).toBe(1);
    expect(caches.widths.has("é")).toBe(true);
});

it("plain ASCII lines reuse StyledChar instances", () => {
    const caches = new OutputCaches();

    const single = caches.getStyledChars("a");
    const repeated = caches.getStyledChars("aa");

    expect(single[0]).toBe(repeated[0]);
});

it("ANSI-marked lines preserve styles", () => {
    const caches = new OutputCaches();
    const styledChars = caches.getStyledChars("\u001B[31mA\u001B[39m");

    expect(styledChars.length).toBe(1);
    expect(styledChars[0]!.styles.length).toBeGreaterThan(0);
});

it("ANSI style runs reuse style array references", () => {
    const caches = new OutputCaches();
    const styledChars = caches.getStyledChars("\u001B[31mAB\u001B[39m");

    expect(styledChars.length).toBe(2);
    expect(styledChars[0]!.styles).toBe(styledChars[1]!.styles);
});

it("styled rendering preserves ANSI transitions", () => {
    const output = new Output({
        width: 4,
        height: 1,
    });

    output.write(0, 0, "\u001B[31mA\u001B[32mB\u001B[39m", { transformers: [] });
    expect(output.get().output).toBe("\u001B[31mA\u001B[32mB\u001B[39m");
});

it("plain non-ASCII lines include full-width metadata", () => {
    const caches = new OutputCaches();
    const styledChars = caches.getStyledChars("漢");

    expect(styledChars.length).toBe(1);
    expect(styledChars[0]!.fullWidth).toBe(true);
});

it("OutputCaches prunes width cache when maxEntries is exceeded", () => {
    const caches = new OutputCaches({ maxEntries: 2 });

    caches.getStringWidth("a");
    caches.getStringWidth("b");
    caches.getStringWidth("c");

    expect(caches.widths.size).toBeLessThanOrEqual(2);
    expect(caches.widths.has("c")).toBe(true);
});

it("OutputCaches prunes styledChars cache when maxEntries is exceeded", () => {
    const caches = new OutputCaches({ maxEntries: 2 });

    caches.getStyledChars("a");
    caches.getStyledChars("b");
    caches.getStyledChars("c");

    expect(caches.styledChars.size).toBeLessThanOrEqual(2);
    expect(caches.styledChars.has("c")).toBe(true);
});

it("getLines caches split line arrays", () => {
    const caches = new OutputCaches();

    const first = caches.getLines("a\nb");
    const second = caches.getLines("a\nb");

    expect(first).toBe(second);
    expect(second).toEqual(["a", "b"]);
});

it("OutputCaches prunes lines cache when maxEntries is exceeded", () => {
    const caches = new OutputCaches({ maxEntries: 2 });

    caches.getLines("a");
    caches.getLines("b");
    caches.getLines("c");

    expect(caches.lines.size).toBeLessThanOrEqual(2);
    expect(caches.lines.has("c")).toBe(true);
});

it("OutputCaches pruneToFactor controls eviction target", () => {
    const caches = new OutputCaches({
        maxEntries: 10,
        pruneToFactor: 0.5,
    });

    for (let index = 0; index < 11; index++) {
        caches.getStringWidth(String(index));
    }

    expect(caches.widths.size).toBeLessThanOrEqual(6);
});

it("line memoization keeps unchanged rows and updates changed rows", () => {
    const output = new Output({
        width: 2,
        height: 2,
    });

    output.write(0, 0, "ab\ncd", { transformers: [] });
    expect(output.get().output).toBe("ab\ncd");

    output.reset(2, 2);
    output.write(0, 0, "ab\nef", { transformers: [] });
    expect(output.get().output).toBe("ab\nef");
});

it("line memoization does not keep stale rows when content is cleared", () => {
    const output = new Output({
        width: 2,
        height: 2,
    });

    output.write(0, 1, "zz", { transformers: [] });
    expect(output.get().output).toBe("\nzz");

    output.reset(2, 2);
    expect(output.get().output).toBe("\n");
});

it("clip applies horizontal and vertical bounds to writes", () => {
    const output = new Output({
        width: 6,
        height: 2,
    });

    output.clip({ x1: 1, x2: 5, y1: 0, y2: 2 });
    output.write(0, 0, "ABCDE\nFGHIJ", { transformers: [] });
    output.unclip();

    expect(output.get().output).toBe(" BCDE\n GHIJ");
});

it("clip can apply vertical-only bounds", () => {
    const output = new Output({
        width: 8,
        height: 2,
    });

    output.clip({ x1: undefined, x2: undefined, y1: 1, y2: 2 });
    output.write(0, 0, "top\nbottom", { transformers: [] });
    output.unclip();

    expect(output.get().output).toBe("\nbottom");
});
