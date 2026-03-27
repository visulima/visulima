import { describe, expect, it } from "vitest";
import { Box, Text, render } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";
import createStdout from "../helpers/ink-create-stdout.js";

const renderWithAlignContent = (alignContent: NonNullable<React.ComponentProps<typeof Box>["alignContent"]>): string =>
    renderToString(
        <Box width={2} height={6} flexWrap="wrap" alignContent={alignContent}>
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
            <Text>D</Text>
        </Box>,
    );

for (const [alignContent, expectedOutput] of [
    ["flex-start", "AB\nCD\n\n\n\n"],
    ["center", "\n\nAB\nCD\n\n"],
    ["flex-end", "\n\n\n\nAB\nCD"],
    ["space-between", "AB\n\n\n\n\nCD"],
    ["space-around", "\nAB\n\n\nCD\n"],
    ["space-evenly", "\nAB\n\nCD\n\n"],
    ["stretch", "AB\n\n\nCD\n\n"],
] as const) {
    it(`align content ${alignContent}`, () => {
        const output = renderWithAlignContent(alignContent);
        expect(output).toBe(expectedOutput);
    });
}

it("align content defaults to flex-start", () => {
    const output = renderToString(
        <Box width={2} height={6} flexWrap="wrap">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
            <Text>D</Text>
        </Box>,
    );

    expect(output).toBe("AB\nCD\n\n\n\n");
});

it("align content does not add extra spacing when there is no free cross-axis space", () => {
    const output = renderToString(
        <Box width={2} height={2} flexWrap="wrap" alignContent="center">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
            <Text>D</Text>
        </Box>,
    );

    expect(output).toBe("AB\nCD");
});

it("clears alignContent on rerender to default flex-start", () => {
    const stdout = createStdout();

    function Test({ alignContent }: { readonly alignContent?: React.ComponentProps<typeof Box>["alignContent"] }) {
        return (
            <Box width={2} height={6} flexWrap="wrap" alignContent={alignContent}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );
    }

    const { rerender } = render(<Test alignContent="center" />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\nAB\nCD\n\n");

    rerender(<Test alignContent={undefined} />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
});

it("clears alignContent from stretch on rerender to default flex-start", () => {
    const stdout = createStdout();

    function Test({ alignContent }: { readonly alignContent?: React.ComponentProps<typeof Box>["alignContent"] }) {
        return (
            <Box width={2} height={6} flexWrap="wrap" alignContent={alignContent}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );
    }

    const { rerender } = render(<Test alignContent="stretch" />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\n\n\nCD\n\n");

    rerender(<Test alignContent={undefined} />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
});

it("clears alignContent when prop is omitted on rerender", () => {
    const stdout = createStdout();

    function Test({ showAlignContent }: { readonly showAlignContent: boolean }) {
        return (
            <Box width={2} height={6} flexWrap="wrap" {...(showAlignContent ? { alignContent: "center" as const } : {})}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );
    }

    const { rerender } = render(<Test showAlignContent />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\nAB\nCD\n\n");

    rerender(<Test showAlignContent={false} />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
});

it("align content center - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box width={2} height={6} flexWrap="wrap" alignContent="center">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
            <Text>D</Text>
        </Box>,
    );

    expect(output).toBe("\n\nAB\nCD\n\n");
});
