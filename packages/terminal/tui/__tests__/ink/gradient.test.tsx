import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { Box, Gradient, Text } from "../../src/components/index";
import { renderToString } from "../../src/ink/index";

describe("gradient", () => {
    // ── Prop validation ────────────────────────────────────

    it("throws when neither `name` nor `colors` is provided", () => {
        expect.assertions(1);

        expect(() => renderToString(<Gradient />)).toThrow("Either `name` or `colors` prop must be provided");
    });

    it("throws when both `name` and `colors` are provided", () => {
        expect.assertions(1);

        expect(() =>
            renderToString(
                <Gradient colors={["#ff0000", "#0000ff"]} name="rainbow">
                    Hello
                </Gradient>,
            ),
        ).toThrow("The `name` and `colors` props are mutually exclusive");
    });

    // ── Named gradients ────────────────────────────────────

    it("renders with `rainbow` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="rainbow">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `cristal` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="cristal">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `pastel` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="pastel">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `morning` preset (hsv interpolation)", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="morning">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `vice` preset (hsv interpolation)", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="vice">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `retro` preset (many color stops)", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="retro">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `teen` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="teen">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `mind` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="mind">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `passion` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="passion">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `fruit` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="fruit">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `instagram` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="instagram">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `atlas` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="atlas">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    it("renders with `summer` preset", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="summer">Hello World</Gradient>);

        expect(stripAnsi(output)).toBe("Hello World");
        expect(output).not.toBe("Hello World");
    });

    // ── Custom colors ──────────────────────────────────────

    it("renders with custom hex colors", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient colors={["#ff0000", "#00ff00", "#0000ff"]}>Custom gradient</Gradient>);

        expect(stripAnsi(output)).toBe("Custom gradient");
        expect(output).not.toBe("Custom gradient");
    });

    it("renders with two custom colors", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient colors={["#000000", "#ffffff"]}>Mono</Gradient>);

        expect(stripAnsi(output)).toBe("Mono");
        expect(output).not.toBe("Mono");
    });

    // ── Text component children ────────────────────────────

    it("renders gradient on a single <Text> child", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Text>Hello</Text>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Hello");
        expect(output).not.toBe("Hello");
    });

    it("renders gradient on a <Text> child with bold", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Text bold>Bold gradient</Text>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Bold gradient");
        expect(output).not.toBe("Bold gradient");
    });

    // ── Box children ───────────────────────────────────────

    it("renders gradient on <Text> inside a <Box>", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    <Text>Inside box</Text>
                </Box>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Inside box");
        expect(output).not.toBe("Inside box");
    });

    it("renders gradient on multiple <Text> children inside a <Box>", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box flexDirection="column">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Box>
            </Gradient>,
        );

        const stripped = stripAnsi(output);

        expect(stripped).toContain("Line 1");
        expect(stripped).toContain("Line 2");
    });

    it("renders gradient with empty <Box>", () => {
        expect.assertions(1);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box />
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("");
    });

    it("renders gradient on nested <Box> elements", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    <Box>
                        <Text>Nested</Text>
                    </Box>
                </Box>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Nested");
        expect(output).not.toBe("Nested");
    });

    // ── Falsy and edge-case children ───────────────────────

    it("handles null children inside gradient", () => {
        expect.assertions(1);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    {null}
                    <Text>Visible</Text>
                </Box>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Visible");
    });

    it("handles undefined children inside gradient", () => {
        expect.assertions(1);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    {undefined}
                    <Text>Visible</Text>
                </Box>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Visible");
    });

    it("handles boolean children inside gradient", () => {
        expect.assertions(1);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    {false}
                    <Text>Visible</Text>
                </Box>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Visible");
    });

    // ── Nested components ──────────────────────────────────

    it("renders gradient on nested custom component without Box", () => {
        expect.assertions(2);

        const Label = ({ children }: { readonly children: string }) => <Text>{children}</Text>;

        const output = renderToString(
            <Gradient name="rainbow">
                <Label>Nested</Label>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Nested");
        expect(output).not.toBe("Nested");
    });

    // ── Gradient continuity ────────────────────────────────

    it("applies gradient to mixed text and <Text> children inside a <Box>", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Box>
                    {"Hello "}
                    <Text>World</Text>
                </Box>
            </Gradient>,
        );

        const stripped = stripAnsi(output);

        expect(stripped).toContain("Hello");
        expect(stripped).toContain("World");
    });

    it("preserves layout in column direction with multiple Text children", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box flexDirection="column">
                <Gradient name="rainbow">
                    <Box flexDirection="column">
                        <Text>First</Text>
                        <Text>Second</Text>
                        <Text>Third</Text>
                    </Box>
                </Gradient>
            </Box>,
        );

        const stripped = stripAnsi(output);

        expect(stripped).toContain("First");
        expect(stripped).toContain("Second");
        expect(stripped).toContain("Third");
    });

    // ── ANSI stripping ─────────────────────────────────────

    it("strips existing ANSI codes before applying gradient", () => {
        expect.assertions(2);

        const output = renderToString(
            <Gradient name="rainbow">
                <Text color="red">Already colored</Text>
            </Gradient>,
        );

        expect(stripAnsi(output)).toBe("Already colored");
        expect(output).not.toBe("Already colored");
    });

    // ── Number children ────────────────────────────────────

    it("renders gradient on numeric children", () => {
        expect.assertions(2);

        const output = renderToString(<Gradient name="rainbow">{12_345}</Gradient>);

        expect(stripAnsi(output)).toBe("12345");
        expect(output).not.toBe("12345");
    });

    // ── Color verification ──────────────────────────────────

    it("custom colors gradient contains expected RGB escape sequences", () => {
        expect.assertions(3);

        const output = renderToString(<Gradient colors={["#ff0000", "#0000ff"]}>Hello World</Gradient>);

        // First character should use the start color (red: rgb 255,0,0)
        expect(output).toContain("[38;2;255;0;0m");
        // Should contain intermediate gradient colors (not plain text)
        expect(output).toMatch(/\[38;2;\d+;0;\d+m/u);
        // Text is preserved
        expect(stripAnsi(output)).toBe("Hello World");
    });

    // ── Different gradients produce different output ───────

    it("different presets produce different colored output for same text", () => {
        expect.assertions(1);

        const rainbowOutput = renderToString(<Gradient name="rainbow">Same text</Gradient>);
        const cristalOutput = renderToString(<Gradient name="cristal">Same text</Gradient>);

        expect(rainbowOutput).not.toBe(cristalOutput);
    });

    it("different custom colors produce different colored output", () => {
        expect.assertions(1);

        const output1 = renderToString(<Gradient colors={["#ff0000", "#0000ff"]}>Same text</Gradient>);
        const output2 = renderToString(<Gradient colors={["#00ff00", "#ff00ff"]}>Same text</Gradient>);

        expect(output1).not.toBe(output2);
    });
});
