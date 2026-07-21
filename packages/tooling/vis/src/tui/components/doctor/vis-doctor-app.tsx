import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useWindowSize } from "@visulima/tui/hooks/use-window-size";
import { Dialog } from "@visulima/tui-kit/dialog";
import type { ScrollViewRef } from "@visulima/tui-kit/scroll-view";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { ConfigBannerSeverity } from "../config-banner";
import ConfigBanner from "../config-banner";
import QuitDialog from "../quit-dialog";
import DoctorDetailPanel from "./doctor-detail-panel";
import DoctorListPanel from "./doctor-list-panel";
import type { DoctorStore, FilterType, PendingAction } from "./doctor-store";
import { FILTER_TABS } from "./doctor-store";
import type { DoctorFinding } from "./findings";

const buildUpdateAction = (finding: DoctorFinding): PendingAction | undefined => {
    if (finding.kind === "outdated") {
        return {
            command: `vis update ${finding.entry.packageName}`,
            description: `Update ${finding.entry.packageName} to ${finding.entry.newRange}`,
        };
    }

    if (finding.kind === "duplicate") {
        return {
            command: `vis dedupe ${finding.pkg.name}`,
            description: `Dedupe ${finding.pkg.name} (${String(finding.pkg.versions.length)} versions)`,
        };
    }

    return undefined;
};

const buildOptimizeAction = (finding: DoctorFinding): PendingAction | undefined => {
    if (finding.kind !== "optimization") {
        return undefined;
    }

    return {
        command: `vis optimize ${finding.entry.packageName}`,
        description: `Replace ${finding.entry.packageName} with ${finding.entry.replacement}`,
    };
};

const buildAckAction = (finding: DoctorFinding): PendingAction | undefined => {
    if (finding.kind !== "outdated" && finding.kind !== "vulnerability" && finding.kind !== "socket") {
        return undefined;
    }

    const pkg = finding.kind === "outdated" ? finding.entry.packageName : finding.packageName;

    const snippet = [
        "// Add to vis.config.ts:",
        "security: {",
        "    acceptedRisks: {",
        `        "${pkg}": {`,
        "            reason: \"explain why this risk is acceptable\",",
        "            expiresAt: \"YYYY-MM-DD\",",
        "        },",
        "    },",
        "},",
    ].join("\n");

    return {
        command: snippet,
        configSnippet: snippet,
        description: `Acknowledge risk for ${pkg}`,
    };
};

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;

export interface DoctorBannerInput {
    hint?: string;
    message: string;
    severity: ConfigBannerSeverity;
    title: string;
}

interface VisDoctorAppProps {
    /** 0 = no auto-exit (default), >0 = countdown seconds. */
    autoExitSeconds?: number;
    /** Optional banner shown above the layout (e.g. config load errors). */
    banner?: DoctorBannerInput;

    /**
     * Findings were seeded from the on-disk doctor cache rather than a
     * fresh scan. Surface a "(cached)" pill so the user knows to use
     * `--no-cache` if they want a re-scan.
     */
    fromCache?: boolean;
    /** Wall-clock start time — TUI ticks live elapsed off this. */
    startedAt: number;
    store: DoctorStore;
}

/**
 * Top-level interactive TUI for `vis doctor`. Mirrors `VisUpdateApp`'s
 * shape: list pane + detail pane + footer + help/quit dialogs, with a
 * horizontal layout above {@link MIN_HORIZONTAL_WIDTH} and a stacked
 * vertical layout below it. Doctor is read-only — the app exits cleanly
 * and the handler prints the existing summary block.
 */
