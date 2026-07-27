import { strip } from "@visulima/ansi";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { describe, expect, it } from "vitest";

import { Dialog } from "../../src/index";
import { renderToString } from "../helpers/ink-render";

describe(Dialog, () => {
    it("should render nothing when visible is false", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog columns={80} rows={24} visible={false}>
                    <Text>Hidden content</Text>
                </Dialog>
            </Box>,
        );

        expect(output).not.toContain("Hidden content");
    });

    it("should render children content when visible", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} rows={24}>
                    <Text>Dialog body</Text>
                </Dialog>
            </Box>,
        );

        expect(strip(output)).toContain("Dialog body");
    });

    it("should render a string title", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} rows={24} title="My Title">
                    <Text>Content</Text>
                </Dialog>
            </Box>,
        );

        expect(strip(output)).toContain("My Title");
    });

    it("should render a custom ReactNode title", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} rows={24} title={<Text color="red">Custom</Text>}>
                    <Text>Content</Text>
                </Dialog>
            </Box>,
        );

        expect(strip(output)).toContain("Custom");
    });

    it("should render footer content", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} footer={<Text>Press Esc</Text>} rows={24}>
                    <Text>Content</Text>
                </Dialog>
            </Box>,
        );

        expect(strip(output)).toContain("Press Esc");
    });

    it("should use round border style by default", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} rows={24}>
                    <Text>Content</Text>
                </Dialog>
            </Box>,
        );

        // Round border corner ╭
        expect(output).toContain("\u256D");
    });

    it("should support custom border style", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" borderStyle="double" columns={80} rows={24}>
                    <Text>Content</Text>
                </Dialog>
            </Box>,
        );

        // Double border corner ╔
        expect(output).toContain("\u2554");
    });

    it("should render with all props combined", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog
                    backgroundColor="black"
                    borderColor="green"
                    borderStyle="single"
                    columns={80}
                    footer={<Text dimColor>Footer hint</Text>}
                    paddingX={1}
                    paddingY={0}
                    rows={24}
                    title="Settings"
                    width={50}
                >
                    <Text>Option 1</Text>
                    <Text>Option 2</Text>
                </Dialog>
            </Box>,
        );

        const stripped = strip(output);

        expect(stripped).toContain("Settings");
        expect(stripped).toContain("Option 1");
        expect(stripped).toContain("Option 2");
        expect(stripped).toContain("Footer hint");
    });

    it("should default visible to true", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={24} width={80}>
                <Dialog backgroundColor="black" columns={80} rows={24}>
                    <Text>Visible by default</Text>
                </Dialog>
            </Box>,
        );

        expect(strip(output)).toContain("Visible by default");
    });
});
