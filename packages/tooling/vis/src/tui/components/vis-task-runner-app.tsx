import type { Task } from "@visulima/task-runner";
import { Box } from "@visulima/tui/components/box";
import { Dialog } from "@visulima/tui/components/dialog";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useWindowSize } from "@visulima/tui/hooks/use-window-size";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { formatTargetsAndProjects } from "../formatting-utils";
import { formatMs } from "../pretty-time";
import { isCacheStatus } from "../status-utils";
import type { StdinEntry } from "../types";
import OutputPanel from "./output-panel";
import QuitDialog from "./quit-dialog";
import TaskListPanel from "./task-list-panel";
import type { TaskStore } from "./task-store";

// ── Layout constants ───────────────────────────────────────────────────

const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;
const MIN_HORIZONTAL_WIDTH = 100;

// ── Component ───────────────────────────────────────────────────────────

interface VisTaskRunnerAppProps {
    /** 0 = no auto-exit (default), >0 = countdown seconds */
    autoExitSeconds: number;
    parallelSlots: number;
    projectNames: string[];
    /** Registry of stdin entries keyed by task ID, for interactive input. */
    stdinRegistry: Map<string, StdinEntry>;
    store: TaskStore;
    targets: string[];
    tasks: Task[];
}

const VisTaskRunnerApp = ({ autoExitSeconds, parallelSlots, projectNames, stdinRegistry, store, targets, tasks }: VisTaskRunnerAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const listScrollRef = useRef<ScrollViewRef>(null);
    const outputScrollRef = useRef<ScrollViewRef>(null);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);

    // Save scroll positions per view mode so transitions don't lose the user's place
    const savedScrollRef = useRef({
        list: 0,
        splitList: 0,
        splitOutput: 0,
    });

    // Helper: save current scroll positions before transitioning
    const saveScrollPositions = useCallback(() => {
        if (state.viewMode === "list") {
            savedScrollRef.current.list = listScrollRef.current?.getScrollOffset() ?? 0;
        } else if (state.viewMode === "split") {
            savedScrollRef.current.splitList = listScrollRef.current?.getScrollOffset() ?? 0;
            savedScrollRef.current.splitOutput = outputScrollRef.current?.getScrollOffset() ?? 0;
        }
    }, [state.viewMode]);

    // Helper: restore scroll positions after transitioning (deferred for React re-render)
    const restoreScrollPositions = useCallback(
        (targetMode: "fullscreen" | "list" | "split") => {
            setTimeout(() => {
                if (targetMode === "list") {
                    const saved = savedScrollRef.current.list;

                    listScrollRef.current?.scrollTo(saved);
                } else if (targetMode === "split") {
                    const savedList = savedScrollRef.current.splitList;

                    // If no saved position, scroll to selected item
                    if (savedList > 0) {
                        listScrollRef.current?.scrollTo(savedList);
                    } else {
                        listScrollRef.current?.scrollTo(Math.max(0, store.getSnapshot().selectedIndex - 2));
                    }

                    outputScrollRef.current?.scrollTo(savedScrollRef.current.splitOutput);
                }
            }, 0);
        },
        [store],
    );

    // Auto-show quit dialog when tasks complete — only if autoExit is enabled
    const previousDoneRef = useRef(false);

    useEffect(() => {
        if (state.done && !previousDoneRef.current) {
            previousDoneRef.current = true;

            if (autoExitSeconds > 0) {
                setQuitDialogVisible(true);
            }
        }

        if (!state.done && previousDoneRef.current) {
            previousDoneRef.current = false;
            setQuitDialogVisible(false);
        }
    }, [state.done, autoExitSeconds]);

    // Filter rows by status and text
    const filteredRows = useMemo(() => {
        let filtered = state.rows;

        if (state.statusFilter !== "all") {
            filtered = filtered.filter((r) => {
                if (state.statusFilter === "failed") {
                    return r.status === "failure";
                }

                if (state.statusFilter === "running") {
                    return r.status === "running" || r.status === "pending";
                }

                if (state.statusFilter === "passed") {
                    return r.status === "success" || isCacheStatus(r.status);
                }

                return true;
            });
        }

        if (state.filterText) {
            const lower = state.filterText.toLowerCase();

            filtered = filtered.filter((r) => r.taskId.toLowerCase().includes(lower));
        }

        return filtered;
    }, [state.rows, state.filterText, state.statusFilter]);

    // Count running tasks for status bar
    const runningCount = useMemo(() => state.rows.filter((r) => r.status === "running").length, [state.rows]);

    // Get selected task
    const selectedRow = filteredRows[state.selectedIndex] ?? null;
    const selectedTaskId = selectedRow?.taskId ?? null;

    // Output shows selected task content
    const outputTaskId = state.pinnedTaskIds[0] ?? selectedTaskId;
    const outputTask = outputTaskId ? state.rows.find((r) => r.taskId === outputTaskId) : null;
    const outputContent = outputTaskId ? (state.outputs.get(outputTaskId) ?? "") : "";

    // Header title and status
    const description = formatTargetsAndProjects(projectNames, targets, tasks);
    const headerTitle = state.done ? `Completed ${description} (${formatMs((state.endTime ?? Date.now()) - state.startTime)})` : `Running ${description}...`;
    const headerStatus: "error" | "running" | "success" = state.done ? (state.failed > 0 ? "error" : "success") : "running";

    // Scroll selected item into view
    const scrollToSelected = useCallback((index: number) => {
        // ScrollView handles visibility automatically; we just need to ensure
        // the selected item is scrolled to via the ref
        listScrollRef.current?.scrollTo(Math.max(0, index - 2));
    }, []);

    // ── Interactive input handlers ────────────────────────────────────

    // Auto-disable interactive mode when the viewed task is no longer running
    useEffect(() => {
        if (state.interactiveMode && outputTask?.status !== "running") {
            store.setInteractiveMode(false);
        }
    }, [state.interactiveMode, outputTask?.status, store]);

    // Forward terminal resize to the PTY of the currently viewed running task.
    // Use approximate output panel dimensions, not full terminal size.
    useEffect(() => {
        if (!outputTaskId) {
            return;
        }

        let panelCols = columns;

        if (state.viewMode === "split" && columns >= MIN_HORIZONTAL_WIDTH) {
            panelCols = columns - Math.floor(columns * 0.4) - 2;
        } else if (state.viewMode === "split") {
            panelCols = columns - 2;
        } else if (state.viewMode === "fullscreen") {
            panelCols = columns - 2;
        }

        const panelRows = Math.max(1, rows - 4);

        // This effect pushes imperative PTY resize events into a
        // non-React registry — not a parent component — so the
        // "don't pass data to parents" heuristic misfires here.
        // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- imperative PTY resize, not parent state
        stdinRegistry.get(outputTaskId)?.resize?.(panelCols, panelRows);
    }, [columns, rows, state.viewMode, outputTaskId]);

    // ── Keyboard handling (interactive mode — raw passthrough to PTY) ──
    // Forward every keystroke directly to the PTY so interactive tools
    // (inquirer, npm prompts, etc.) receive arrow keys, characters, etc.

    useInput(
        (input, key) => {
            // Escape exits interactive mode — never forwarded to PTY
            if (key.escape) {
                store.setInteractiveMode(false);

                return;
            }

            if (!outputTaskId) {
                return;
            }

            const entry = stdinRegistry.get(outputTaskId);

            if (!entry) {
                store.setInteractiveMode(false);

                return;
            }

            // Map key events to raw terminal sequences for the PTY
            if (key.return) {
                entry.write("\r");
            } else if (key.upArrow) {
                entry.write("\u001B[A");
            } else if (key.downArrow) {
                entry.write("\u001B[B");
            } else if (key.rightArrow) {
                entry.write("\u001B[C");
            } else if (key.leftArrow) {
                entry.write("\u001B[D");
            } else if (key.backspace) {
                entry.write("\u007F");
            } else if (key.delete) {
                entry.write("\u001B[3~");
            } else if (key.tab) {
                entry.write("\t");
            } else if (key.home) {
                entry.write("\u001B[H");
            } else if (key.end) {
                entry.write("\u001B[F");
            } else if (key.pageUp) {
                entry.write("\u001B[5~");
            } else if (key.pageDown) {
                entry.write("\u001B[6~");
            } else if (key.ctrl && input) {
                // Ctrl+letter → raw control character (Ctrl+A = 0x01, etc.)
                const code = input.toUpperCase().codePointAt(0);

                if (code !== undefined && code >= 65 && code <= 90) {
                    entry.write(String.fromCodePoint(code - 64));
                }
            } else if (input) {
                // Regular characters — forward as-is
                entry.write(input);
            }
        },
        { isActive: state.interactiveMode },
    );

    // ── Keyboard handling ───────────────────────────────────────────

    useInput(
        (input, key) => {
            // Ctrl+C: always exit immediately
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            // Quit dialog handles its own input via useInput
            if (quitDialogVisible) {
                return;
            }

            // Help popup: scroll with arrows, close with esc/?, quit with q
            if (helpVisible) {
                if (key.escape || input === "?") {
                    setHelpVisible(false);
                } else if (input === "q") {
                    setHelpVisible(false);
                    setQuitDialogVisible(true);
                } else if (key.downArrow || input === "j") {
                    helpScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    helpScrollRef.current?.scrollBy(-1);
                } else if (key.pageDown) {
                    helpScrollRef.current?.scrollBy(5);
                } else if (key.pageUp) {
                    helpScrollRef.current?.scrollBy(-5);
                } else if (key.home) {
                    helpScrollRef.current?.scrollToTop();
                } else if (key.end) {
                    helpScrollRef.current?.scrollToBottom();
                }

                return;
            }

            // Help popup toggle
            if (input === "?") {
                setHelpVisible(true);

                return;
            }

            // Global: quit — show confirmation dialog
            if (input === "q") {
                setQuitDialogVisible(true);

                return;
            }

            // Global: rerun all (only when done)
            if (input === "r" && state.done) {
                store.requestRerun();

                return;
            }

            // Retry single failed task (Shift+R, only when done)
            if (input === "R" && state.done) {
                const row = filteredRows[state.selectedIndex];

                if (row?.status === "failure") {
                    store.requestRetry(row.taskId);
                }

                return;
            }

            // Status filter cycling (Shift+F)
            if (input === "F" && !state.filterActive) {
                const filters = ["all", "failed", "running", "passed"] as const;
                const currentIndex = filters.indexOf(state.statusFilter);

                store.setStatusFilter(filters[(currentIndex + 1) % filters.length]!);

                return;
            }

            // ── Filter mode ─────────────────────────────────────────
            if (state.filterActive) {
                if (key.escape) {
                    store.setFilterActive(false);

                    return;
                }

                if (key.return) {
                    store.setFilterActive(false);

                    return;
                }

                if (key.backspace) {
                    store.setFilter(state.filterText.slice(0, -1));

                    return;
                }

                // Printable character
                if (input && !key.ctrl && !key.meta) {
                    store.setFilter(state.filterText + input);

                    return;
                }

                return;
            }

            // ── Interactive input toggle (i) ───────────────────────
            if (input === "i" && outputTask?.status === "running") {
                const isOutputView = state.viewMode === "fullscreen" || (state.viewMode === "split" && state.focusedPanel === "output");

                if (isOutputView) {
                    store.setInteractiveMode(true);

                    return;
                }
            }

            // ── Fullscreen output mode ─────────────────────────────
            if (state.viewMode === "fullscreen") {
                if (key.escape) {
                    store.setViewMode("split");
                    restoreScrollPositions("split");

                    return;
                }

                // Scroll output
                if (key.downArrow || input === "j") {
                    outputScrollRef.current?.scrollBy(1);

                    return;
                }

                if (key.upArrow || input === "k") {
                    outputScrollRef.current?.scrollBy(-1);

                    return;
                }

                if (key.pageDown || (key.ctrl && input === "d")) {
                    outputScrollRef.current?.scrollBy(12);

                    return;
                }

                if (key.pageUp || (key.ctrl && input === "u")) {
                    outputScrollRef.current?.scrollBy(-12);

                    return;
                }

                if (key.home) {
                    outputScrollRef.current?.scrollToTop();

                    return;
                }

                if (key.end) {
                    outputScrollRef.current?.scrollToBottom();

                    return;
                }

                return;
            }

            // ── Split view ─────────────────────────────────────────
            if (state.viewMode === "split") {
                // Tab switches focus between panels
                if (key.tab) {
                    const nextPanel = state.focusedPanel === "tasks" ? "output" : "tasks";

                    store.setFocusedPanel(nextPanel);

                    return;
                }

                if (state.focusedPanel === "output") {
                    if (key.escape) {
                        store.setFocusedPanel("tasks");

                        return;
                    }

                    // Enter in output panel → fullscreen
                    if (key.return) {
                        saveScrollPositions();
                        store.setViewMode("fullscreen");

                        return;
                    }

                    // Scroll output
                    if (key.downArrow || input === "j") {
                        outputScrollRef.current?.scrollBy(1);

                        return;
                    }

                    if (key.upArrow || input === "k") {
                        outputScrollRef.current?.scrollBy(-1);

                        return;
                    }

                    if (key.pageDown || (key.ctrl && input === "d")) {
                        outputScrollRef.current?.scrollBy(12);

                        return;
                    }

                    if (key.pageUp || (key.ctrl && input === "u")) {
                        outputScrollRef.current?.scrollBy(-12);

                        return;
                    }

                    if (key.home) {
                        outputScrollRef.current?.scrollToTop();

                        return;
                    }

                    if (key.end) {
                        outputScrollRef.current?.scrollToBottom();

                        return;
                    }

                    return;
                }

                // Task list focused in split view → back to list
                if (key.escape) {
                    store.setViewMode("list");
                    restoreScrollPositions("list");

                    return;
                }

                // Enter in task list → focus the output panel
                if (key.return) {
                    store.setFocusedPanel("output");

                    return;
                }
            }

            // ── List view / task list navigation (list + split task-focused) ──
            if (state.viewMode === "list" || (state.viewMode === "split" && state.focusedPanel === "tasks")) {
                // Navigation
                if (key.downArrow || input === "j") {
                    const next = Math.min(state.selectedIndex + 1, Math.max(0, filteredRows.length - 1));

                    store.setSelectedIndex(next);
                    scrollToSelected(next);

                    return;
                }

                if (key.upArrow || input === "k") {
                    const next = Math.max(state.selectedIndex - 1, 0);

                    store.setSelectedIndex(next);
                    scrollToSelected(next);

                    return;
                }

                // Enter in list view → switch to split view with output focused
                if (key.return && state.viewMode === "list") {
                    saveScrollPositions();
                    // Reset split scroll so it scrolls to selected item
                    savedScrollRef.current.splitList = 0;
                    savedScrollRef.current.splitOutput = 0;
                    store.setViewMode("split");
                    store.setFocusedPanel("output");
                    restoreScrollPositions("split");

                    return;
                }

                // Filter
                if (input === "/") {
                    store.setFilterActive(true);

                    return;
                }

                // Pin to slot 1
                if (input === "1" && selectedTaskId) {
                    store.pinTask(0, selectedTaskId);

                    return;
                }

                // Pin to slot 2
                if (input === "2" && selectedTaskId) {
                    store.pinTask(1, selectedTaskId);

                    return;
                }

                // Clear pins
                if (input === "0") {
                    store.clearPins();

                    return;
                }

                // Escape: clear filter text in list mode
                if (key.escape && state.filterText) {
                    store.setFilter("");
                }
            }
        },
        { isActive: !state.interactiveMode },
    );

    // ── Layout ──────────────────────────────────────────────────────

    // Terminal too small
    if (columns < MIN_VIEWPORT_WIDTH || rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" height={rows} justifyContent="center" width={columns}>
                <Text color="yellow">
                    Terminal too small (
{columns}
x
{rows}
                    ). Minimum:
{" "}
{MIN_VIEWPORT_WIDTH}
x
{MIN_VIEWPORT_HEIGHT}
                </Text>
            </Box>
        );
    }

    // ── Status summary (right-aligned in footer) ───────────────────

    const statusSummary = (
        <Box gap={1}>
            {state.succeeded > 0 && (
                <Text bold color="green">
                    {"\u2713"}
{" "}
{state.succeeded}
                </Text>
            )}
            {state.failed > 0 && (
                <Text bold color="red">
                    {"\u2717"}
{" "}
{state.failed}
                </Text>
            )}
            {runningCount > 0 && (
                <Text color="cyan">
                    {"\u25F7"}
{" "}
{runningCount}
                </Text>
            )}
            <Text dimColor>
{state.rows.length}
{" "}
total
            </Text>
            {state.statusFilter !== "all" && (
<Text color="yellow">
[
{state.statusFilter}
]
</Text>
            )}
        </Box>
    );

    // ── Footer ─────────────────────────────────────────────────────

    let footerItems: React.JSX.Element[];

    if (state.viewMode === "fullscreen") {
        footerItems = [
            <Box gap={1} key="esc">
                <Text bold color="white">
                    Esc
                </Text>
                <Text dimColor>BACK</Text>
            </Box>,
            <Box gap={1} key="scroll">
                <Text bold color="white">
                    {"\u2191\u2193"}
                </Text>
                <Text dimColor>SCROLL</Text>
            </Box>,
            <Box gap={1} key="page">
                <Text bold color="white">
                    ^u ^d
                </Text>
                <Text dimColor>PAGE</Text>
            </Box>,
            ...(outputTask?.status === "running"
                ? [
                      <Box gap={1} key="i">
                          <Text bold color="white">
                              i
                          </Text>
                          <Text dimColor>INPUT</Text>
                      </Box>,
                ]
                : []),
            <Box gap={1} key="q">
                <Text bold color="white">
                    q
                </Text>
                <Text dimColor>QUIT</Text>
            </Box>,
        ];
    } else if (state.done) {
        const canRetry = filteredRows[state.selectedIndex]?.status === "failure";

        footerItems = [
            <Box gap={1} key="q">
                <Text bold color="white">
                    q
                </Text>
                <Text dimColor>QUIT</Text>
            </Box>,
            <Box gap={1} key="r">
                <Text bold color="white">
                    r
                </Text>
                <Text dimColor>RERUN</Text>
            </Box>,
            ...(canRetry
                ? [
                      <Box gap={1} key="R">
                          <Text bold color="white">
                              R
                          </Text>
                          <Text dimColor>RETRY</Text>
                      </Box>,
                ]
                : []),
            <Box gap={1} key="?">
                <Text bold color="white">
                    ?
                </Text>
                <Text dimColor>HELP</Text>
            </Box>,
            <Box gap={1} key="nav">
                <Text bold color="white">
                    {"\u2191\u2193"}
                </Text>
                <Text dimColor>NAV</Text>
            </Box>,
            <Box gap={1} key="F">
                <Text bold color="white">
                    F
                </Text>
                <Text dimColor>FILTER</Text>
            </Box>,
            <Box gap={1} key="enter">
                <Text bold color="white">
                    {"\u23CE"}
                </Text>
                <Text dimColor>{state.viewMode === "list" ? "OUTPUT" : "FULLSCREEN"}</Text>
            </Box>,
        ];
    } else if (state.viewMode === "split" && state.focusedPanel === "output") {
        footerItems = [
            <Box gap={1} key="q">
                <Text bold color="white">
                    q
                </Text>
                <Text dimColor>QUIT</Text>
            </Box>,
            <Box gap={1} key="esc">
                <Text bold color="white">
                    Esc
                </Text>
                <Text dimColor>BACK</Text>
            </Box>,
            <Box gap={1} key="scroll">
                <Text bold color="white">
                    {"\u2191\u2193"}
                </Text>
                <Text dimColor>SCROLL</Text>
            </Box>,
            ...(outputTask?.status === "running"
                ? [
                      <Box gap={1} key="i">
                          <Text bold color="white">
                              i
                          </Text>
                          <Text dimColor>INPUT</Text>
                      </Box>,
                ]
                : []),
            <Box gap={1} key="enter">
                <Text bold color="white">
                    {"\u23CE"}
                </Text>
                <Text dimColor>FULLSCREEN</Text>
            </Box>,
            <Box gap={1} key="tab">
                <Text bold color="white">
                    Tab
                </Text>
                <Text dimColor>PANEL</Text>
            </Box>,
            <Box gap={1} key="?">
                <Text bold color="white">
                    ?
                </Text>
                <Text dimColor>HELP</Text>
            </Box>,
        ];
    } else {
        footerItems = [
            <Box gap={1} key="q">
                <Text bold color="white">
                    q
                </Text>
                <Text dimColor>QUIT</Text>
            </Box>,
            <Box gap={1} key="?">
                <Text bold color="white">
                    ?
                </Text>
                <Text dimColor>HELP</Text>
            </Box>,
            <Box gap={1} key="nav">
                <Text bold color="white">
                    {"\u2191\u2193"}
                </Text>
                <Text dimColor>NAV</Text>
            </Box>,
            <Box gap={1} key="/">
                <Text bold color="white">
                    /
                </Text>
                <Text dimColor>FILTER</Text>
            </Box>,
            <Box gap={1} key="F">
                <Text bold color="white">
                    F
                </Text>
                <Text dimColor>STATUS</Text>
            </Box>,
            <Box gap={1} key="enter">
                <Text bold color="white">
                    {"\u23CE"}
                </Text>
                <Text dimColor>{state.viewMode === "list" ? "OUTPUT" : "FULLSCREEN"}</Text>
            </Box>,
            ...(state.viewMode === "split"
                ? [
                      <Box gap={1} key="tab">
                          <Text bold color="white">
                              Tab
                          </Text>
                          <Text dimColor>PANEL</Text>
                      </Box>,
                ]
                : []),
        ];
    }

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0} justifyContent="space-between">
            <Box flexGrow={1} flexWrap="wrap" gap={2} paddingX={1}>
                {footerItems}
            </Box>
            <Box flexShrink={0} paddingX={1}>
                {statusSummary}
            </Box>
        </Box>
    );

    // ── Help popup overlay ──────────────────────────────────────────

    const helpPopup = (
        <Dialog
            backgroundColor="#1e1e1e"
            footer={(
                <Text dimColor>
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
{" "}
                    scroll
{" "}
                    <Text bold color="white">
                        ?
                    </Text>
                    /
                    <Text bold color="white">
                        Esc
                    </Text>
{" "}
                    close
                </Text>
              )}
            scrollRef={helpScrollRef}
            title="KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={52}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        NAVIGATION
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                {"\u2191"}
                                /k
                            </Text>
                            <Text dimColor> Move up</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            {"\u2193"}
                            /j
                        </Text>
                        <Text dimColor> Move down</Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Tab
                    </Text>
                    <Text dimColor> Switch panel (split)</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Esc
                    </Text>
                    <Text dimColor> Back / close</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Enter
                    </Text>
                    <Text dimColor> Show output / fullscreen</Text>
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        VIEWS
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Enter
                    </Text>
                    <Text dimColor>
                        {" "}
                        List
{" "}
{"\u2192"}
{" "}
Split
{" "}
{"\u2192"}
{" "}
Fullscreen
                    </Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Esc
                    </Text>
                    <Text dimColor>
                        {" "}
                        Fullscreen
{" "}
{"\u2192"}
{" "}
Split
{" "}
{"\u2192"}
{" "}
List
                    </Text>
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        ACTIONS
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                /
                            </Text>
                            <Text dimColor> Filter by text</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            F
                        </Text>
                        <Text dimColor> Filter by status</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                1
                            </Text>
                            <Text dimColor>/</Text>
                            <Text bold color="white">
                                2
                            </Text>
                            <Text dimColor> Pin to output pane</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            0
                        </Text>
                        <Text dimColor> Clear pins</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                r
                            </Text>
                            <Text dimColor> Rerun all (done)</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            R
                        </Text>
                        <Text dimColor> Retry failed task</Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        i
                    </Text>
                    <Text dimColor> Interactive input (running task)</Text>
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        SCROLLING
                    </Text>
                    <Text dimColor> (output panel)</Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                {"\u2191"}
                                /k
                            </Text>
                            <Text dimColor> Scroll up</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            {"\u2193"}
                            /j
                        </Text>
                        <Text dimColor> Scroll down</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                ^u
                            </Text>
                            <Text dimColor> Page up</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            ^d
                        </Text>
                        <Text dimColor> Page down</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                Home
                            </Text>
                            <Text dimColor> Top</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            End
                        </Text>
                        <Text dimColor> Bottom</Text>
                    </Text>
                </Box>
            </Box>

            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        GENERAL
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                q
                            </Text>
                            <Text dimColor> Quit</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            ?
                        </Text>
                        <Text dimColor> Toggle help</Text>
                    </Text>
                </Box>
            </Box>
        </Dialog>
    );

    // ── Quit dialog overlay ───────────────────────────────────────────

    const quitDialog = (
        <QuitDialog
            autoExitSeconds={autoExitSeconds > 0 ? autoExitSeconds : 3}
            onCancel={() => {
                setQuitDialogVisible(false);
            }}
            visible={quitDialogVisible}
        />
    );

    // ── FULLSCREEN OUTPUT VIEW ──────────────────────────────────────

    if (state.viewMode === "fullscreen") {
        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexGrow={1}>
                    <OutputPanel
                        duration={outputTask?.duration ?? outputTask?.elapsed}
                        focused
                        interactiveMode={state.interactiveMode}
                        output={outputContent}
                        scrollRef={outputScrollRef}
                        status={outputTask?.status}
                        taskId={outputTaskId}
                    />
                </Box>
                {footer}
                {quitDialog}
                {helpPopup}
            </Box>
        );
    }

    // ── SPLIT VIEW ──────────────────────────────────────────────────

    if (state.viewMode === "split") {
        const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

        const taskListPanel = (
            <TaskListPanel
                compact
                filterActive={state.filterActive}
                filterText={state.filterText}
                focused={state.focusedPanel === "tasks"}
                headerStatus={headerStatus}
                parallelSlots={parallelSlots}
                pinnedTaskIds={state.pinnedTaskIds}
                rows={filteredRows}
                scrollRef={listScrollRef}
                selectedIndex={state.selectedIndex}
                title={headerTitle}
            />
        );

        const outputPanel = (
            <OutputPanel
                duration={outputTask?.duration ?? outputTask?.elapsed}
                focused={state.focusedPanel === "output"}
                interactiveMode={state.interactiveMode}
                output={outputContent}
                scrollRef={outputScrollRef}
                showFullscreenHint
                status={outputTask?.status}
                taskId={outputTaskId}
            />
        );

        if (isHorizontal) {
            const taskListWidth = Math.floor(columns * 0.4);

            return (
                <Box flexDirection="column" height={rows} width={columns}>
                    <Box flexDirection="row" flexGrow={1}>
                        <Box width={taskListWidth}>{taskListPanel}</Box>
                        <Box flexGrow={1}>{outputPanel}</Box>
                    </Box>
                    {footer}
                    {quitDialog}
                    {helpPopup}
                </Box>
            );
        }

        // Vertical layout (narrow terminal)
        const listHeight = Math.floor(rows * 0.45);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box height={listHeight}>{taskListPanel}</Box>
                <Box flexGrow={1}>{outputPanel}</Box>
                {footer}
                {quitDialog}
                {helpPopup}
            </Box>
        );
    }

    // ── LIST VIEW (default, full width) ─────────────────────────────

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexGrow={1}>
                <TaskListPanel
                    filterActive={state.filterActive}
                    filterText={state.filterText}
                    focused
                    headerStatus={headerStatus}
                    parallelSlots={parallelSlots}
                    pinnedTaskIds={state.pinnedTaskIds}
                    rows={filteredRows}
                    scrollRef={listScrollRef}
                    selectedIndex={state.selectedIndex}
                    title={headerTitle}
                />
            </Box>
            {footer}
            {quitDialog}
            {helpPopup}
        </Box>
    );
};

export default VisTaskRunnerApp;
