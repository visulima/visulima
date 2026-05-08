/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-use-before-define, func-style, no-underscore-dangle, sonarjs/no-nested-conditional, sonarjs/no-nested-functions, sonarjs/pseudo-random, unicorn/prevent-abbreviations */

/**
 * rattata.tsx — Rattata AI coding assistant (demo)
 *
 * A Ratatat-themed fake AI coding assistant TUI.
 * Auto-plays a scripted session, then opens a live prompt.
 *
 * Keybinds:
 *   Tab / Shift+Tab  — cycle focus (sidebar → chat → input)
 *   ↑ / ↓           — navigate file list (when sidebar focused)
 *   ↑ / ↓           — scroll chat (when chat focused)
 *   Enter            — send message (when input focused)
 *   q / Escape       — quit
 *
 * Run: node --import @oxc-node/core/register examples/rattata.tsx
 */
// @ts-nocheck
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useInput, useScrollable, useWindowSize } from "@visulima/tui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageKind = "user" | "ai" | "tool" | "diff" | "system";
type Focus = "sidebar" | "chat" | "input";

interface Message {
    done: boolean;
    id: number;
    kind: MessageKind;
    text: string;
}

// ─── Script ───────────────────────────────────────────────────────────────────

const SCRIPT: { delay: number; kind: MessageKind; text: string }[] = [
    {
        delay: 0,
        kind: "system",
        text: "Rattata v0.1.0  ·  model: rattata-large-2  ·  context: 128k",
    },
    {
        delay: 600,
        kind: "user",
        text: "the terminal renderer is flushing too slowly, can you take a look?",
    },
    { delay: 900, kind: "tool", text: "▸ read_file  src/terminal.rs" },
    { delay: 400, kind: "tool", text: String.raw`▸ search     "write_all\|flush\|BufWriter"  →  4 matches` },
    {
        delay: 500,
        kind: "ai",
        text: "Found it. The renderer calls `stdout.write_all()` per-cell without a `BufWriter` — that's a syscall on every character. Wrapping stdout in a `BufWriter` will batch writes and flush once per frame. Should be a significant speedup.",
    },
    { delay: 400, kind: "tool", text: "▸ edit_file  src/terminal.rs" },
    {
        delay: 300,
        kind: "diff",
        text: [
            "  @@ src/terminal.rs:42 @@",
            "- pub fn write_output(stdout: &mut Stdout, s: &str) {",
            "-     stdout.write_all(s.as_bytes()).unwrap();",
            "+ pub fn write_output(stdout: &mut Stdout, s: &str) {",
            "+     let mut buf = BufWriter::new(stdout);",
            "+     buf.write_all(s.as_bytes()).unwrap();",
            "+     buf.flush().unwrap();",
            "  }",
        ].join("\n"),
    },
    {
        delay: 400,
        kind: "ai",
        text: "Done. Also noticed `lock()` was being called inside the loop — moved it outside so we only acquire the lock once per frame. That alone should cut ~30% of frame time on busy terminals.",
    },
    { delay: 800, kind: "tool", text: "▸ run_tests  cargo test terminal  →  12 passed  (0.4s)" },
    {
        delay: 300,
        kind: "ai",
        text: "All green. Want me to run the stress-test benchmark to confirm the speedup?",
    },
    { delay: 1200, kind: "user", text: "yes please" },
    { delay: 600, kind: "tool", text: "▸ run_bench  examples/stress-test.tsx" },
    { delay: 1400, kind: "tool", text: "▸ result     before: 187 fps  →  after: 312 fps  (+67%)" },
    {
        delay: 200,
        kind: "ai",
        text: "Nice — 67% throughput improvement. The BufWriter change accounts for most of it. Commit message suggestion:\n\nperf: wrap stdout in BufWriter, hoist lock() out of render loop\n\nSaves ~1 syscall per cell and ~1 mutex acquisition per frame.",
    },
];

// Canned AI responses for user-typed messages
const CANNED: string[] = [
    "On it. Give me a moment to look through the codebase.",
    "Good question. Let me check the relevant files first.",
    "Interesting. I'll need to trace through a few call sites — one sec.",
    "Sure, I can help with that. Reading the relevant context now.",
    "Let me search for that pattern across the codebase real quick.",
    "I see what you mean. Pulling up the file now.",
    "That's a tricky one. Let me think through the options.",
];
let cannedIndex = 0;
const nextCanned = () => CANNED[cannedIndex++ % CANNED.length];

