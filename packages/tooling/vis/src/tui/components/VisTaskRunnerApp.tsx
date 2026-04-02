import type { Task } from "@visulima/task-runner";
import type { ScrollViewRef } from "@visulima/tui";
import { Box, Dialog, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { formatTargetsAndProjects } from "../formatting-utils";
import { formatMs } from "../pretty-time";
import OutputPanel from "./OutputPanel";
import QuitDialog from "./QuitDialog";
import TaskListPanel from "./TaskListPanel";
import type { TaskStore } from "./TaskStore";

// ── Layout constants (matching Nx layout_manager.rs) ────────────────────

const MIN_HORIZONTAL_WIDTH = 120;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;

// ── Component ───────────────────────────────────────────────────────────

interface VisTaskRunnerAppProps {
    /** 0 = no auto-exit (default), >0 = countdown seconds */
    autoExitSeconds: number;
    parallelSlots: number;
    projectNames: string[];
    store: TaskStore;
    targets: string[];
    tasks: Task[];
}

const VisTaskRunnerApp = ({ autoExitSeconds, parallelSlots, projectNames, store, targets, tasks }: VisTaskRunnerAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const outputScrollRef = useRef<ScrollViewRef>(null);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);
    const [quitCountdown, setQuitCountdown] = useState(autoExitSeconds || 3);
    const quitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const quitDialogOpenedAtRef = useRef(0);

    // Auto-show quit dialog when tasks complete — only if autoExit is enabled
    const previousDoneRef = useRef(false);

    useEffect(() => {
        if (state.done && !previousDoneRef.current) {
            previousDoneRef.current = true;

            if (autoExitSeconds > 0) {
                setQuitDialogVisible(true);
                setQuitCountdown(autoExitSeconds);
                quitDialogOpenedAtRef.current = Date.now();
            }
        }

        if (!state.done && previousDoneRef.current) {
            // Rerun happened — reset
            previousDoneRef.current = false;
            setQuitDialogVisible(false);

            if (quitTimerRef.current) {
                clearInterval(quitTimerRef.current);
                quitTimerRef.current = null;
            }
        }
    }, [state.done, autoExitSeconds]);

    // Quit countdown timer
    useEffect(() => {
        if (quitDialogVisible && !quitTimerRef.current) {
            quitTimerRef.current = setInterval(() => {
                setQuitCountdown((c) => c - 1);
            }, 1000);
        }

        return () => {
            if (quitTimerRef.current) {
                clearInterval(quitTimerRef.current);
                quitTimerRef.current = null;
            }
        };
    }, [quitDialogVisible]);

    // Exit when countdown reaches 0 (separate effect to avoid state update during render)
    useEffect(() => {
        if (quitCountdown <= 0 && quitDialogVisible) {
            if (quitTimerRef.current) {
                clearInterval(quitTimerRef.current);
                quitTimerRef.current = null;
            }

            exit();
        }
    }, [quitCountdown, quitDialogVisible, exit]);

    const cancelQuitDialog = useCallback(() => {
        setQuitDialogVisible(false);

        if (quitTimerRef.current) {
            clearInterval(quitTimerRef.current);
            quitTimerRef.current = null;
        }
    }, []);

    // Filter rows
    const filteredRows = useMemo(() => {
        if (!state.filterText) {
            return state.rows;
        }

        const lower = state.filterText.toLowerCase();

        return state.rows.filter((r) => r.taskId.toLowerCase().includes(lower));
    }, [state.rows, state.filterText]);

    // Get selected task — always show output for selected task
    const selectedRow = filteredRows[state.selectedIndex] ?? null;
    const selectedTaskId = selectedRow?.taskId ?? null;

    // Output shows: pinned task if any, otherwise selected task
    const outputTaskId = state.pinnedTaskIds[0] ?? selectedTaskId;
    const outputTask = outputTaskId ? state.rows.find((r) => r.taskId === outputTaskId) : null;
    const outputContent = outputTaskId ? state.outputs.get(outputTaskId) ?? "" : "";


    // Header title and status
    const description = formatTargetsAndProjects(projectNames, targets, tasks);
    const headerTitle = state.done ? `Completed ${description} (${formatMs(Date.now() - state.startTime)})` : `Running ${description}...`;
    const headerStatus: "error" | "running" | "success" = state.done ? state.failed > 0 ? "error" : "success" : "running";

    // ── Keyboard handling ───────────────────────────────────────────

    useInput(
        (input, key) => {
            // Ctrl+C: always exit immediately
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            // Quit dialog: q exits, anything else cancels
            // Ignore keypresses within 200ms of opening (debounce the `q` that opened it)
            if (quitDialogVisible) {
                if (Date.now() - quitDialogOpenedAtRef.current < 200) {
                    return;
                }

                if (input === "q") {
                    exit();
                } else {
                    cancelQuitDialog();
                }

                return;
            }

            // Help popup: scroll with arrows, close with esc/?, quit with q
            if (helpVisible) {
                if (key.escape || input === "?") {
                    setHelpVisible(false);
                } else if (input === "q") {
                    setHelpVisible(false);
                    setQuitDialogVisible(true);
                    setQuitCountdown(autoExitSeconds > 0 ? autoExitSeconds : 3);
                    quitDialogOpenedAtRef.current = Date.now();
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
                setQuitCountdown(autoExitSeconds > 0 ? autoExitSeconds : 3);
                quitDialogOpenedAtRef.current = Date.now();

                return;
            }

            // Global: rerun (only when done)
            if (input === "r" && state.done) {
                store.requestRerun();

                return;
            }

            // Global: Tab / Shift+Tab to cycle focus
            if (key.tab) {
                const nextPanel = state.focusedPanel === "tasks" ? "output" : "tasks";

                store.setFocusedPanel(nextPanel);

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

            // ── Task list focused ───────────────────────────────────
            if (state.focusedPanel === "tasks") {
                // Navigation
                if (key.downArrow || input === "j") {
                    const maxIndex = Math.max(0, filteredRows.length - 1);

                    store.setSelectedIndex(Math.min(state.selectedIndex + 1, maxIndex));

                    return;
                }

                if (key.upArrow || input === "k") {
                    store.setSelectedIndex(Math.max(state.selectedIndex - 1, 0));

                    return;
                }

                // Enter: focus output panel for selected task
                if (key.return) {
                    store.setFocusedPanel("output");

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

                // Escape: clear filter
                if (key.escape) {
                    if (state.filterText) {
                        store.setFilterActive(false);
                    }

                    return;
                }

                return;
            }

            // ── Output panel focused ────────────────────────────────
            if (state.focusedPanel === "output") {
                if (key.escape) {
                    store.setFocusedPanel("tasks");

                    return;
                }

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
            }
        },
        { isActive: true },
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

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

    // ── Footer bar (full-width, below both panels) ──────────────────

    let footerContent: React.JSX.Element;

    if (state.done) {
        footerContent = (
            <Box justifyContent="space-between" paddingX={1}>
                <Box gap={1}>
                    <Text bold color="white">q</Text><Text dimColor> QUIT</Text>
                    <Text dimColor>{" \u00B7 "}</Text>
                    <Text bold color="white">r</Text><Text dimColor> RERUN</Text>
                    <Text dimColor>{" \u00B7 "}</Text>
                    <Text bold color="white">?</Text><Text dimColor> HELP</Text>
                    <Text dimColor>{" \u00B7 "}</Text>
                    <Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor> NAV</Text>
                </Box>
                <Text color={state.failed > 0 ? "red" : "green"}>
                    {state.failed > 0 ? `${state.failed} FAILED` : "DONE"}
                    <Text dimColor>{" \u2014 "}</Text>
                    <Text bold color="white">q</Text>
                    <Text dimColor> TO EXIT</Text>
                </Text>
            </Box>
        );
    } else if (state.focusedPanel === "output") {
        footerContent = (
            <Box gap={1} paddingX={1}>
                <Text bold color="white">q</Text><Text dimColor> QUIT</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">Esc</Text><Text dimColor> BACK</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor> SCROLL</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">^u ^d</Text><Text dimColor> PAGE</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">?</Text><Text dimColor> HELP</Text>
            </Box>
        );
    } else {
        footerContent = (
            <Box gap={1} paddingX={1}>
                <Text bold color="white">q</Text><Text dimColor> QUIT</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">?</Text><Text dimColor> HELP</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor> NAV</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">/</Text><Text dimColor> FILTER</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">1 2</Text><Text dimColor> PIN</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">{"\u23CE"}</Text><Text dimColor> OUTPUT</Text>
                <Text dimColor>{" \u00B7 "}</Text>
                <Text bold color="white">Tab</Text><Text dimColor> PANEL</Text>
            </Box>
        );
    }

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            {footerContent}
        </Box>
    );

    // ── Help popup overlay ──────────────────────────────────────────

    const helpPopup = (
        <Dialog
            footer={(
                <Text dimColor>
                    <Text bold color="white">{"\u2191\u2193"}</Text>
                    {" scroll  "}
                    <Text bold color="white">?</Text>
                    /
                    <Text bold color="white">Esc</Text>
                    {" close  "}
                    <Text bold color="white">q</Text>
                    {" quit"}
                </Text>
            )}
            scrollRef={helpScrollRef}
            title="KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={56}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>
                        {"\u2500\u2500 "}
                    </Text>
                    <Text bold color="white">NAVIGATION</Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {"  \u2191"}
                            </Text>
                            <Text dimColor>/</Text>
                            <Text bold color="white">
                                k
                            </Text>
                            <Text dimColor>
                                {" Move up"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {"  \u2193"}
                        </Text>
                        <Text dimColor>/</Text>
                        <Text bold color="white">
                            j
                        </Text>
                        <Text dimColor>
                            {" Move down"}
                        </Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                Tab
                            </Text>
                            <Text dimColor>
                                {" Switch panel"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            Esc
                        </Text>
                        <Text dimColor>
                            {" Back"}
                        </Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Enter
                    </Text>
                    <Text dimColor>
                        {" View task output"}
                    </Text>
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>
                        {"\u2500\u2500 "}
                    </Text>
                    <Text bold color="white">ACTIONS</Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                /
                            </Text>
                            <Text dimColor>
                                {" Filter tasks"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            0
                        </Text>
                        <Text dimColor>
                            {" Clear pins"}
                        </Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        1
                    </Text>
                    <Text dimColor>/</Text>
                    <Text bold color="white">
                        2
                    </Text>
                    <Text dimColor>
                        {" Pin to output pane"}
                    </Text>
                </Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>
                        {"\u2500\u2500 "}
                    </Text>
                    <Text bold color="white">SCROLLING</Text>
                    <Text dimColor>{" (output panel)"}</Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {"  \u2191"}
                            </Text>
                            <Text dimColor>/</Text>
                            <Text bold color="white">
                                k
                            </Text>
                            <Text dimColor>
                                {" Scroll up"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {"  \u2193"}
                        </Text>
                        <Text dimColor>/</Text>
                        <Text bold color="white">
                            j
                        </Text>
                        <Text dimColor>
                            {" Scroll down"}
                        </Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                ^u
                            </Text>
                            <Text dimColor>
                                {" Page up"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            ^d
                        </Text>
                        <Text dimColor>
                            {" Page down"}
                        </Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                Home
                            </Text>
                            <Text dimColor>
                                {" Top"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            End
                        </Text>
                        <Text dimColor>
                            {" Bottom"}
                        </Text>
                    </Text>
                </Box>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>
                        {"\u2500\u2500 "}
                    </Text>
                    <Text bold color="white">GENERAL</Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                q
                            </Text>
                            <Text dimColor>
                                {" Quit"}
                            </Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            ?
                        </Text>
                        <Text dimColor>
                            {" Toggle help"}
                        </Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        r
                    </Text>
                    <Text dimColor>
                        {" Rerun"}
                    </Text>
                    {" "}
                    <Text dimColor>(when done)</Text>
                </Text>
            </Box>
        </Dialog>
    );

    // ── Quit dialog overlay ───────────────────────────────────────────

    const quitDialog = (
        <Dialog visible={quitDialogVisible} width={62}>
            <QuitDialog countdown={quitCountdown} />
        </Dialog>
    );

    // ── Horizontal layout (side by side) ────────────────────────────

    if (isHorizontal) {
        const taskListWidth = Math.floor(columns * 0.6);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexDirection="row" flexGrow={1}>
                    <Box width={taskListWidth}>
                        <TaskListPanel
                            filterActive={state.filterActive}
                            filterText={state.filterText}
                            focused={state.focusedPanel === "tasks"}
                            headerStatus={headerStatus}
                            parallelSlots={parallelSlots}
                            pinnedTaskIds={state.pinnedTaskIds}
                            rows={filteredRows}
                            selectedIndex={state.selectedIndex}
                            title={headerTitle}
                        />
                    </Box>
                    <Box flexGrow={1}>
                        <OutputPanel
                            focused={state.focusedPanel === "output"}
                            output={outputContent}
                            scrollRef={outputScrollRef}
                            status={outputTask?.status}
                            taskId={outputTaskId}
                        />
                    </Box>
                </Box>
                {footer}
                {quitDialog}
                {helpPopup}
            </Box>
        );
    }

    // ── Vertical layout (stacked) ───────────────────────────────────

    const taskListHeight = Math.floor((rows * 2) / 5);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box height={taskListHeight}>
                <TaskListPanel
                    filterActive={state.filterActive}
                    filterText={state.filterText}
                    focused={state.focusedPanel === "tasks"}
                    headerStatus={headerStatus}
                    parallelSlots={parallelSlots}
                    pinnedTaskIds={state.pinnedTaskIds}
                    rows={filteredRows}
                    selectedIndex={state.selectedIndex}
                    title={headerTitle}
                />
            </Box>
            <Box flexGrow={1}>
                <OutputPanel
                    focused={state.focusedPanel === "output"}
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
};

export default VisTaskRunnerApp;
