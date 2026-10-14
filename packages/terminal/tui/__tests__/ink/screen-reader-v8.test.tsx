import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Static, Text, Transform } from "../../src/components/index";
import { useStderr } from "../../src/ink/hooks/use-stderr";
import { useStdout } from "../../src/ink/hooks/use-stdout";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const CURSOR_HIDE = "\u001B[?25l";
const CSI_PATTERN = new RegExp(String.raw`(${String.fromCodePoint(0x1b)}\[[0-9;?]*[a-z])`, "i");

/**
 * Replays the bytes written to a terminal into the visible lines they leave behind. Only the
 * sequences the screen-reader renderer emits are modelled: erase-line (`ESC[2K`), cursor-up
 * (`ESC[1A`), cursor-left (`ESC[G`) and newlines. Everything else (sync markers, cursor
 * visibility) is ignored.
 */
const visibleLines = (writes: string[]): string[] => {
    const lines: string[] = [""];
    let row = 0;

    for (const token of writes.join("").split(CSI_PATTERN)) {
        if (token === "\u001B[2K") {
            lines[row] = "";
        } else if (token === "\u001B[1A") {
            row = Math.max(0, row - 1);
        } else if (token.startsWith("\u001B[")) {
            // Cursor-left and synchronized-output markers do not change the visible text.
        } else {
            for (const character of token) {
                if (character === "\n") {
                    row += 1;
                    lines[row] ??= "";
                } else if (character !== "\r") {
                    lines[row] = (lines[row] ?? "") + character;
                }
            }
        }
    }

    return lines.map((line) => line.trimEnd()).filter(Boolean);
};

const contentWrites = (stdout: ReturnType<typeof createStdout>): string[] => stdout.getWrites().filter((write) => write.length > 0);