// How many terminal rows a committed message occupies
function messageRows(message: Message): number {
    if (message.kind === "system") {
        return 1;
    }

    if (message.kind === "tool") {
        return 1;
    }

    if (message.kind === "diff") {
        return message.text.split("\n").length;
    }

    // user / ai: 1 blank line + 1 per line of text
    return 1 + message.text.split("\n").length;
}

// ─── File tree ────────────────────────────────────────────────────────────────

const FILES = [
    { dir: true, indent: 0, name: "src/", selectable: false },
    { dir: false, indent: 1, name: "lib.rs", selectable: true },
    { dir: false, indent: 1, name: "terminal.rs", selectable: true },
    { dir: false, indent: 1, name: "ansi.rs", selectable: true },
    { dir: false, indent: 1, name: "cell.ts", selectable: true },
    { dir: false, indent: 1, name: "renderer.ts", selectable: true },
    { dir: false, indent: 1, name: "layout.ts", selectable: true },
    { dir: false, indent: 1, name: "hooks.ts", selectable: true },
    { dir: false, indent: 1, name: "react.ts", selectable: true },
    { dir: true, indent: 0, name: "examples/", selectable: false },
    { dir: false, indent: 1, name: "stress-test.tsx", selectable: true },
    { dir: false, indent: 1, name: "rattata.tsx", selectable: true },
];
const SELECTABLE = FILES.map((f, i) => {
    return { ...f, index: i };
}).filter((f) => f.selectable);

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useSpinner() {
    const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);

        return () => clearInterval(t);
    }, []);

    return FRAMES[frame];
}

function useTokens() {
    const [tokens, setTokens] = useState(1247);

    useEffect(() => {
        const t = setInterval(() => {
            setTokens((n) => n + Math.floor(Math.random() * 8 + 1));
        }, 120);

        return () => clearInterval(t);
    }, []);

    return tokens;
}

function useClock() {
    const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-US", { hour12: false }));

    useEffect(() => {
        const t = setInterval(() => {
            setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
        }, 1000);

        return () => clearInterval(t);
    }, []);

    return time;
}

// ─── Components ───────────────────────────────────────────────────────────────

const Header = ({ focus, time, tokens }: { focus: Focus; time: string; tokens: number }) => {
    const hints: Record<Focus, string> = {
        chat: "[↑↓] scroll  [tab] focus input  [q] quit",
        input: "[enter] send  [tab] focus sidebar  [q] quit",
        sidebar: "[↑↓] navigate  [tab] focus chat  [q] quit",
    };

    return (
        <Box borderColor="cyan" borderStyle="single" flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Box flexDirection="row" gap={1}>
                <Text bold color="cyan">
                    RATTATA
                </Text>
                <Text color="blackBright">│</Text>
                <Text color="magenta">rattata-large-2</Text>
                <Text color="blackBright">│</Text>
                <Text color="yellow">⬡ rust</Text>
            </Box>
            <Box flexDirection="row" gap={2}>
                <Text color="blackBright">{hints[focus]}</Text>
                <Text color="blackBright">
{tokens.toLocaleString()}
{" "}
tok
                </Text>
                <Text color="blackBright">{time}</Text>
            </Box>
        </Box>
    );
};

const Sidebar = ({ focused, selectedIdx, width }: { focused: boolean; selectedIdx: number; width: number }) => {
    const borderColor = focused ? "cyan" : "blackBright";

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" width={width}>
            <Box paddingX={1}>
                <Text bold color={focused ? "cyan" : "blackBright"}>
                    FILES
                </Text>
            </Box>
            {FILES.map((f, i) => {
                const isSelected = f.selectable && selectedIdx === i;

                return (
                    <Box key={i} paddingLeft={1 + f.indent * 2}>
                        {f.dir
                            ? (
                            <Text color="blueBright">
▸
{f.name}
                            </Text>
                            )
                            : isSelected
                                ? (
                            <Text bold color="cyan" inverse>
                                {" "}
                                {f.name}
{" "}
                            </Text>
                                )
                                : (
                            <Text color="blackBright">
{" "}
{f.name}
                            </Text>
                                )}
                    </Box>
                );
            })}
        </Box>
    );
};

