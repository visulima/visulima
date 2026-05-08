import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("width-height", () => {
    it("set width", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box width={5}>
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A    B");
    });

    it("set width in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={10}>
                <Box width="50%">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A    B");
    });

    it("set min width", () => {
        expect.assertions(2);

        const smallerOutput = renderToString(
            <Box>
                <Box minWidth={5}>
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(smallerOutput).toBe("A    B");

        const largerOutput = renderToString(
            <Box>
                <Box minWidth={2}>
                    <Text>AAAAA</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(largerOutput).toBe("AAAAAB");
    });

    it.fails("set min width in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={10}>
                <Box minWidth="50%">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A    B");
    });

    it("set height", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB\n\n\n");
    });

    it("set height in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Box height="50%">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB\n\n");
    });

    it("cut text over the set height", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={2}>
                <Text>AAAABBBBCCCC</Text>
            </Box>,
            { columns: 4 },
        );

        expect(output).toBe("AAAA\nBBBB");
    });

    it("set min height", () => {
        expect.assertions(2);

        const smallerOutput = renderToString(
            <Box minHeight={4}>
                <Text>A</Text>
            </Box>,
        );

        expect(smallerOutput).toBe("A\n\n\n");

        const largerOutput = renderToString(
            <Box minHeight={2}>
                <Box height={4}>
                    <Text>A</Text>
                </Box>
            </Box>,
        );

        expect(largerOutput).toBe("A\n\n\n");
    });

    it("set min height in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Box minHeight="50%">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB\n\n");
    });

    it("set max width", () => {
        expect.assertions(2);

        const constrainedOutput = renderToString(
            <Box>
                <Box maxWidth={3}>
                    <Text>AAAAA</Text>
                </Box>
                <Text>B</Text>
            </Box>,
            { columns: 10 },
        );

        expect(constrainedOutput).toBe("AAAB\nAA");

        const unconstrainedOutput = renderToString(
            <Box>
                <Box maxWidth={10}>
                    <Text>AAA</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(unconstrainedOutput).toBe("AAAB");
    });

    it("clears maxWidth on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ maxWidth }: { readonly maxWidth?: number }) => (
            <Box>
                <Box maxWidth={maxWidth}>
                    <Text>AAAAA</Text>
                </Box>
                <Text>B</Text>
            </Box>
        );

        const { rerender } = render(<Test maxWidth={3} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AAAB\nAA");

        rerender(<Test maxWidth={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("AAAAAB");
    });

    it("set max height", () => {
        expect.assertions(2);

        const constrainedOutput = renderToString(
            <Box maxHeight={2}>
                <Box height={4}>
                    <Text>A</Text>
                </Box>
            </Box>,
        );

        expect(constrainedOutput).toBe("A\n");

        const unconstrainedOutput = renderToString(
            <Box maxHeight={4}>
                <Text>A</Text>
            </Box>,
        );

        expect(unconstrainedOutput).toBe("A");
    });

    it("clears maxHeight on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ maxHeight }: { readonly maxHeight?: number }) => (
            <Box maxHeight={maxHeight}>
                <Box height={4}>
                    <Text>A</Text>
                </Box>
            </Box>
        );

        const { rerender } = render(<Test maxHeight={2} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("A\n");

        rerender(<Test maxHeight={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("A\n\n\n");
    });

    it("set aspect ratio with width", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Box aspectRatio={2} borderStyle="single" width={8}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("┌──────┐\n│X     │\n│      │\n└──────┘\nY");
    });

    it("set aspect ratio with height", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Box aspectRatio={2} borderStyle="single" height={3}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("┌────┐\n│X   │\n└────┘\nY");
    });

    it("set aspect ratio with width and height", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Box aspectRatio={2} borderStyle="single" height={3} width={8}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("┌────┐\n│X   │\n└────┘\nY");
    });

    it("set aspect ratio with maxHeight constraint", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Box aspectRatio={2} borderStyle="single" maxHeight={3} width={10}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("┌────┐\n│X   │\n└────┘\nY");
    });

    it("clears aspectRatio on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ aspectRatio }: { readonly aspectRatio?: number }) => (
            <Box flexDirection="column">
                <Box aspectRatio={aspectRatio} borderStyle="single" width={8}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>
        );

        const { rerender } = render(<Test aspectRatio={2} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("┌──────┐\n│X     │\n│      │\n└──────┘\nY");

        rerender(<Test aspectRatio={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("┌──────┐\n│X     │\n└──────┘\nY");
    });

    it.fails("set max width in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={10}>
                <Box maxWidth="50%">
                    <Text>AAAAAAAAAA</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AAAAAB");
    });

    it("set max height in percent", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Box maxHeight="50%">
                    <Box height={6}>
                        <Text>A</Text>
                    </Box>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB\n\n");
    });

    it("set width - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box>
                <Box width={5}>
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A    B");
    });

    it("set height - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box height={4}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB\n\n\n");
    });
});
