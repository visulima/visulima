import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

const renderWithAlignContent = (alignContent: NonNullable<React.ComponentProps<typeof Box>["alignContent"]>): string =>
    renderToString(
        <Box alignContent={alignContent} flexWrap="wrap" height={6} width={2}>
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
            <Text>D</Text>
        </Box>,
    );

describe("flex-align-content", () => {
    it.each([
        ["flex-start", "AB\nCD\n\n\n\n"],
        ["center", "\n\nAB\nCD\n\n"],
        ["flex-end", "\n\n\n\nAB\nCD"],
        ["space-between", "AB\n\n\n\n\nCD"],
        ["space-around", "\nAB\n\n\nCD\n"],
        ["space-evenly", "\nAB\n\nCD\n\n"],
        ["stretch", "AB\n\n\nCD\n\n"],
    ] as const)("align content %s", (alignContent, expectedOutput) => {
        expect.assertions(1);

        const output = renderWithAlignContent(alignContent);

        expect(output).toBe(expectedOutput);
    });

    it("align content defaults to flex-start", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexWrap="wrap" height={6} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>,
        );

        expect(output).toBe("AB\nCD\n\n\n\n");
    });

    it("align content does not add extra spacing when there is no free cross-axis space", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignContent="center" flexWrap="wrap" height={2} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>,
        );

        expect(output).toBe("AB\nCD");
    });

    it("clears alignContent on rerender to default flex-start", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ alignContent }: { readonly alignContent?: React.ComponentProps<typeof Box>["alignContent"] }) => (
            <Box alignContent={alignContent} flexWrap="wrap" height={6} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );

        const { rerender } = render(<Test alignContent="center" />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\nAB\nCD\n\n");

        rerender(<Test alignContent={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
    });

    it("clears alignContent from stretch on rerender to default flex-start", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ alignContent }: { readonly alignContent?: React.ComponentProps<typeof Box>["alignContent"] }) => (
            <Box alignContent={alignContent} flexWrap="wrap" height={6} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );

        const { rerender } = render(<Test alignContent="stretch" />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\n\n\nCD\n\n");

        rerender(<Test alignContent={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
    });

    it("clears alignContent when prop is omitted on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ showAlignContent }: { readonly showAlignContent: boolean }) => (
            <Box flexWrap="wrap" height={6} width={2} {...(showAlignContent ? { alignContent: "center" as const } : {})}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>
        );

        const { rerender } = render(<Test showAlignContent />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\nAB\nCD\n\n");

        rerender(<Test showAlignContent={false} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AB\nCD\n\n\n\n");
    });

    it("align content center - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box alignContent="center" flexWrap="wrap" height={6} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
                <Text>D</Text>
            </Box>,
        );

        expect(output).toBe("\n\nAB\nCD\n\n");
    });
});