const DiffBlock = ({ text }: { text: string }) => (
    <Box flexDirection="column">
        {text.split("\n").map((line, i) => {
            const color = line.startsWith("+") ? "greenBright" : line.startsWith("-") ? "red" : line.startsWith("@") ? "cyan" : "blackBright";

            return (
                <Box key={i} paddingLeft={4}>
                    <Text color={color}>{line}</Text>
                </Box>
            );
        })}
    </Box>
);

const MessageBlock = ({ msg }: { msg: Message }) => {
    if (msg.kind === "system") {
        return (
            <Box paddingX={2}>
                <Text color="blackBright" italic>
                    {msg.text}
                </Text>
            </Box>
        );
    }

    if (msg.kind === "user") {
        return (
            <Box marginTop={1} paddingX={2}>
                <Text bold color="yellow">
                    you
{" "}
                </Text>
                <Text color="blackBright">{msg.text}</Text>
            </Box>
        );
    }

    if (msg.kind === "tool") {
        return (
            <Box paddingLeft={4}>
                <Text color="magenta">{msg.text}</Text>
            </Box>
        );
    }

    if (msg.kind === "diff") {
        return <DiffBlock text={msg.text} />;
    }

    // ai
    return (
        <Box marginTop={1} paddingX={2}>
            <Text bold color="cyan">
                rat
{" "}
            </Text>
            <Box flexDirection="column" flexGrow={1}>
                {msg.text.split("\n").map((line, i) => (
                    <Text color="white" key={i}>
                        {line}
                    </Text>
                ))}
            </Box>
        </Box>
    );
};

const InputBar = ({ disabled, focused, value }: { disabled: boolean; focused: boolean; value: string }) => {
    const borderColor = focused ? "yellow" : "blackBright";
    const prompt = disabled
        ? (
        <Text color="blackBright"> waiting for rattata…</Text>
        )
        : (
        <>
            <Text bold color="yellow">
                ▸
{" "}
            </Text>
            <Text color={focused ? "white" : "blackBright"}>{value}</Text>
            {focused && <Text color="yellow">█</Text>}
        </>
        );

    return (
        <Box alignItems="center" borderColor={borderColor} borderStyle="single" height={3} paddingX={1}>
            {prompt}
        </Box>
    );
};

