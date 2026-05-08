import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("position", () => {
    it("absolute position with top and left offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3} width={5}>
                <Box left={2} position="absolute" top={1}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n  X\n");
    });

    it("absolute position with bottom and right offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} width={6}>
                <Box bottom={1} position="absolute" right={1}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n    X\n");
    });

    it("absolute position with percentage offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} width={6}>
                <Box left="50%" position="absolute" top="50%">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n   X\n");
    });

    it("absolute position with percentage bottom and right offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} width={6}>
                <Box bottom="50%" position="absolute" right="50%">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n  X\n\n");
    });

    it("relative position offsets visual position while keeping flow", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={5}>
                <Box left={2} position="relative">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe(" BA");
    });

    it("static position ignores offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={5}>
                <Box left={2} position="static">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB");
    });

    it("static position ignores percentage offsets", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={5}>
                <Box left="50%" position="static">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB");
    });

    it("clears top offset on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ top }: { readonly top?: number }) => (
            <Box height={3} width={5}>
                <Box left={2} position="absolute" top={top}>
                    <Text>X</Text>
                </Box>
            </Box>
        );

        const { rerender } = render(<Test top={1} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n  X\n");

        rerender(<Test top={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("  X\n\n");
    });

    it("clears percentage top and left offsets on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ left, top }: { readonly left?: string; readonly top?: string }) => (
            <Box height={4} width={6}>
                <Box left={left} position="absolute" top={top}>
                    <Text>X</Text>
                </Box>
            </Box>
        );

        const { rerender } = render(<Test left="50%" top="50%" />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\n   X\n");

        rerender(<Test left={undefined} top={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("X\n\n\n");
    });

    it("clears percentage top and left offsets when props are omitted on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ showOffsets }: { readonly showOffsets: boolean }) => (
            <Box height={4} width={6}>
                <Box position="absolute" {...(showOffsets ? { left: "50%" as const, top: "50%" as const } : {})}>
                    <Text>X</Text>
                </Box>
            </Box>
        );

        const { rerender } = render(<Test showOffsets />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\n   X\n");

        rerender(<Test showOffsets={false} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("X\n\n\n");
    });

    it("clears bottom and right offsets on rerender", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = ({ bottom, right }: { readonly bottom?: number; readonly right?: number }) => (
            <Box height={4} width={6}>
                <Box bottom={bottom} position="absolute" right={right}>
                    <Text>X</Text>
                </Box>
            </Box>
        );

        const { rerender } = render(<Test bottom={1} right={1} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\n    X\n");

        rerender(<Test bottom={undefined} right={undefined} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("X\n\n\n");
    });

    it("absolute position with top and left offsets - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box height={3} width={5}>
                <Box left={2} position="absolute" top={1}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n  X\n");
    });
});
