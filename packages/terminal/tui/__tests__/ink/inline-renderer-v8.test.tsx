/* eslint-disable no-param-reassign, no-control-regex, sonarjs/no-control-regex, regexp/no-unused-capturing-group, regexp/no-obscure-range -- the VT model mutates its screen and parses control bytes by design */
import delay from "delay";
import type { ReactNode } from "react";
import { memo, startTransition, Suspense, useEffect } from "react";
import { describe, expect, it } from "vitest";

import { Box, Cursor, Static, Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { render } from "../../src/ink/index";
import logUpdate from "../../src/ink/log-update";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

/**
 * A minimal VT screen model. It replays the bytes the renderer wrote, so the
 * tests assert what the user would actually see instead of the exact escape
 * sequences. Only the sequences the inline renderer emits are modelled.
 */
type Screen = {
    cols: number;
    cursorX: number;
    cursorY: number;
    height: number;
    rows: string[][];
    scrollback: string[];
    scrollbackCleared: boolean;
};

const createScreen = (cols: number, height: number): Screen => {
    return {
        cols,
        cursorX: 0,
        cursorY: 0,
        height,
        rows: Array.from({ length: height }, () => Array.from({ length: cols }).fill(" ")),
        scrollback: [],
        scrollbackCleared: false,
    };
};

const scrollUp = (screen: Screen): void => {
    screen.scrollback.push(screen.rows[0]!.join("").trimEnd());
    screen.rows.shift();
    screen.rows.push(Array.from({ length: screen.cols }).fill(" "));
};

const lineFeed = (screen: Screen): void => {
    if (screen.cursorY === screen.height - 1) {
        scrollUp(screen);
    } else {
        screen.cursorY += 1;
    }
};

const eraseRow = (screen: Screen, row: number, from: number, to: number): void => {
    for (let column = from; column < to && column < screen.cols; column += 1) {
        screen.rows[row]![column] = " ";
    }
};

const feed = (screen: Screen, data: string): void => {
    const pattern = /\u001B\[([\d;?]*)([ -/]*)([@-~])|\u001B[@-_]|([\s\S])/gu;

    for (const match of data.matchAll(pattern)) {
        const [, rawParams = "", , final, char] = match;

        if (char !== undefined) {
            if (char === "\n") {
                screen.cursorX = 0;
                lineFeed(screen);
            } else if (char === "\r") {
                screen.cursorX = 0;
            } else {
                if (screen.cursorX >= screen.cols) {
                    screen.cursorX = 0;
                    lineFeed(screen);
                }

                screen.rows[screen.cursorY]![screen.cursorX] = char;
                screen.cursorX += 1;
            }

            continue;
        }

        if (final === undefined) {
            continue;
        }

        const params = rawParams.replace(/^\?/u, "");
        const count = Number.parseInt(params, 10) || 1;

        switch (final) {
            case "A": {
                screen.cursorY = Math.max(0, screen.cursorY - count);
                break;
            }
            case "B": {
                screen.cursorY = Math.min(screen.height - 1, screen.cursorY + count);
                break;
            }
            case "E": {
                screen.cursorY = Math.min(screen.height - 1, screen.cursorY + count);
                screen.cursorX = 0;
                break;
            }
            case "G": {
                screen.cursorX = Math.min(screen.cols - 1, count - 1);
                break;
            }
            case "H": {
                screen.cursorX = 0;
                screen.cursorY = 0;
                break;
            }
            case "J": {
                switch (params) {
                    case "":
                    case "0": {
                        eraseRow(screen, screen.cursorY, screen.cursorX, screen.cols);

                        for (let row = screen.cursorY + 1; row < screen.height; row += 1) {
                            eraseRow(screen, row, 0, screen.cols);
                        }

                        break;
                    }
                    case "2": {
                        for (let row = 0; row < screen.height; row += 1) {
                            eraseRow(screen, row, 0, screen.cols);
                        }

                        break;
                    }
                    case "3": {
                        screen.scrollbackCleared = true;
                        screen.scrollback = [];

                        break;
                    }
                // No default
                }

                break;
            }
            case "K": {
                if (params === "2") {
                    eraseRow(screen, screen.cursorY, 0, screen.cols);
                } else if (params === "1") {
                    eraseRow(screen, screen.cursorY, 0, screen.cursorX + 1);
                } else {
                    eraseRow(screen, screen.cursorY, screen.cursorX, screen.cols);
                }

                break;
            }
            default:
                // SGR, cursor visibility, cursor shape and synchronized output do not move text.
        }
    }
};

const visibleRows = (screen: Screen): string[] => screen.rows.map((row) => row.join("").trimEnd());

const replay = (writes: string[], rows = 12, cols = 40): Screen => {
    const screen = createScreen(cols, rows);

    feed(screen, writes.join(""));

    return screen;
};

const trimTrailingBlankRows = (lines: string[]): string[] => {
    const result = [...lines];

    while (result.length > 0 && result.at(-1) === "") {
        result.pop();
    }

    return result;
};

const SENTINEL = "$ prompt\n";

/** Replays what the renderer wrote after some shell output that is already on screen. */
const replayAfterPrompt = (writes: string[], rows: number, cols = 40): Screen => replay([SENTINEL, ...writes], rows, cols);

const renderIncremental = (frames: string[], rows = 12) => {
    const stdout = createStdout(40, true, rows);
    const render = logUpdate.create(stdout, { incremental: true, showCursor: true });

    for (const frame of frames) {
        render(frame);
    }

    return replayAfterPrompt(stdout.getWrites(), rows);
};

describe("inline renderer (incremental log-update) renders the screen it claims", () => {
    it("updates a single changed line in place", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nX\nC\n"]);

        expect(visibleRows(screen).slice(0, 4)).toEqual(["$ prompt", "A", "X", "C"]);
    });

    it("updates the first line when only it changed", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "X\nB\nC\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "X", "B", "C", ""]);
    });

    it("updates the last line when only it changed", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nB\nZ\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "B", "Z", ""]);
    });

    it("renders every changed row when all rows change", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "X\nY\nZ\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "X", "Y", "Z", ""]);
    });

    it("renders a new blank row inserted between existing rows", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\n", "A\n\nB\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "B", ""]);
    });

    it("renders new blank rows appended at the end", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\n", "A\n\n\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "", ""]);
        expect(screen.cursorY).toBe(4);
    });

    it("clears rows left behind when the output shrinks", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\nB\nC\n", "A\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "", ""]);
        expect(screen.cursorY).toBe(2);
    });

    it("updates a frame that ends on the last row of the viewport", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nX\nC\n"], 5);

        expect(visibleRows(screen)).toEqual(["$ prompt", "A", "X", "C", ""]);
    });

    it("updates a frame without a trailing newline", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC", "A\nX\nC"]);

        expect(visibleRows(screen).slice(0, 4)).toEqual(["$ prompt", "A", "X", "C"]);
    });

    it("updates a single-line frame without a trailing newline", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A", "B"]);

        expect(visibleRows(screen).slice(0, 2)).toEqual(["$ prompt", "B"]);
    });
});