describe("screen-reader output (upstream parity)", () => {
    it("omits nested Text styling from screen-reader output", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                Status:
{" "}
<Text color="green">Ready</Text>
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Status: Ready");
    });

    it("preserves nested Transform accessibility labels for screen readers", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                Status:
{" "}
                <Transform accessibilityLabel="Ready" transform={(text) => "*".repeat(text.length)}>
                    <Text>ready</Text>
                </Transform>
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Status: Ready");
        expect(renderToString(element)).toBe("Status: *****");
    });

    it("honors empty Transform accessibility labels for screen readers", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                <Transform accessibilityLabel="" transform={(text) => text.toUpperCase()}>
                    <Text>decorative</Text>
                </Transform>
                Ready
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Ready");
        expect(renderToString(element)).toBe("DECORATIVEReady");
    });

    it("renders an accessibilityLabel-only Transform for screen readers", () => {
        expect.hasAssertions();

        const element = <Transform accessibilityLabel="Screen-reader only" transform={(text) => text.toUpperCase()} />;

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Screen-reader only");
        expect(renderToString(element)).toBe("");
    });

    it("renders nested multi-line text", () => {
        expect.hasAssertions();

        const element = (
            <Box flexDirection="row">
                <Box flexDirection="column">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Box>
            </Box>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Line 1\nLine 2");
    });

    it("renders a nested row inline", () => {
        expect.hasAssertions();

        const element = (
            <Box flexDirection="column">
                <Box flexDirection="row">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Box>
            </Box>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Line 1 Line 2");
    });

    it("clears screen-reader output", () => {
        expect.hasAssertions();

        const stdout = createStdout(10, true);
        const instance = render(<Text>{"First line\nSecond line"}</Text>, {
            interactive: true,
            isScreenReaderEnabled: true,
            patchConsole: false,
            stdout,
        });

        expect(visibleLines(stdout.getWrites())).toEqual(["First line", "Second", "line"]);

        instance.clear();

        expect(visibleLines(stdout.getWrites())).toEqual([]);

        instance.unmount();
    });

    it("restores screen-reader output after stdout writes without touching the cursor", async () => {
        expect.hasAssertions();

        const stdout = createStdout(40, true);
        let write: (text: string) => void = () => {};

        const Test = () => {
            ({ write } = useStdout());

            return <Text>Hello</Text>;
        };

        const instance = render(<Test />, { interactive: true, isScreenReaderEnabled: true, patchConsole: false, stdout });

        await instance.waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        write("External\n");

        const afterExternal = stdout.getWrites().slice(before).join("");

        expect(afterExternal).not.toContain(CURSOR_HIDE);
        expect(visibleLines(stdout.getWrites())).toEqual(["External", "Hello"]);

        instance.unmount();
    });

    it("restores screen-reader output after stderr writes without touching the cursor", async () => {
        expect.hasAssertions();

        const stdout = createStdout(40, true);
        const stderr = createStdout(40, true);
        let write: (text: string) => void = () => {};

        const Test = () => {
            ({ write } = useStderr());

            return <Text>Hello</Text>;
        };

        const instance = render(<Test />, { interactive: true, isScreenReaderEnabled: true, patchConsole: false, stderr, stdout });

        await instance.waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        write("External\n");

        expect(contentWrites(stderr)).toEqual(["External\n"]);
        expect(stdout.getWrites().slice(before).join("")).not.toContain(CURSOR_HIDE);
        expect(visibleLines(stdout.getWrites())).toEqual(["Hello"]);

        instance.unmount();
    });

    it("restores screen-reader output after console.log without touching the cursor", async () => {
        expect.hasAssertions();

        const stdout = createStdout(40, true);
        const instance = render(<Text>Hello</Text>, { interactive: true, isScreenReaderEnabled: true, stdout });

        await instance.waitUntilRenderFlush();

        // eslint-disable-next-line no-console -- console patching is what this test exercises
        console.log("External");

        expect(stdout.getWrites().join("")).not.toContain(`${CURSOR_HIDE}Hello${CURSOR_HIDE}`);
        expect(visibleLines(stdout.getWrites())).toEqual(["External", "Hello"]);

        instance.unmount();
    });

    it("keeps static history when screen-reader output resizes", async () => {
        expect.hasAssertions();

        const stdout = createStdout(20, true);
        const instance = render(
            <>
                <Static items={["History"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>{"First line\nSecond line"}</Text>
            </>,
            { interactive: true, isScreenReaderEnabled: true, patchConsole: false, stdout },
        );

        await instance.waitUntilRenderFlush();

        stdout.columns = 10;
        stdout.emit("resize");
        await instance.waitUntilRenderFlush();

        expect(visibleLines(stdout.getWrites())).toEqual(["History", "First line", "Second", "line"]);

        instance.unmount();
    });

    it("rewraps screen-reader output when the terminal gets wider", async () => {
        expect.hasAssertions();

        const stdout = createStdout(10, true);
        const instance = render(<Text>Hello world</Text>, { interactive: true, isScreenReaderEnabled: true, patchConsole: false, stdout });

        await instance.waitUntilRenderFlush();

        expect(visibleLines(stdout.getWrites())).toEqual(["Hello", "world"]);

        stdout.columns = 20;
        stdout.emit("resize");
        await instance.waitUntilRenderFlush();

        expect(visibleLines(stdout.getWrites())).toEqual(["Hello world"]);

        instance.unmount();
    });

    it("re-renders changing screen-reader content after static output", async () => {
        expect.hasAssertions();

        const stdout = createStdout(40, true);
        let setState: (value: { items: string[]; live: string }) => void = () => {};

        const App = () => {
            const [state, setter] = useState({ items: ["A"], live: "Live 1" });

            setState = setter;

            return (
                <>
                    <Static items={state.items}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
                    <Text>{state.live}</Text>
                </>
            );
        };

        const instance = render(<App />, { interactive: true, isScreenReaderEnabled: true, patchConsole: false, stdout });

        await instance.waitUntilRenderFlush();

        setState({ items: ["A", "B"], live: "Live 2" });
        await instance.waitUntilRenderFlush();

        expect(visibleLines(stdout.getWrites())).toEqual(["A", "B", "Live 2"]);

        instance.unmount();
    });
});