const StatusBar = ({ focus, scriptDone, spinner, thinking }: { focus: Focus; scriptDone: boolean; spinner: string; thinking: boolean }) => {
    const focusLabel: Record<Focus, string> = {
        chat: "CHAT",
        input: "INPUT",
        sidebar: "SIDEBAR",
    };

    return (
        <Box borderColor="blackBright" borderStyle="single" flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Box flexDirection="row" gap={1}>
                {thinking
                    ? (
                    <>
                        <Text color="cyan">{spinner}</Text>
                        <Text color="cyan">thinking…</Text>
                    </>
                    )
                    : scriptDone
                        ? (
                    <Text color="greenBright">✓ ready</Text>
                        )
                        : (
                    <Text color="blackBright">ready</Text>
                        )}
            </Box>
            <Box flexDirection="row" gap={2}>
                <Text color="blackBright">focus: </Text>
                <Text color="cyan">{focusLabel[focus]}</Text>
                <Text color="blackBright">ratatat v0.1.0</Text>
            </Box>
        </Box>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => ++_id;

// Initial selected file index (terminal.rs)
const INITIAL_FILE_IDX = FILES.findIndex((f) => f.name === "terminal.rs");

const RattataApp = () => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const spinner = useSpinner();
    const tokens = useTokens();
    const time = useClock();

    // ── Focus & sidebar state
    const [focus, setFocus] = useState<Focus>("chat");
    const [selectedFileIndex, setSelectedFileIndex] = useState(INITIAL_FILE_IDX);

    // ── Chat state
    const [settled, setSettled] = useState<Message[]>([]);
    const [active, setActive] = useState<Message | null>(null);
    const [thinking, setThinking] = useState(false);
    const [scriptDone, setScriptDone] = useState(false);

    // ── Input state
    const [inputValue, setInputValue] = useState("");
    const [inputLocked, setInputLocked] = useState(true); // locked until script finishes

    // ── Scroll — viewport is the chat box height minus borders/padding (2 rows)
    // header=3, statusBar=3, inputBar=3, chatBorder=2 → 11 rows chrome
    const CHROME_ROWS = 11;
    const chatViewport = Math.max(1, rows - CHROME_ROWS);

    // All displayable rows: settled messages + active streaming message + thinking indicator
    const allMessages: Message[] = active
        ? [...settled, active]
        : thinking
            ? [...settled, { done: false, id: -1, kind: "tool", text: `${spinner} running…` }]
            : settled;

    const contentHeight = allMessages.reduce((sum, m) => sum + messageRows(m), 0);

    // pinned = user has manually scrolled up; when false, always follow the bottom
    const [pinned, setPinned] = useState(false);
    const effectiveOffset = pinned
        ? undefined // useScrollable controls offset
        : Math.max(0, contentHeight - chatViewport); // always show bottom

    const scroll = useScrollable({ contentHeight, viewportHeight: chatViewport });

    // ── Script playback refs
    const scriptIndex = useRef(0);
    const charIndex = useRef(0);
    const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scriptDoneRef = useRef(false);

    // ── Focus cycling
    const FOCUS_ORDER: Focus[] = ["sidebar", "chat", "input"];
    const cycleFocus = useCallback((dir: 1 | -1) => {
        setFocus((f) => {
            const i = FOCUS_ORDER.indexOf(f);

            return FOCUS_ORDER[(i + dir + FOCUS_ORDER.length) % FOCUS_ORDER.length];
        });
    }, []);

    // ── Input handling
    useInput((char, key) => {
        // Escape and Ctrl+C always quit regardless of focus
        if (key.escape || (key.ctrl && char === "c")) {
            exit();

            return;
        }

        // Tab always cycles focus
        if (key.tab) {
            cycleFocus(key.shift ? -1 : 1);

            return;
        }

        if (focus === "sidebar") {
            if (key.upArrow) {
                setSelectedFileIndex((index) => {
                    const pos = SELECTABLE.findIndex((f) => f.index === index);

                    return SELECTABLE[Math.max(0, pos - 1)].index;
                });

                return;
            }

            if (key.downArrow) {
                setSelectedFileIndex((index) => {
                    const pos = SELECTABLE.findIndex((f) => f.index === index);

                    return SELECTABLE[Math.min(SELECTABLE.length - 1, pos + 1)].index;
                });

                return;
            }
        }

        if (focus === "chat") {
            if (key.upArrow) {
                setPinned(true);
                scroll.scrollUp();

                return;
            }

            if (key.downArrow) {
                if (scroll.atBottom) {
                    setPinned(false);
                } else {
                    scroll.scrollDown();
                }

                return;
            }

            if (key.pageUp) {
                setPinned(true);
                scroll.scrollBy(-5);

                return;
            }

            if (key.pageDown) {
                if (scroll.atBottom) {
                    setPinned(false);
                } else {
                    scroll.scrollBy(5);

                    if (scroll.atBottom) {
                        setPinned(false);
                    }
                }

                return;
            }
        }

        if (focus === "input" && !inputLocked) {
            if (key.return) {
                const text = inputValue.trim();

                if (text) {
                    submitUserMessage(text);
                    setInputValue("");
                }

                return;
            }

            if (key.backspace) {
                setInputValue((v) => v.slice(0, -1));

                return;
            }

            if (char && !key.ctrl && !key.meta) {
                setInputValue((v) => v + char);

                return;
            }
        }

        // 'q' quits from sidebar and chat; not from input (user may want to type 'q')
        if (char === "q" && focus !== "input") {
            exit();
        }
    });

    // ── Stream a single message then call onDone
    const streamMessage = useCallback((message: Message, fullText: string, speed: number, onDone: () => void) => {
        charIndex.current = 0;
        setActive(message);
        const tick = () => {
            streamTimer.current = setTimeout(() => {
                setActive((current) => {
                    if (!current) {
                        return current;
                    }

                    charIndex.current++;
                    const next = fullText.slice(0, charIndex.current);

                    if (charIndex.current >= fullText.length) {
                        setSettled((s) => [...s, { ...current, done: true, text: fullText }]);
                        setActive(null);
                        onDone();

                        return null;
                    }

                    tick();

                    return { ...current, text: next };
                });
            }, speed);
        };

        tick();
    }, []);

    // ── Advance the scripted session
    const advanceScript = useCallback(() => {
        const step = SCRIPT[scriptIndex.current];

        if (!step) {
            setScriptDone(true);
            setInputLocked(false);
            scriptDoneRef.current = true;
            setFocus("input");

            return;
        }

        scriptIndex.current++;

        if (step.kind === "system" || step.kind === "tool" || step.kind === "diff") {
            setSettled((s) => [...s, { done: true, id: uid(), kind: step.kind, text: step.text }]);
            setThinking(step.kind === "tool");
            stepTimer.current = setTimeout(advanceScript, SCRIPT[scriptIndex.current]?.delay ?? 0);

            return;
        }

        const message: Message = { done: false, id: uid(), kind: step.kind, text: "" };
        const speed = step.kind === "user" ? 25 : 18;

        setThinking(false);
        streamMessage(message, step.text, speed, () => {
            setThinking(false);
            stepTimer.current = setTimeout(advanceScript, SCRIPT[scriptIndex.current]?.delay ?? 0);
        });
    }, [streamMessage]);

    // ── Submit a user-typed message → stream canned AI response
    const submitUserMessage = useCallback(
        (text: string) => {
            setInputLocked(true);
            const userMessage: Message = { done: true, id: uid(), kind: "user", text };

            setSettled((s) => [...s, userMessage]);

            setTimeout(() => {
                setThinking(true);
            }, 200);
            setTimeout(
                () => {
                    setThinking(false);
                    const response = nextCanned();
                    const aiMessage: Message = { done: false, id: uid(), kind: "ai", text: "" };

                    streamMessage(aiMessage, response, 18, () => {
                        setInputLocked(false);
                    });
                },
                200 + 800 + Math.random() * 600,
            );
        },
        [streamMessage],
    );

    useEffect(() => {
        stepTimer.current = setTimeout(advanceScript, 400);

        return () => {
            if (streamTimer.current) {
                clearTimeout(streamTimer.current);
            }

            if (stepTimer.current) {
                clearTimeout(stepTimer.current);
            }
        };
    }, []);

    const sidebarW = 22;

    // Build the visible slice: walk allMessages accumulating rows until we
    // Build visible slice using effectiveOffset (pinned uses scroll.offset, unpinned uses bottom)
    const displayOffset = effectiveOffset ?? scroll.offset;
    const atTop = displayOffset === 0;
    const atBottom = !pinned; // when following bottom, we're always "at bottom"

    const visibleMessages: Message[] = [];
    let rowsSkipped = 0;
    let rowsShown = 0;

    for (const message of allMessages) {
        const h = messageRows(message);

        if (rowsSkipped < displayOffset) {
            const remaining = displayOffset - rowsSkipped;

            if (h <= remaining) {
                rowsSkipped += h;
                continue;
            }

            rowsSkipped = displayOffset;
        }

        if (rowsShown >= chatViewport) {
            break;
        }

        visibleMessages.push(message);
        rowsShown += h;
    }

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Header focus={focus} time={time} tokens={tokens} />
            <Box flexDirection="row" flexGrow={1}>
                <Sidebar focused={focus === "sidebar"} selectedIdx={selectedFileIndex} width={sidebarW} />
                <Box flexDirection="column" flexGrow={1}>
                    <Box borderColor={focus === "chat" ? "cyan" : "blackBright"} borderStyle="single" flexDirection="column" flexGrow={1} paddingX={1}>
                        {!atTop && (
                            <Box justifyContent="center">
                                <Text color="blackBright">
↑
{displayOffset}
{" "}
rows above
                                </Text>
                            </Box>
                        )}
                        {visibleMessages.map((message) => (
                            <MessageBlock key={message.id} msg={message} />
                        ))}
                        {!atBottom && (
                            <Box justifyContent="center">
                                <Text color="blackBright">↓ scroll for more</Text>
                            </Box>
                        )}
                    </Box>
                    <InputBar disabled={inputLocked} focused={focus === "input"} value={inputValue} />
                </Box>
            </Box>
            <StatusBar focus={focus} scriptDone={scriptDone} spinner={spinner} thinking={thinking && !active} />
        </Box>
    );
};

render(<RattataApp />);