describe("inline renderer blank rows at the bottom of the viewport", () => {
    it("scrolls when a blank row is appended on the last viewport row", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\nB\n", "A\nB\n\n"], 4);

        expect(visibleRows(screen)).toEqual(["A", "B", "", ""]);
        expect(screen.cursorY).toBe(3);
    });
});

const CLEAR_RESIZE_ROWS = 12;

const inkScreen = (stdout: ReturnType<typeof createStdout>, rows = CLEAR_RESIZE_ROWS): Screen => replay(stdout.getWrites(), rows);

describe("inline renderer: cursor placement", () => {
    it("places the cursor on the last line when the frame has no trailing newline", () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 1, y: 1 });
        render("A\nBC");

        const screen = replay(stdout.getWrites(), CLEAR_RESIZE_ROWS);

        expect(screen.cursorY).toBe(1);
        expect(screen.cursorX).toBe(1);
    });

    it("leaves the cursor where the cursor component put it when a sibling re-renders", async () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const Prompt = memo(() => (
            <Box>
                <Text>{"> ab"}</Text>
                <Cursor />
            </Box>
        ));

        const Sibling = ({ text }: { readonly text: string }) => <Text>{text}</Text>;

        const { rerender, unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Sibling text="first" />
                <Prompt />
            </Box>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        rerender(
            <Box flexDirection="column">
                <Sibling text="second" />
                <Prompt />
            </Box>,
        );

        await waitUntilRenderFlush();

        const screen = inkScreen(stdout);

        expect(visibleRows(screen).slice(0, 2)).toEqual(["second", "> ab"]);
        expect(screen.cursorX).toBe(4);

        unmount();
    });
});

