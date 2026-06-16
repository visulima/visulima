/* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- false positive on useSyncExternalStore subscriptions and derived render-time values; the hook contract requires passing subscribe/getSnapshot by reference */
import type { Task } from "@visulima/task-runner";
import { Box } from "@visulima/tui/components/box";
import { Dialog } from "@visulima/tui/components/dialog";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useWindowSize } from "@visulima/tui/hooks/use-window-size";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { renderFailureOutput } from "../failure-render";
import { formatTargetsAndProjects } from "../formatting-utils";
import { formatMs } from "../pretty-time";
import { isCacheStatus } from "../status-utils";
import type { StdinEntry } from "../types";
import OutputPanel from "./output-panel";
import QuitDialog from "./quit-dialog";
import ServiceDock from "./service-dock/service-dock";
import type { ServiceDockStore } from "./service-dock/service-dock-store";
import TaskListPanel from "./task-list-panel";
import type { TaskStore } from "./task-store";

const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;
const MIN_HORIZONTAL_WIDTH = 100;

// Stable empty fallback so `dockIds` references compare equal between
// renders when no dock store is present — keeps the filteredRows memo
// from invalidating on every render in the common no-services case.
const EMPTY_IDS: ReadonlyArray<string> = Object.freeze([]);

interface VisTaskRunnerAppProps {
    /** 0 = no auto-exit (default), >0 = countdown seconds */
    autoExitSeconds: number;
    /** Optional callback fired when the user presses R on a crashed/failed service in the dock. */
    onRetryService?: (id: string) => Promise<void> | void;
    parallelSlots: number;
    projectNames: string[];
    /** Optional dock store; when provided and non-empty, the service dock is rendered. */
    serviceDockStore?: ServiceDockStore | null;
    /** Registry of stdin entries keyed by task ID, for interactive input. */
    stdinRegistry: Map<string, StdinEntry>;
    store: TaskStore;
    targets: string[];
    tasks: Task[];
}

