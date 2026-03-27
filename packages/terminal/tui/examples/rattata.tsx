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
import React, { useState, useEffect, useRef, useCallback } from "react";
import { render, Box, Text, useInput, useApp, useWindowSize, useScrollable } from "@visulima/tui/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageKind = "user" | "ai" | "tool" | "diff" | "system";
type Focus = "sidebar" | "chat" | "input";

interface Message {
    id: number;
    kind: MessageKind;
    text: string;
    done: boolean;
}

// ─── Script ───────────────────────────────────────────────────────────────────

const SCRIPT: Array<{ kind: MessageKind; text: string; delay: number }> = [
    {
        kind: "system",
        text: "Rattata v0.1.0  ·  model: rattata-large-2  ·  context: 128k",
        delay: 0,
    },
    {
        kind: "user",
        text: "the terminal renderer is flushing too slowly, can you take a look?",
        delay: 600,
    },
    { kind: "tool", text: "▸ read_file  src/terminal.rs", delay: 900 },
    { kind: "tool", text: '▸ search     "write_all\\|flush\\|BufWriter"  →  4 matches', delay: 400 },
    {
        kind: "ai",
        text: "Found it. The renderer calls `stdout.write_all()` per-cell without a `BufWriter` — that's a syscall on every character. Wrapping stdout in a `BufWriter` will batch writes and flush once per frame. Should be a significant speedup.",
        delay: 500,
    },
    { kind: "tool", text: "▸ edit_file  src/terminal.rs", delay: 400 },
    {
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
        delay: 300,
    },
    {
        kind: "ai",
        text: "Done. Also noticed `lock()` was being called inside the loop — moved it outside so we only acquire the lock once per frame. That alone should cut ~30% of frame time on busy terminals.",
        delay: 400,
    },
    { kind: "tool", text: "▸ run_tests  cargo test terminal  →  12 passed  (0.4s)", delay: 800 },
    {
        kind: "ai",
        text: "All green. Want me to run the stress-test benchmark to confirm the speedup?",
        delay: 300,
    },
    { kind: "user", text: "yes please", delay: 1200 },
    { kind: "tool", text: "▸ run_bench  examples/stress-test.tsx", delay: 600 },
    { kind: "tool", text: "▸ result     before: 187 fps  →  after: 312 fps  (+67%)", delay: 1400 },
    {
        kind: "ai",
        text: "Nice — 67% throughput improvement. The BufWriter change accounts for most of it. Commit message suggestion:\n\nperf: wrap stdout in BufWriter, hoist lock() out of render loop\n\nSaves ~1 syscall per cell and ~1 mutex acquisition per frame.",
        delay: 200,
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
let cannedIdx = 0;
const nextCanned = () => CANNED[cannedIdx++ % CANNED.length];

// How many terminal rows a committed message occupies
function messageRows(msg: Message): number {
    if (msg.kind === "system") return 1;
    if (msg.kind === "tool") return 1;
    if (msg.kind === "diff") return msg.text.split("\n").length;
    // user / ai: 1 blank line + 1 per line of text
    return 1 + msg.text.split("\n").length;
}

// ─── File tree ────────────────────────────────────────────────────────────────

const FILES = [
    { name: "src/", indent: 0, dir: true, selectable: false },
    { name: "lib.rs", indent: 1, dir: false, selectable: true },
    { name: "terminal.rs", indent: 1, dir: false, selectable: true },
    { name: "ansi.rs", indent: 1, dir: false, selectable: true },
    { name: "cell.ts", indent: 1, dir: false, selectable: true },
    { name: "renderer.ts", indent: 1, dir: false, selectable: true },
    { name: "layout.ts", indent: 1, dir: false, selectable: true },
    { name: "hooks.ts", indent: 1, dir: false, selectable: true },
    { name: "react.ts", indent: 1, dir: false, selectable: true },
    { name: "examples/", indent: 0, dir: true, selectable: false },
    { name: "stress-test.tsx", indent: 1, dir: false, selectable: true },
    { name: "rattata.tsx", indent: 1, dir: false, selectable: true },
];
const SELECTABLE = FILES.map((f, i) => ({ ...f, index: i })).filter((f) => f.selectable);

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

function Header({ tokens, time, focus }: { tokens: number; time: string; focus: Focus }) {
    const hints: Record<Focus, string> = {
        sidebar: "[↑↓] navigate  [tab] focus chat  [q] quit",
        chat: "[↑↓] scroll  [tab] focus input  [q] quit",
        input: "[enter] send  [tab] focus sidebar  [q] quit",
    };
    return (
        <Box borderStyle="single" borderColor="cyan" paddingX={1} flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" gap={1}>
                <Text color="cyan" bold>
                    RATTATA
                </Text>
                <Text color="blackBright">│</Text>
                <Text color="magenta">rattata-large-2</Text>
                <Text color="blackBright">│</Text>
                <Text color="yellow">⬡ rust</Text>
            </Box>
            <Box flexDirection="row" gap={2}>
                <Text color="blackBright">{hints[focus]}</Text>
                <Text color="blackBright">{tokens.toLocaleString()} tok</Text>
                <Text color="blackBright">{time}</Text>
            </Box>
        </Box>
    );
}

function Sidebar({ width, focused, selectedIdx }: { width: number; focused: boolean; selectedIdx: number }) {
    const borderColor = focused ? "cyan" : "blackBright";
    return (
        <Box width={width} flexDirection="column" borderStyle="single" borderColor={borderColor}>
            <Box paddingX={1}>
                <Text color={focused ? "cyan" : "blackBright"} bold>
                    FILES
                </Text>
            </Box>
            {FILES.map((f, i) => {
                const isSelected = f.selectable && selectedIdx === i;
                return (
                    <Box key={i} paddingLeft={1 + f.indent * 2}>
                        {f.dir ? (
                            <Text color="blueBright">▸ {f.name}</Text>
                        ) : isSelected ? (
                            <Text color="cyan" bold inverse>
                                {" "}
                                {f.name}{" "}
                            </Text>
                        ) : (
                            <Text color="blackBright"> {f.name}</Text>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}

function DiffBlock({ text }: { text: string }) {
    return (
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
}

function MessageBlock({ msg }: { msg: Message }) {
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
                <Text color="yellow" bold>
                    you{" "}
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
            <Text color="cyan" bold>
                rat{" "}
            </Text>
            <Box flexGrow={1} flexDirection="column">
                {msg.text.split("\n").map((line, i) => (
                    <Text key={i} color="white">
                        {line}
                    </Text>
                ))}
            </Box>
        </Box>
    );
}

function InputBar({ value, focused, disabled }: { value: string; focused: boolean; disabled: boolean }) {
    const borderColor = focused ? "yellow" : "blackBright";
    const prompt = disabled ? (
        <Text color="blackBright"> waiting for rattata…</Text>
    ) : (
        <>
            <Text color="yellow" bold>
                ▸{" "}
            </Text>
            <Text color={focused ? "white" : "blackBright"}>{value}</Text>
            {focused && <Text color="yellow">█</Text>}
        </>
    );
    return (
        <Box borderStyle="single" borderColor={borderColor} paddingX={1} height={3} alignItems="center">
            {prompt}
        </Box>
    );
}

function StatusBar({ thinking, spinner, scriptDone, focus }: { thinking: boolean; spinner: string; scriptDone: boolean; focus: Focus }) {
    const focusLabel: Record<Focus, string> = {
        sidebar: "SIDEBAR",
        chat: "CHAT",
        input: "INPUT",
    };
    return (
        <Box borderStyle="single" borderColor="blackBright" paddingX={1} flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" gap={1}>
                {thinking ? (
                    <>
                        <Text color="cyan">{spinner}</Text>
                        <Text color="cyan">thinking…</Text>
                    </>
                ) : scriptDone ? (
                    <Text color="greenBright">✓ ready</Text>
                ) : (
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
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => ++_id;

// Initial selected file index (terminal.rs)
const INITIAL_FILE_IDX = FILES.findIndex((f) => f.name === "terminal.rs");

function RattataApp() {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const spinner = useSpinner();
    const tokens = useTokens();
    const time = useClock();

    // ── Focus & sidebar state
    const [focus, setFocus] = useState<Focus>("chat");
    const [selectedFileIdx, setSelectedFileIdx] = useState(INITIAL_FILE_IDX);

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
          ? [...settled, { id: -1, kind: "tool" as MessageKind, text: `${spinner} running…`, done: false }]
          : settled;

    const contentHeight = allMessages.reduce((sum, m) => sum + messageRows(m), 0);

    // pinned = user has manually scrolled up; when false, always follow the bottom
    const [pinned, setPinned] = useState(false);
    const effectiveOffset = pinned
        ? undefined // useScrollable controls offset
        : Math.max(0, contentHeight - chatViewport); // always show bottom

    const scroll = useScrollable({ viewportHeight: chatViewport, contentHeight });

    // ── Script playback refs
    const scriptIdx = useRef(0);
    const charIdx = useRef(0);
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
                setSelectedFileIdx((idx) => {
                    const pos = SELECTABLE.findIndex((f) => f.index === idx);
                    return SELECTABLE[Math.max(0, pos - 1)].index;
                });
                return;
            }
            if (key.downArrow) {
                setSelectedFileIdx((idx) => {
                    const pos = SELECTABLE.findIndex((f) => f.index === idx);
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
                if (scroll.atBottom) setPinned(false);
                else scroll.scrollDown();
                return;
            }
            if (key.pageUp) {
                setPinned(true);
                scroll.scrollBy(-5);
                return;
            }
            if (key.pageDown) {
                if (scroll.atBottom) setPinned(false);
                else {
                    scroll.scrollBy(5);
                    if (scroll.atBottom) setPinned(false);
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
        if (char === "q" && focus !== "input") exit();
    });

    // ── Stream a single message then call onDone
    const streamMessage = useCallback((msg: Message, fullText: string, speed: number, onDone: () => void) => {
        charIdx.current = 0;
        setActive(msg);
        const tick = () => {
            streamTimer.current = setTimeout(() => {
                setActive((cur) => {
                    if (!cur) return cur;
                    charIdx.current++;
                    const next = fullText.slice(0, charIdx.current);
                    if (charIdx.current >= fullText.length) {
                        setSettled((s) => [...s, { ...cur, text: fullText, done: true }]);
                        setActive(null);
                        onDone();
                        return null;
                    }
                    tick();
                    return { ...cur, text: next };
                });
            }, speed);
        };
        tick();
    }, []);

    // ── Advance the scripted session
    const advanceScript = useCallback(() => {
        const step = SCRIPT[scriptIdx.current];
        if (!step) {
            setScriptDone(true);
            setInputLocked(false);
            scriptDoneRef.current = true;
            setFocus("input");
            return;
        }
        scriptIdx.current++;

        if (step.kind === "system" || step.kind === "tool" || step.kind === "diff") {
            setSettled((s) => [...s, { id: uid(), kind: step.kind, text: step.text, done: true }]);
            setThinking(step.kind === "tool");
            stepTimer.current = setTimeout(advanceScript, SCRIPT[scriptIdx.current]?.delay ?? 0);
            return;
        }

        const msg: Message = { id: uid(), kind: step.kind, text: "", done: false };
        const speed = step.kind === "user" ? 25 : 18;
        setThinking(false);
        streamMessage(msg, step.text, speed, () => {
            setThinking(false);
            stepTimer.current = setTimeout(advanceScript, SCRIPT[scriptIdx.current]?.delay ?? 0);
        });
    }, [streamMessage]);

    // ── Submit a user-typed message → stream canned AI response
    const submitUserMessage = useCallback(
        (text: string) => {
            setInputLocked(true);
            const userMsg: Message = { id: uid(), kind: "user", text, done: true };
            setSettled((s) => [...s, userMsg]);

            setTimeout(() => {
                setThinking(true);
            }, 200);
            setTimeout(
                () => {
                    setThinking(false);
                    const response = nextCanned();
                    const aiMsg: Message = { id: uid(), kind: "ai", text: "", done: false };
                    streamMessage(aiMsg, response, 18, () => {
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
            if (streamTimer.current) clearTimeout(streamTimer.current);
            if (stepTimer.current) clearTimeout(stepTimer.current);
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
    for (const msg of allMessages) {
        const h = messageRows(msg);
        if (rowsSkipped < displayOffset) {
            const remaining = displayOffset - rowsSkipped;
            if (h <= remaining) {
                rowsSkipped += h;
                continue;
            }
            rowsSkipped = displayOffset;
        }
        if (rowsShown >= chatViewport) break;
        visibleMessages.push(msg);
        rowsShown += h;
    }

    return (
        <Box flexDirection="column" width={columns} height={rows}>
            <Header tokens={tokens} time={time} focus={focus} />
            <Box flexGrow={1} flexDirection="row">
                <Sidebar width={sidebarW} focused={focus === "sidebar"} selectedIdx={selectedFileIdx} />
                <Box flexGrow={1} flexDirection="column">
                    <Box flexGrow={1} flexDirection="column" borderStyle="single" borderColor={focus === "chat" ? "cyan" : "blackBright"} paddingX={1}>
                        {!atTop && (
                            <Box justifyContent="center">
                                <Text color="blackBright">↑ {displayOffset} rows above</Text>
                            </Box>
                        )}
                        {visibleMessages.map((msg) => (
                            <MessageBlock key={msg.id} msg={msg} />
                        ))}
                        {!atBottom && (
                            <Box justifyContent="center">
                                <Text color="blackBright">↓ scroll for more</Text>
                            </Box>
                        )}
                    </Box>
                    <InputBar value={inputValue} focused={focus === "input"} disabled={inputLocked} />
                </Box>
            </Box>
            <StatusBar thinking={thinking && !active} spinner={spinner} scriptDone={scriptDone} focus={focus} />
        </Box>
    );
}

render(<RattataApp />);