describe("inline renderer: cursor left inside the frame on exit", () => {
    it("moves the cursor below the frame when done() runs with the cursor inside it", () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 0, y: 0 });
        render("A\nB\nC\n");
        render.done();
        stdout.write("$ ");

        const screen = replay(stdout.getWrites(), CLEAR_RESIZE_ROWS);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["A", "B", "C", "$", ""]);
    });

    it("leaves the shell prompt below the frame after unmount", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const { unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>{"> ab"}</Text>
                <Cursor />
            </Box>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        unmount();

        await waitUntilRenderFlush();

        stdout.write("$ ");

        const screen = inkScreen(stdout);

        expect(visibleRows(screen).slice(0, 2)).toEqual(["> ab", "$"]);
    });
});

describe("inline renderer: clear() keeps history and restores the frame", () => {
    it("leaves shell history above the frame when cleared and a line is printed", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        stdout.write("$ prompt\n");

        const { clear, unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        clear();

        // Goes through Ink's console patch, which writes above the live region.
        // eslint-disable-next-line no-console
        console.log("printed after clear");

        await waitUntilRenderFlush();

        expect(visibleRows(inkScreen(stdout)).slice(0, 2)).toEqual(["$ prompt", "printed after clear"]);

        unmount();
    });

    it("restores the unchanged frame when re-rendering after clear()", async () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        stdout.write("$ prompt\n");

        const tree = () => (
            <Box flexDirection="column">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>
        );
        const { clear, rerender, unmount, waitUntilRenderFlush } = render(tree(), { interactive: true, stdout });

        await waitUntilRenderFlush();

        clear();

        expect(visibleRows(inkScreen(stdout)).slice(0, 3)).toEqual(["$ prompt", "", ""]);

        rerender(tree());

        await waitUntilRenderFlush();

        expect(visibleRows(inkScreen(stdout)).slice(0, 3)).toEqual(["$ prompt", "Line 1", "Line 2"]);

        unmount();
    });

    it("does not draw the cleared frame again on unmount", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const { clear, unmount, waitUntilRenderFlush } = render(<Text>Only once</Text>, { interactive: true, stdout });

        await waitUntilRenderFlush();

        clear();

        const before = stdout.getWrites().length;

        unmount();

        await waitUntilRenderFlush();

        expect(stdout.getWrites().slice(before).join("")).not.toContain("Only once");
    });
});

const countOccurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe("inline renderer: rows shrinking", () => {
    it("redraws the frame after the terminal loses rows", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const { unmount, waitUntilRenderFlush } = render(<Text>Frame text</Text>, { interactive: true, stdout });

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        stdout.rows = 6;
        stdout.emit("resize");

        await waitUntilRenderFlush();

        expect(stdout.getWrites().slice(before).join("")).toContain("Frame text");

        unmount();
    });

    it("keeps content above the frame when rows shrink while the cursor is shown", async () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        stdout.write("$ prompt\n");

        const { unmount, waitUntilRenderFlush } = render(
            <Box flexDirection="column">
                <Text>Frame text</Text>
                <Cursor />
            </Box>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        stdout.rows = 6;
        stdout.emit("resize");

        await waitUntilRenderFlush();

        const screen = inkScreen(stdout);

        expect(visibleRows(screen)[0]).toBe("$ prompt");
        expect(countOccurrences(visibleRows(screen).join("\n"), "Frame text")).toBe(1);

        unmount();
    });
});

const ALT_SCREEN_ON = "\u001B[?1049h";