const VisTaskRunnerApp = ({
    autoExitSeconds,
    onRetryService,
    parallelSlots,
    projectNames,
    serviceDockStore,
    stdinRegistry,
    store,
    targets,
    tasks,
}: VisTaskRunnerAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const dockSubscribe = useCallback(
        (listener: () => void): (() => void) => (serviceDockStore ? serviceDockStore.subscribe(listener) : () => {}),
        [serviceDockStore],
    );

    // Re-renders the parent whenever the dock state transitions (boot ↔ ready ↔ crash)
    // so footer hints and Tab-skip behavior stay accurate. ServiceDock has its own
    // subscription for the row-level details.
    useSyncExternalStore(dockSubscribe, () => (serviceDockStore ? serviceDockStore.getDockState() : "ready"));
    const dockIds = serviceDockStore ? serviceDockStore.getIds() : EMPTY_IDS;
    const hasDock = dockIds.length > 0;
    const [dockActiveIndex, setDockActiveIndex] = useState(0);
    const [outputServiceId, setOutputServiceId] = useState<string | null>(null);

    // Subscribe to the *watched* service so each appended log line forces
    // a parent re-render — without this, new lines pile up in the store
    // but the OutputPanel never receives them and `followOutput` has
    // nothing to auto-scroll to. Updates for non-watched services are
    // already covered by ServiceDock's own subscription, so we don't
    // pay for them here.
    const watchedServiceState = useSyncExternalStore(dockSubscribe, () =>
        (outputServiceId && serviceDockStore ? serviceDockStore.getState(outputServiceId) : undefined));

    const [helpVisible, setHelpVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const listScrollRef = useRef<ScrollViewRef>(null);
    const outputScrollRef = useRef<ScrollViewRef>(null);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);
    // Auto-scroll for the output panel. ScrollView's `followOutput` already
    // pauses when the user is not at the bottom, but it auto-resumes the
    // moment they scroll back. Keeping our own bit lets `f` explicitly
    // toggle and lets manual scroll keys disable following until the user
    // opts back in (via `f` or End), which matches `tail -f` / less +F.
    const [autoScroll, setAutoScroll] = useState(true);

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

    // Auto-show the countdown quit dialog when tasks complete — only if
    // autoExit is enabled AND the run was clean. A run with any failure
    // stays open so the user can inspect what broke; the countdown would
    // otherwise close the TUI out from under them.
    const previousDoneRef = useRef(false);

    useEffect(() => {
        if (state.done && !previousDoneRef.current) {
            previousDoneRef.current = true;

            if (autoExitSeconds > 0 && state.failed === 0) {
                setQuitDialogVisible(true);
            }
        }

        if (!state.done && previousDoneRef.current) {
            previousDoneRef.current = false;
            setQuitDialogVisible(false);
        }
    }, [state.done, state.failed, autoExitSeconds]);

    // Filter rows by status and text. Service rows are hidden from the
    // task list because the dock already shows them with richer state
    // (live boot output, port, retry hotkey) — no need to duplicate them
    // and crowd a column the user mostly skims for *their* tasks.
    const filteredRows = useMemo(() => {
        const serviceIdSet = dockIds.length > 0 ? new Set(dockIds) : null;
        const lower = state.filterText ? state.filterText.toLowerCase() : null;
        const filtered: typeof state.rows = [];

        for (const row of state.rows) {
            if (serviceIdSet?.has(row.taskId)) {
                continue;
            }

            if (state.statusFilter === "failed" && row.status !== "failure") {
                continue;
            }

            if (state.statusFilter === "running" && row.status !== "running" && row.status !== "pending") {
                continue;
            }

            if (state.statusFilter === "passed" && row.status !== "success" && !isCacheStatus(row.status)) {
                continue;
            }

            if (lower && !row.taskId.toLowerCase().includes(lower)) {
                continue;
            }

            filtered.push(row);
        }

        return filtered;
    }, [state.rows, state.filterText, state.statusFilter, dockIds]);

    // Get selected task
    const selectedRow = filteredRows[state.selectedIndex] ?? null;
    const selectedTaskId = selectedRow?.taskId ?? null;

    // Output shows selected task content unless a service log stream is pinned.
    const outputTaskId = outputServiceId ? null : (state.pinnedTaskIds[0] ?? selectedTaskId);
    const outputTask = outputTaskId ? state.rows.find((r) => r.taskId === outputTaskId) : null;
    const outputServiceState = watchedServiceState ?? null;
    const rawOutputContent = outputServiceId ? (outputServiceState?.tailLines ?? []).join("\n") : outputTaskId ? (state.outputs.get(outputTaskId) ?? "") : "";
    // Render source-mapped failure block lazily — keeps the store holding
    // raw text so synthetic retry/kill `endTasks` calls round-trip without
    // double-rendering, and dodges the cost on tasks the user never opens.
    const outputContent = useMemo(() => {
        if (outputTask?.status === "failure" && rawOutputContent) {
            return renderFailureOutput(rawOutputContent, { color: !process.env["NO_COLOR"], cwd: process.cwd() });
        }

        return rawOutputContent;
    }, [outputTask?.status, rawOutputContent]);
    const outputDisplayId = outputServiceId ?? outputTaskId;
    const outputDisplayStatus = outputServiceId
        ? outputServiceState?.status === "crashed" || outputServiceState?.status === "failed"
            ? ("failure" as const)
            : ("running" as const)
        : outputTask?.status;

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
        // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent, react-you-might-not-need-an-effect/no-pass-live-state-to-parent -- imperative PTY resize, not parent state
        stdinRegistry.get(outputTaskId)?.resize?.(panelCols, panelRows);
    }, [columns, rows, state.viewMode, outputTaskId]);

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

            if (input === "i" && outputTask?.status === "running") {
                const isOutputView = state.viewMode === "fullscreen" || (state.viewMode === "split" && state.focusedPanel === "output");

                if (isOutputView) {
                    store.setInteractiveMode(true);

                    return;
                }
            }

            if (state.viewMode === "fullscreen") {
                if (key.escape) {
                    store.setViewMode("split");
                    restoreScrollPositions("split");

                    return;
                }

                // Toggle auto-scroll. Re-enabling jumps to the latest output
                // so the user sees what they were missing. The scroll side
                // effect lives outside the updater so strict-mode re-runs
                // don't double-call the imperative ref.
                if (input === "f") {
                    const willEnable = !autoScroll;

                    setAutoScroll(willEnable);

                    if (willEnable) {
                        outputScrollRef.current?.scrollToBottom();
                    }

                    return;
                }

                // Scroll output — manual movement opts out of auto-scroll
                if (key.downArrow || input === "j") {
                    setAutoScroll(false);
                    outputScrollRef.current?.scrollBy(1);

                    return;
                }

                if (key.upArrow || input === "k") {
                    setAutoScroll(false);
                    outputScrollRef.current?.scrollBy(-1);

                    return;
                }

                if (key.pageDown || (key.ctrl && input === "d")) {
                    setAutoScroll(false);
                    outputScrollRef.current?.scrollBy(12);

                    return;
                }

                if (key.pageUp || (key.ctrl && input === "u")) {
                    setAutoScroll(false);
                    outputScrollRef.current?.scrollBy(-12);

                    return;
                }

                if (key.home) {
                    setAutoScroll(false);
                    outputScrollRef.current?.scrollToTop();

                    return;
                }

                if (key.end) {
                    setAutoScroll(true);
                    outputScrollRef.current?.scrollToBottom();

                    return;
                }

                return;
            }

            if (state.focusedPanel === "dock" && hasDock && serviceDockStore) {
                if (key.tab) {
                    // Leaving the dock for the task list: drop any
                    // service-log binding so the right pane reverts to
                    // the selected task instead of staying stuck on the
                    // service the user was previously inspecting.
                    setOutputServiceId(null);
                    store.setFocusedPanel("tasks");

                    return;
                }

                if (key.escape) {
                    store.setFocusedPanel("tasks");
                    setOutputServiceId(null);

                    if (state.viewMode === "split") {
                        store.setViewMode("list");
                        restoreScrollPositions("list");
                    }

                    return;
                }

                if (key.downArrow || input === "j") {
                    setDockActiveIndex((current) => Math.min(current + 1, dockIds.length - 1));

                    return;
                }

                if (key.upArrow || input === "k") {
                    setDockActiveIndex((current) => Math.max(current - 1, 0));

                    return;
                }

                if (key.return) {
                    const id = dockIds[dockActiveIndex];

                    if (id) {
                        setOutputServiceId(id);
                        setAutoScroll(true);
                        saveScrollPositions();
                        savedScrollRef.current.splitList = 0;
                        savedScrollRef.current.splitOutput = 0;
                        store.setViewMode("split");
                        store.setFocusedPanel("output");
                        restoreScrollPositions("split");
                    }

                    return;
                }

                if ((input === "r" || input === "R") && onRetryService) {
                    const id = dockIds[dockActiveIndex];
                    const status = id ? serviceDockStore.getState(id)?.status : undefined;

                    if (id && (status === "crashed" || status === "failed")) {
                        const result = onRetryService(id);

                        if (result instanceof Promise) {
                            result.catch(() => {});
                        }
                    }

                    return;
                }

                return;
            }

            if (state.viewMode === "split") {
                // Tab switches focus between panels
                if (key.tab) {
                    if (state.focusedPanel === "tasks") {
                        store.setFocusedPanel("output");
                    } else if (hasDock) {
                        store.setFocusedPanel("dock");
                    } else {
                        // No dock to detour through; output → tasks. Clear
                        // any service binding so output follows the task.
                        setOutputServiceId(null);
                        store.setFocusedPanel("tasks");
                    }

                    return;
                }

                if (state.focusedPanel === "output") {
                    if (key.escape) {
                        // Returning to where the user came from: a service
                        // log split was opened from the dock, so Esc takes
                        // them back to the dock (not the task list, which
                        // they never visited). Other splits keep the
                        // existing tasks-focus fallback.
                        if (outputServiceId && hasDock) {
                            setOutputServiceId(null);
                            store.setViewMode("list");
                            store.setFocusedPanel("dock");
                            restoreScrollPositions("list");

                            return;
                        }

                        // Esc into the task list — also drop the service
                        // binding so the user lands on a task-driven split.
                        setOutputServiceId(null);
                        store.setFocusedPanel("tasks");

                        return;
                    }

                    // Enter in output panel → fullscreen
                    if (key.return) {
                        saveScrollPositions();
                        store.setViewMode("fullscreen");

                        return;
                    }

                    // Toggle auto-scroll. Re-enabling jumps to the latest
                    // output. Side effect lives outside the updater so
                    // strict-mode re-runs don't double-call the imperative
                    // ref.
                    if (input === "f") {
                        const willEnable = !autoScroll;

                        setAutoScroll(willEnable);

                        if (willEnable) {
                            outputScrollRef.current?.scrollToBottom();
                        }

                        return;
                    }

                    // Scroll output — manual movement opts out of auto-scroll
                    if (key.downArrow || input === "j") {
                        setAutoScroll(false);
                        outputScrollRef.current?.scrollBy(1);

                        return;
                    }

                    if (key.upArrow || input === "k") {
                        setAutoScroll(false);
                        outputScrollRef.current?.scrollBy(-1);

                        return;
                    }

                    if (key.pageDown || (key.ctrl && input === "d")) {
                        setAutoScroll(false);
                        outputScrollRef.current?.scrollBy(12);

                        return;
                    }

                    if (key.pageUp || (key.ctrl && input === "u")) {
                        setAutoScroll(false);
                        outputScrollRef.current?.scrollBy(-12);

                        return;
                    }

                    if (key.home) {
                        setAutoScroll(false);
                        outputScrollRef.current?.scrollToTop();

                        return;
                    }

                    if (key.end) {
                        setAutoScroll(true);
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

            if (state.viewMode === "list" || (state.viewMode === "split" && state.focusedPanel === "tasks")) {
                // In list view, Tab into the dock when present.
                if (key.tab && state.viewMode === "list" && hasDock) {
                    store.setFocusedPanel("dock");

                    return;
                }

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
                    setAutoScroll(true);
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

    const statusSummary = (
        <Box gap={1}>
            {state.succeeded > 0 && (
                <Text bold color="green">
                    {"\u2713"}
{" "}
{state.succeeded}
                </Text>
            )}
            {state.cached > 0 && (
                <Text dimColor>
                    {"\u2713"}
{" "}
{state.cached}
                </Text>
            )}
            {state.failed > 0 && (
                <Text bold color="red">
                    {"\u2717"}
{" "}
{state.failed}
                </Text>
            )}
            {state.running > 0 && (
                <Text color="cyan">
                    {"\u25F7"}
{" "}
{state.running}
                </Text>
            )}
            <Text dimColor>
{state.totalTasks}
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
                        <Text dimColor> Bottom (resume follow)</Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        f
                    </Text>
                    <Text dimColor> Toggle auto-scroll (tail mode)</Text>
                </Text>
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

    const quitDialog = (
        <QuitDialog
            autoExitSeconds={autoExitSeconds > 0 ? autoExitSeconds : 3}
            onCancel={() => {
                setQuitDialogVisible(false);
            }}
            visible={quitDialogVisible}
        />
    );

    const dockElement
        = hasDock && serviceDockStore ? <ServiceDock activeIndex={dockActiveIndex} focused={state.focusedPanel === "dock"} store={serviceDockStore} /> : null;

    if (state.viewMode === "fullscreen") {
        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexGrow={1}>
                    <OutputPanel
                        autoScroll={autoScroll}
                        duration={outputTask?.duration ?? outputTask?.elapsed}
                        focused
                        interactiveMode={state.interactiveMode}
                        output={outputContent}
                        scrollRef={outputScrollRef}
                        status={outputDisplayStatus}
                        supportsInteractive={!outputServiceId}
                        taskId={outputDisplayId}
                    />
                </Box>
                {dockElement}
                {footer}
                {quitDialog}
                {helpPopup}
            </Box>
        );
    }

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
                autoScroll={autoScroll}
                duration={outputTask?.duration ?? outputTask?.elapsed}
                focused={state.focusedPanel === "output"}
                interactiveMode={state.interactiveMode}
                output={outputContent}
                scrollRef={outputScrollRef}
                showFullscreenHint
                status={outputDisplayStatus}
                supportsInteractive={!outputServiceId}
                taskId={outputDisplayId}
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
                    {dockElement}
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
                {dockElement}
                {footer}
                {quitDialog}
                {helpPopup}
            </Box>
        );
    }

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexGrow={1}>
                <TaskListPanel
                    filterActive={state.filterActive}
                    filterText={state.filterText}
                    focused={state.focusedPanel !== "dock"}
                    headerStatus={headerStatus}
                    parallelSlots={parallelSlots}
                    pinnedTaskIds={state.pinnedTaskIds}
                    rows={filteredRows}
                    scrollRef={listScrollRef}
                    selectedIndex={state.selectedIndex}
                    title={headerTitle}
                />
            </Box>
            {dockElement}
            {footer}
            {quitDialog}
            {helpPopup}
        </Box>
    );
};

export default VisTaskRunnerApp;
