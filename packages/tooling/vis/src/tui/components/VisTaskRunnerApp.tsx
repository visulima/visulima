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
    const [listScrollOffset, setListScrollOffset] = useState(0);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);

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

    // List viewport height for scroll calculation
    const listViewportHeight = Math.max(1, rows - 6);

    // Scroll the task list to keep selected item visible
    // Scroll the task list. The content has a parallel section at the top
    // (parallelSlots + 1 connector line when active), then the flat list rows.
    const scrollListToIndex = useCallback((index: number) => {
        setListScrollOffset((current) => {
            // Item below viewport — scroll down
            if (index >= current + listViewportHeight - 1) {
                return Math.max(0, index - listViewportHeight + 2);
            }

            // Item above viewport — scroll up
            if (index < current) {
                return Math.max(0, index);
            }

            return current;
        });
    }, [listViewportHeight]);

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
                    const next = Math.min(state.selectedIndex + 1, Math.max(0, filteredRows.length - 1));

                    store.setSelectedIndex(next);
                    scrollListToIndex(next);

                    return;
                }

                if (key.upArrow || input === "k") {
                    const next = Math.max(state.selectedIndex - 1, 0);

                    store.setSelectedIndex(next);
                    scrollListToIndex(next);

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

    let footerItems: React.JSX.Element[];

    if (state.done) {
        footerItems = [
            <Box key="q" gap={1}><Text bold color="white">q</Text><Text dimColor>QUIT</Text></Box>,
            <Box key="r" gap={1}><Text bold color="white">r</Text><Text dimColor>RERUN</Text></Box>,
            <Box key="?" gap={1}><Text bold color="white">?</Text><Text dimColor>HELP</Text></Box>,
            <Box key="nav" gap={1}><Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor>NAV</Text></Box>,
            <Box key="status" flexGrow={1} justifyContent="flex-end">
                <Text color={state.failed > 0 ? "red" : "green"}>
                    {state.failed > 0 ? `${state.failed} FAILED` : "DONE"}
                    <Text dimColor>{" \u2014 "}</Text>
                    <Text bold color="white">q</Text>
                    <Text dimColor> TO EXIT</Text>
                </Text>
            </Box>,
        ];
    } else if (state.focusedPanel === "output") {
        footerItems = [
            <Box key="q" gap={1}><Text bold color="white">q</Text><Text dimColor>QUIT</Text></Box>,
            <Box key="esc" gap={1}><Text bold color="white">Esc</Text><Text dimColor>BACK</Text></Box>,
            <Box key="scroll" gap={1}><Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor>SCROLL</Text></Box>,
            <Box key="page" gap={1}><Text bold color="white">^u ^d</Text><Text dimColor>PAGE</Text></Box>,
            <Box key="?" gap={1}><Text bold color="white">?</Text><Text dimColor>HELP</Text></Box>,
        ];
    } else {
        footerItems = [
            <Box key="q" gap={1}><Text bold color="white">q</Text><Text dimColor>QUIT</Text></Box>,
            <Box key="?" gap={1}><Text bold color="white">?</Text><Text dimColor>HELP</Text></Box>,
            <Box key="nav" gap={1}><Text bold color="white">{"\u2191\u2193"}</Text><Text dimColor>NAV</Text></Box>,
            <Box key="/" gap={1}><Text bold color="white">/</Text><Text dimColor>FILTER</Text></Box>,
            <Box key="pin" gap={1}><Text bold color="white">1 2</Text><Text dimColor>PIN</Text></Box>,
            <Box key="enter" gap={1}><Text bold color="white">{"\u23CE"}</Text><Text dimColor>OUTPUT</Text></Box>,
            <Box key="tab" gap={1}><Text bold color="white">Tab</Text><Text dimColor>PANEL</Text></Box>,
        ];
    }

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            <Box paddingX={1} gap={2} flexWrap="wrap">
                {footerItems}
            </Box>
        </Box>
    );

    // ── Help popup overlay ──────────────────────────────────────────

    const helpPopup = (
        <Dialog
            footer={
                <Text dimColor>
                    <Text bold color="white">{"\u2191\u2193"}</Text> scroll  <Text bold color="white">?</Text>/<Text bold color="white">Esc</Text> close
                </Text>
            }
            scrollRef={helpScrollRef}
            title="KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={52}
        >
            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">NAVIGATION</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  {"\u2191"}/k</Text><Text dimColor>  Move up</Text></Text></Box>
                    <Text><Text color="white" bold>  {"\u2193"}/j</Text><Text dimColor>  Move down</Text></Text>
                </Box>
                <Text><Text color="white" bold>  Tab</Text><Text dimColor>    Switch panel</Text></Text>
                <Text><Text color="white" bold>  Esc</Text><Text dimColor>    Back</Text></Text>
                <Text><Text color="white" bold>  Enter</Text><Text dimColor>  View task output</Text></Text>
            </Box>

            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">ACTIONS</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  /</Text><Text dimColor>      Filter tasks</Text></Text></Box>
                    <Text><Text color="white" bold>  0</Text><Text dimColor>  Clear pins</Text></Text>
                </Box>
                <Text><Text color="white" bold>  1</Text><Text dimColor>/</Text><Text color="white" bold>2</Text><Text dimColor>    Pin to output pane</Text></Text>
                <Text><Text color="white" bold>  r</Text><Text dimColor>      Rerun (when done)</Text></Text>
            </Box>

            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">SCROLLING</Text><Text dimColor> (output panel)</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  {"\u2191"}/k</Text><Text dimColor>  Scroll up</Text></Text></Box>
                    <Text><Text color="white" bold>  {"\u2193"}/j</Text><Text dimColor>  Scroll down</Text></Text>
                </Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  ^u</Text><Text dimColor>    Page up</Text></Text></Box>
                    <Text><Text color="white" bold>  ^d</Text><Text dimColor>    Page down</Text></Text>
                </Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  Home</Text><Text dimColor>  Top</Text></Text></Box>
                    <Text><Text color="white" bold>  End</Text><Text dimColor>   Bottom</Text></Text>
                </Box>
            </Box>

            <Box flexDirection="column">
                <Box marginBottom={1}><Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">GENERAL</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="white" bold>  q</Text><Text dimColor>      Quit</Text></Text></Box>
                    <Text><Text color="white" bold>  ?</Text><Text dimColor>  Toggle help</Text></Text>
                </Box>
            </Box>
        </Dialog>
    );

    // ── Quit dialog overlay ───────────────────────────────────────────

    const quitDialog = (
        <QuitDialog
            autoExitSeconds={autoExitSeconds > 0 ? autoExitSeconds : 3}
            onCancel={() => setQuitDialogVisible(false)}
            visible={quitDialogVisible}
        />
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
                            scrollOffset={listScrollOffset}
                            selectedIndex={state.selectedIndex}
                            title={headerTitle}
                            viewportHeight={listViewportHeight}
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
                    scrollOffset={listScrollOffset}
                    selectedIndex={state.selectedIndex}
                    title={headerTitle}
                    viewportHeight={listViewportHeight}
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