describe("inline renderer: static output", () => {
    const staticItem = (item: string) => <Text key={item}>{item}</Text>;

    it("does not replay static output on a full-clear frame", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, 6);

        const tree = (height: number) => (
            <>
                <Static items={["static-one"]}>{staticItem}</Static>
                <Box flexDirection="column" height={height}>
                    <Text>live</Text>
                </Box>
            </>
        );

        const { rerender, unmount, waitUntilRenderFlush } = render(tree(2), { interactive: true, stdout });

        await waitUntilRenderFlush();

        rerender(tree(7));

        await waitUntilRenderFlush();

        expect(countOccurrences(stdout.getWrites().join(""), "static-one")).toBe(1);

        unmount();
    });

    it("replays static output when resuming re-enters the alternate screen", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);
        const state: { handle?: { resume: () => Promise<void> } } = {};

        const App = (): ReactNode => {
            const { suspendTerminal } = useApp();

            useEffect(() => {
                void (async () => {
                    state.handle = await suspendTerminal();
                })();
            }, [suspendTerminal]);

            return (
                <>
                    <Static items={["static-one"]}>{staticItem}</Static>
                    <Text>live</Text>
                </>
            );
        };

        const { unmount, waitUntilRenderFlush } = render(<App />, { alternateScreen: true, interactive: true, stdout });

        await waitFor(() => state.handle !== undefined);
        await state.handle!.resume();
        await waitUntilRenderFlush();

        const writes = stdout.getWrites().join("");
        const resumed = writes.slice(writes.lastIndexOf(ALT_SCREEN_ON));

        expect(resumed).toContain("static-one");

        unmount();
    });

    it("keeps blank rows rendered by <Static>", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const { unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={[1]}>{(item) => <Box height={1} key={item} />}</Static>
                <Text>live</Text>
            </>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        expect(visibleRows(inkScreen(stdout)).slice(0, 2)).toEqual(["", "live"]);

        unmount();
    });

    it("forgets the static output of a removed subtree before a resume replays it", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);
        const state: { suspend?: () => Promise<{ resume: () => Promise<void> }> } = {};

        const Parent = ({ show }: { readonly show: boolean }) => (
            <Box flexDirection="column">
                {show
                    ? (
                    <Box>
                        <Static items={["gone-static"]}>{staticItem}</Static>
                    </Box>
                    )
                    : null}
                <Text>live</Text>
            </Box>
        );

        const App = ({ show }: { readonly show: boolean }) => {
            const { suspendTerminal } = useApp();

            state.suspend = suspendTerminal;

            return <Parent show={show} />;
        };

        const { rerender, unmount, waitUntilRenderFlush } = render(<App show />, { alternateScreen: true, interactive: true, stdout });

        await waitUntilRenderFlush();

        rerender(<App show={false} />);

        await waitUntilRenderFlush();

        const handle = await state.suspend!();

        await handle.resume();
        await waitUntilRenderFlush();

        const writes = stdout.getWrites().join("");

        expect(writes.slice(writes.lastIndexOf(ALT_SCREEN_ON))).not.toContain("gone-static");

        unmount();
    });
});

describe("inline renderer: static output across concurrent renders", () => {
    it("keeps static output already written when a concurrent render with a new <Static> is abandoned", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);
        const state: { suspend?: () => Promise<{ resume: () => Promise<void> }> } = {};

        // Never resolves, so a transition rendering it is abandoned before it commits.
        const Never = (): null => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw new Promise(() => {});
        };

        const Capture = (): null => {
            const { suspendTerminal } = useApp();

            state.suspend = suspendTerminal;

            return null;
        };

        const Tree = ({ live, mode }: { readonly live: string; readonly mode: "a" | "b" }) => (
            <Box flexDirection="column">
                {mode === "a"
                    ? (
                    <Static items={["static-one"]} key="a">{(item: string) => <Text key={item}>{item}</Text>}</Static>
                    )
                    : (
                    <Static items={["static-two"]} key="b">{(item: string) => <Text key={item}>{item}</Text>}</Static>
                    )}
                <Text>{live}</Text>
                {mode === "b" ? <Never /> : null}
                <Capture />
            </Box>
        );

        const tree = (live: string, mode: "a" | "b") => (
            <Suspense fallback={<Text>wait</Text>}>
                <Tree live={live} mode={mode} />
            </Suspense>
        );

        const { rerender, unmount, waitUntilRenderFlush } = render(tree("v1", "a"), {
            alternateScreen: true,
            concurrent: true,
            interactive: true,
            stdout,
        });

        await delay(50);
        await waitUntilRenderFlush();

        startTransition(() => {
            rerender(tree("v2", "b"));
        });

        await delay(50);

        rerender(tree("v3", "a"));

        await delay(100);
        await waitUntilRenderFlush();

        const handle = await state.suspend!();

        await handle.resume();
        await waitUntilRenderFlush();

        const writes = stdout.getWrites().join("");

        expect(writes.slice(writes.lastIndexOf(ALT_SCREEN_ON))).toContain("static-one");

        unmount();
    });
});