const VisDoctorApp = ({ autoExitSeconds = 0, banner, fromCache = false, startedAt, store }: VisDoctorAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);
    const [listScrollOffset, setListScrollOffset] = useState(0);
    const [now, setNow] = useState(() => Date.now());

    // Re-render once a second so the header timer keeps ticking while
    // scans stream in. The interval is cheap relative to the work it
    // surfaces.
    useEffect(() => {
        const id = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            clearInterval(id);
        };
    }, []);

    const elapsedMs = now - startedAt;
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const detailScrollRef = useRef<ScrollViewRef>(null);

    const selectedFinding = state.entries[state.selectedIndex] ?? null;

    const sectionCounts = useMemo<Record<FilterType, number>>(() => {
        const counts: Record<FilterType, number> = {
            dependencies: 0,
            optimization: 0,
            runtime: 0,
            security: 0,
        };

        for (const finding of state.all) {
            counts[finding.section] += 1;
        }

        return counts;
    }, [state.all]);

    // ConfigBanner: 2 rows of border + 1 (title) + 1 (message) + 1 (hint, optional).
    const bannerHeight = banner ? (banner.hint ? 5 : 4) : 0;

    // Activity line renders when at least one section is running with a
    // non-empty message. Reserving the row keeps the list viewport stable
    // as scans complete (avoids a 1-row layout jump).
    const activityLineHeight = useMemo(() => {
        for (const id of Object.keys(state.sectionStatus) as (keyof typeof state.sectionStatus)[]) {
            if (state.sectionStatus[id] === "running" && state.sectionMessage[id]) {
                return 1;
            }
        }

        return 0;
    }, [state.sectionStatus, state.sectionMessage]);

    // Layout-aware viewport. Horizontal: panel fills `rows - banner - footer(2)`,
    // panel internals consume border(2) + header(1) + tabs(3) = 6 fixed rows,
    // plus activity(0/1) + filter(0/1) conditional rows. Vertical: panel
    // height is `floor(rows * 0.55)` and the banner / footer don't subtract
    // from it (they live above/below in the column flex).
    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;
    const listPanelHeight = isHorizontal ? Math.max(1, rows - bannerHeight - 2) : Math.floor(rows * 0.55);
    const estimatedViewportHeight = Math.max(1, listPanelHeight - 6 - activityLineHeight - (state.filterActive ? 1 : 0));

    // The list panel reports its actual measured content-row height via
    // `onViewportHeightChange`. Use it for scroll math so navigation
    // (max offset, scrollToIndex) stays in lockstep with the rendered
    // viewport — even when the JS estimate above is off (e.g. wrapped
    // header, padding rounding). Falls back to the estimate before the
    // first measurement lands.
    const [measuredViewportHeight, setMeasuredViewportHeight] = useState(estimatedViewportHeight);
    const listViewportHeight = measuredViewportHeight > 0 ? measuredViewportHeight : estimatedViewportHeight;

    // Total rendered height of the list rows (each section header = 2 rows
    // due to its marginTop, each finding = 1 row). Used to clamp scroll
    // so the scrollbar thumb and the visible row of the selection stay in
    // sync — without the clamp the offset can overshoot maxScrollOffset
    // when navigating to the last finding, leaving an empty row at the
    // bottom of the viewport while the scrollbar pins to the floor.
    const contentHeight = useMemo(() => {
        let height = 0;

        for (const [, items] of state.grouped) {
            height += 2 + items.length;
        }

        return height;
    }, [state.grouped]);

    const maxScrollOffset = Math.max(0, contentHeight - listViewportHeight);
    const clampedListScrollOffset = Math.min(listScrollOffset, maxScrollOffset);

    // Each section header = 2 rows (marginTop + text), each finding = 1 row.
    const getRowForIndex = useCallback(
        (index: number): number => {
            let row = 0;
            let count = 0;

            for (const [, items] of state.grouped) {
                row += 2;

                for (let i = 0; i < items.length; i++) {
                    if (count === index) {
                        return row;
                    }

                    row += 1;
                    count += 1;
                }
            }

            return row;
        },
        [state.grouped],
    );

    const scrollToIndex = useCallback(
        (index: number) => {
            const targetRow = getRowForIndex(index);

            setListScrollOffset((current) => {
                if (targetRow > current + listViewportHeight - 2) {
                    return Math.min(maxScrollOffset, Math.max(0, targetRow - listViewportHeight + 2));
                }

                if (targetRow < current + 1) {
                    return Math.max(0, targetRow - 1);
                }

                return current;
            });
        },
        [getRowForIndex, listViewportHeight, maxScrollOffset],
    );

    useEffect(() => {
        detailScrollRef.current?.scrollToTop();
    }, [selectedFinding?.id]);

    useInput(
        (input, key) => {
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            if (quitDialogVisible) {
                return;
            }

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
                }

                return;
            }

            if (input === "?") {
                setHelpVisible(true);

                return;
            }

            if (input === "q") {
                setQuitDialogVisible(true);

                return;
            }

            if (key.tab) {
                store.setFocusedPanel(state.focusedPanel === "list" ? "detail" : "list");

                return;
            }

            // Filter mode capture
            if (state.filterActive) {
                if (key.escape || key.return) {
                    store.setFilterActive(false);

                    return;
                }

                if (key.backspace) {
                    setListScrollOffset(0);
                    store.setFilter(state.filterText.slice(0, -1));

                    return;
                }

                if (input && !key.ctrl && !key.meta) {
                    setListScrollOffset(0);
                    store.setFilter(state.filterText + input);
                }

                return;
            }

            // Section tabs (left/right arrows when list focused)
            if (state.focusedPanel === "list" && (key.leftArrow || key.rightArrow)) {
                const currentIndex = FILTER_TABS.findIndex((tab) => tab.id === state.filterType);
                const nextIndex = key.rightArrow ? (currentIndex + 1) % FILTER_TABS.length : (currentIndex - 1 + FILTER_TABS.length) % FILTER_TABS.length;

                setListScrollOffset(0);
                detailScrollRef.current?.scrollToTop();
                store.setFilterType(FILTER_TABS[nextIndex]!.id);

                return;
            }

            if (state.focusedPanel === "list") {
                if (key.downArrow || input === "j") {
                    const next = Math.min(state.selectedIndex + 1, state.entries.length - 1);

                    store.setSelectedIndex(next);
                    scrollToIndex(next);

                    return;
                }

                if (key.upArrow || input === "k") {
                    const next = Math.max(state.selectedIndex - 1, 0);

                    store.setSelectedIndex(next);
                    scrollToIndex(next);

                    return;
                }

                if (key.pageDown) {
                    const next = Math.min(state.selectedIndex + 10, state.entries.length - 1);

                    store.setSelectedIndex(next);
                    scrollToIndex(next);

                    return;
                }

                if (key.pageUp) {
                    const next = Math.max(state.selectedIndex - 10, 0);

                    store.setSelectedIndex(next);
                    scrollToIndex(next);

                    return;
                }

                if (key.home) {
                    store.setSelectedIndex(0);
                    setListScrollOffset(0);

                    return;
                }

                if (key.end) {
                    const last = state.entries.length - 1;

                    store.setSelectedIndex(last);
                    scrollToIndex(last);

                    return;
                }

                if (input === "/") {
                    store.setFilterActive(true);

                    return;
                }

                if (input === "e") {
                    store.setSeverityFilter(state.severityFilter === "error" ? undefined : "error");
                    setListScrollOffset(0);

                    return;
                }

                if (input === "w") {
                    store.setSeverityFilter(state.severityFilter === "warn" ? undefined : "warn");
                    setListScrollOffset(0);

                    return;
                }

                if (input === "u" && selectedFinding) {
                    const action = buildUpdateAction(selectedFinding);

                    if (action) {
                        store.setPendingAction(action);
                        exit();
                    }

                    return;
                }

                if (input === "o" && selectedFinding) {
                    const action = buildOptimizeAction(selectedFinding);

                    if (action) {
                        store.setPendingAction(action);
                        exit();
                    }

                    return;
                }

                if (input === "a" && selectedFinding) {
                    const action = buildAckAction(selectedFinding);

                    if (action) {
                        store.setPendingAction(action);
                        exit();
                    }

                    return;
                }

                if (input === "d") {
                    store.setFocusedPanel("detail");

                    return;
                }

                return;
            }

            // Detail panel focused
            if (key.escape || key.leftArrow) {
                store.setFocusedPanel("list");

                return;
            }

            if (key.downArrow || input === "j") {
                detailScrollRef.current?.scrollBy(1);

                return;
            }

            if (key.upArrow || input === "k") {
                detailScrollRef.current?.scrollBy(-1);

                return;
            }

            if (key.pageDown) {
                detailScrollRef.current?.scrollBy(10);

                return;
            }

            if (key.pageUp) {
                detailScrollRef.current?.scrollBy(-10);

                return;
            }

            if (key.home) {
                detailScrollRef.current?.scrollToTop();

                return;
            }

            if (key.end) {
                detailScrollRef.current?.scrollToBottom();
            }
        },
        { isActive: true },
    );

    if (columns < MIN_VIEWPORT_WIDTH || rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" height={rows} justifyContent="center" width={columns}>
                <Text color="yellow">
                    Terminal too small (
{columns}
x
{rows}
)
                </Text>
            </Box>
        );
    }

    const detailFocused = state.focusedPanel === "detail";

    const footerItems: React.JSX.Element[] = [
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
                ↑↓
            </Text>
            <Text dimColor>{detailFocused ? "SCROLL" : "NAV"}</Text>
        </Box>,
        detailFocused
            ? (
            <Box gap={1} key="lr">
                <Text bold color="white">
                    ←/Esc
                </Text>
                <Text dimColor>LIST</Text>
            </Box>
            )
            : (
            <Box gap={1} key="lr">
                <Text bold color="white">
                    ←→
                </Text>
                <Text dimColor>SECTION</Text>
            </Box>
            ),
        <Box gap={1} key="search">
            <Text bold color="white">
                /
            </Text>
            <Text dimColor>SEARCH</Text>
        </Box>,
        <Box gap={1} key="sev">
            <Text bold color="white">
                e/w
            </Text>
            <Text dimColor>SEVERITY</Text>
        </Box>,
        <Box gap={1} key="actions">
            <Text bold color="white">
                u/o/a
            </Text>
            <Text dimColor>ACTION</Text>
        </Box>,
        <Box gap={1} key="tab">
            <Text bold color="white">
                Tab
            </Text>
            <Text dimColor>PANEL</Text>
        </Box>,
    ];

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            <Box gap={2} overflow="hidden" paddingX={1}>
                {footerItems}
            </Box>
        </Box>
    );

    const helpPopup = (
        <Dialog
            footer={(
                <Text dimColor>
                    <Text bold color="white">
                        ↑↓
                    </Text>
                    {" scroll  "}
                    <Text bold color="white">
                        ?
                    </Text>
                    /
                    <Text bold color="white">
                        Esc
                    </Text>
                    {" close"}
                </Text>
              )}
            scrollRef={helpScrollRef}
            title="DOCTOR — KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={56}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"── "}</Text>
                    <Text bold color="white">
                        NAVIGATION
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" ↑/k  "}
                            </Text>
                            <Text dimColor>Move up</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" ↓/j  "}
                        </Text>
                        <Text dimColor>Move down</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" PgUp"}
                            </Text>
                            <Text dimColor> Jump up 10</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" PgDn"}
                        </Text>
                        <Text dimColor> Jump down 10</Text>
                    </Text>
                </Box>
                <Box>
                    <Box width={26}>
                        <Text>
                            <Text bold color="white">
                                {" Home"}
                            </Text>
                            <Text dimColor> Jump to top</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" End"}
                        </Text>
                        <Text dimColor> Jump to bottom</Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" Tab"}
                    </Text>
                    <Text dimColor> Switch panel</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" →/←"}
                    </Text>
                    <Text dimColor> Section tabs (list) / Focus list (detail)</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"── "}</Text>
                    <Text bold color="white">
                        FILTER
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" /"}
                    </Text>
                    <Text dimColor> Open text filter (Esc/Enter to close)</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" e"}
                    </Text>
                    <Text dimColor> Toggle errors-only filter</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" w"}
                    </Text>
                    <Text dimColor> Toggle warns-only filter</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"── "}</Text>
                    <Text bold color="white">
                        ACTIONS
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" u"}
                    </Text>
                    <Text dimColor> Exit + suggest update / dedupe command</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" o"}
                    </Text>
                    <Text dimColor> Exit + suggest optimize command</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" a"}
                    </Text>
                    <Text dimColor> Exit + print risk-ack snippet</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" d"}
                    </Text>
                    <Text dimColor> Focus detail panel</Text>
                </Text>
            </Box>
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text dimColor>{"── "}</Text>
                    <Text bold color="white">
                        EXIT
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" q"}
                    </Text>
                    <Text dimColor> Quit (with countdown)</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" Ctrl+C"}
                    </Text>
                    <Text dimColor> Quit immediately</Text>
                </Text>
            </Box>
        </Dialog>
    );

    const listPanel = (
        <DoctorListPanel
            elapsedMs={elapsedMs}
            entries={state.entries}
            filterActive={state.filterActive}
            filterText={state.filterText}
            filterType={state.filterType}
            focused={state.focusedPanel === "list"}
            fromCache={fromCache}
            grouped={state.grouped}
            onViewportHeightChange={setMeasuredViewportHeight}
            scrollOffset={clampedListScrollOffset}
            sectionCounts={sectionCounts}
            sectionMessage={state.sectionMessage}
            sectionStatus={state.sectionStatus}
            selectedIndex={state.selectedIndex}
            severityFilter={state.severityFilter}
            totalAll={state.all.length}
            viewportHeight={listViewportHeight}
        />
    );

    const bannerNode = banner ? <ConfigBanner hint={banner.hint} message={banner.message} severity={banner.severity} title={banner.title} /> : null;

    const detailPanel = <DoctorDetailPanel finding={selectedFinding} focused={state.focusedPanel === "detail"} scrollRef={detailScrollRef} />;

    if (isHorizontal) {
        const detailWidth = Math.floor(columns * 0.4);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                {bannerNode}
                <Box flexDirection="row" flexGrow={1}>
                    <Box flexGrow={1}>{listPanel}</Box>
                    <Box width={detailWidth}>{detailPanel}</Box>
                </Box>
                {footer}
                <QuitDialog
                    autoExitSeconds={autoExitSeconds || 3}
                    onCancel={() => {
                        setQuitDialogVisible(false);
                    }}
                    visible={quitDialogVisible}
                />
                {helpPopup}
            </Box>
        );
    }

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            {bannerNode}
            <Box height={listPanelHeight}>{listPanel}</Box>
            <Box flexGrow={1}>{detailPanel}</Box>
            {footer}
            <QuitDialog
                autoExitSeconds={autoExitSeconds || 3}
                onCancel={() => {
                    setQuitDialogVisible(false);
                }}
                visible={quitDialogVisible}
            />
            {helpPopup}
        </Box>
    );
};

export default VisDoctorApp;