describe("inline renderer: <Static> identity", () => {
    it("drops static output from a replaced <Static> and keeps the new one", async () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        const { rerender, unmount, waitUntilRenderFlush } = render(
            <>
                <Static items={["old-item"]} key="old">{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>v1</Text>
            </>,
            { interactive: true, stdout },
        );

        await waitUntilRenderFlush();

        rerender(
            <>
                <Static items={["new-item"]} key="new">{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>v2</Text>
            </>,
        );

        await waitUntilRenderFlush();

        const before = stdout.getWrites().length;

        rerender(
            <>
                <Static items={["new-item"]} key="new">{(item: string) => <Text key={item}>{item}</Text>}</Static>
                <Text>v3</Text>
            </>,
        );

        await waitUntilRenderFlush();

        expect(stdout.getWrites().slice(before).join("")).not.toContain("old-item");
        expect(countOccurrences(stdout.getWrites().join(""), "new-item")).toBe(1);

        unmount();
    });
});

describe("inline renderer: incremental rendering through render()", () => {
    const frame = (middle: string, withBlank: boolean) => (
        <Box flexDirection="column">
            <Text>Line 1</Text>
            <Text>{middle}</Text>
            {withBlank ? <Box height={1} /> : null}
            <Text>Line 3</Text>
        </Box>
    );

    it("updates a single line in place", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        stdout.write(SENTINEL);

        const { rerender, unmount, waitUntilRenderFlush } = render(frame("Line 2", false), {
            incrementalRendering: true,
            interactive: true,
            stdout,
        });

        await waitUntilRenderFlush();

        rerender(frame("Updated", false));

        await waitUntilRenderFlush();

        expect(visibleRows(inkScreen(stdout)).slice(0, 4)).toEqual(["$ prompt", "Line 1", "Updated", "Line 3"]);

        unmount();
    });

    it("renders a new blank row between existing rows", async () => {
        expect.assertions(1);

        const stdout = createStdout(40, true, CLEAR_RESIZE_ROWS);

        stdout.write(SENTINEL);

        const { rerender, unmount, waitUntilRenderFlush } = render(frame("Line 2", false), {
            incrementalRendering: true,
            interactive: true,
            stdout,
        });

        await waitUntilRenderFlush();

        rerender(frame("Line 2", true));

        await waitUntilRenderFlush();

        expect(visibleRows(inkScreen(stdout)).slice(0, 6)).toEqual(["$ prompt", "Line 1", "Line 2", "", "Line 3", ""]);

        unmount();
    });
});

describe("inline renderer: scrollback", () => {
    it("never erases the terminal scrollback while redrawing or clearing", async () => {
        expect.assertions(2);

        const stdout = createStdout(40, true, 6);
        const tree = (height: number) => (
            <Box flexDirection="column" height={height}>
                <Text>live</Text>
            </Box>
        );

        const { clear, rerender, unmount, waitUntilRenderFlush } = render(tree(2), { interactive: true, stdout });

        await waitUntilRenderFlush();

        // Growing past the viewport takes the full-clear path; clear() erases the live region.
        rerender(tree(8));

        await waitUntilRenderFlush();

        clear();

        rerender(tree(3));

        await waitUntilRenderFlush();

        const output = stdout.getWrites().join("");

        // CSI 3 J erases scrollback and RIS (ESC c) resets the terminal; both destroy history.
        expect(output).not.toContain("\u001B[3J");
        expect(output).not.toContain("\u001Bc");

        unmount();
    });
});
