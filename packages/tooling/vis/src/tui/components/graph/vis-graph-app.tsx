import type { ScrollViewRef } from "@visulima/tui";
import { Box, Dialog, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import QuitDialog from "../quit-dialog";
import type { GraphFilterType, GraphStore } from "./graph-store";
import ProjectDetailPanel from "./project-detail-panel";
import ProjectListPanel from "./project-list-panel";

// ── Layout constants ────────────────────────────────────────────────────

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;

const FILTER_KEYS: Record<string, GraphFilterType> = {
    1: "all",
    2: "app",
    3: "lib",
};

// ── Component ───────────────────────────────────────────────────────────

interface VisGraphAppProps {
    autoExitSeconds?: number;
    store: GraphStore;
}

const VisGraphApp = ({ autoExitSeconds = 0, store }: VisGraphAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const detailScrollRef = useRef<ScrollViewRef>(null);
    const [listScrollOffset, setListScrollOffset] = useState(0);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);

    const filteredNodes = useMemo(() => store.getFilteredNodes(), [state.allNodes, state.filterType, state.filterText]);
    const stats = useMemo(() => store.getStats(), [state.allNodes]);
    const selectedNode = filteredNodes[state.selectedIndex] ?? null;

    // Compute the row position for a given entry index
    const getRowForIndex = useCallback(
        (index: number): number => {
            const apps = filteredNodes.filter((n) => n.type === "application");
            const libs = filteredNodes.filter((n) => n.type !== "application");

            let row = 0;
            let count = 0;

            if (apps.length > 0) {
                row += 2; // type header

                for (let i = 0; i < apps.length; i++) {
                    if (count === index) {
                        return row;
                    }

                    row += 1;
                    count++;
                }
            }

            if (libs.length > 0) {
                row += 2; // type header

                for (let i = 0; i < libs.length; i++) {
                    if (count === index) {
                        return row;
                    }

                    row += 1;
                    count++;
                }
            }

            return row;
        },
        [filteredNodes],
    );

    // Viewport height for list: total rows - border(2) - header(1) - filter bar(3) - footer(2)
    const listViewportHeight = Math.max(1, rows - 8 - (state.filterActive ? 1 : 0));

    // Keep selected item in view
    const scrollToIndex = useCallback(
        (index: number) => {
            const targetRow = getRowForIndex(index);

            setListScrollOffset((current) => {
                if (targetRow > current + listViewportHeight - 2) {
                    return Math.max(0, targetRow - listViewportHeight + 2);
                }

                if (targetRow < current + 1) {
                    return Math.max(0, targetRow - 1);
                }

                return current;
            });
        },
        [getRowForIndex, listViewportHeight],
    );

    // Reset detail scroll when selected entry changes
    useEffect(() => {
        detailScrollRef.current?.scrollToTop();
    }, [selectedNode?.name]);

    // ── Keyboard handling ───────────────────────────────────────────

    useInput(
        (input, key) => {
            // Ctrl+C: always exit
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            // Quit dialog handles its own input
            if (quitDialogVisible) {
                return;
            }

            // Help dialog
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

            // Global
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

            // Filter type shortcuts
            if (FILTER_KEYS[input]) {
                store.setFilterType(FILTER_KEYS[input]);

                return;
            }

            // Filter mode
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

                if (input && !key.ctrl && !key.meta) {
                    store.setFilter(state.filterText + input);

                    return;
                }

                return;
            }

            // List panel focused
            if (state.focusedPanel === "list") {
                if (filteredNodes.length === 0) {
                    // Text filter is the only action available when list is empty
                    if (input === "/") {
                        store.setFilterActive(true);
                    }

                    return;
                }

                if (key.downArrow || input === "j") {
                    const next = Math.min(state.selectedIndex + 1, filteredNodes.length - 1);

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
                    const next = Math.min(state.selectedIndex + 10, filteredNodes.length - 1);

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
                    const last = filteredNodes.length - 1;

                    store.setSelectedIndex(last);
                    scrollToIndex(last);

                    return;
                }

                // Text filter
                if (input === "/") {
                    store.setFilterActive(true);

                    return;
                }

                // Focus detail
                if (key.rightArrow) {
                    store.setFocusedPanel("detail");

                    return;
                }

                return;
            }

            // Detail panel focused
            if (state.focusedPanel === "detail") {
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
            }
        },
        { isActive: true },
    );

    // ── Layout ──────────────────────────────────────────────────────

    if (columns < MIN_VIEWPORT_WIDTH || rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" height={rows} justifyContent="center" width={columns}>
                <Text color="yellow">
                    Terminal too small ({columns}x{rows})
                </Text>
            </Box>
        );
    }

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

    // ── Footer ──────────────────────────────────────────────────────

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            <Box flexWrap="wrap" gap={2} paddingX={1}>
                <Box gap={1} key="q">
                    <Text bold color="white">
                        q
                    </Text>
                    <Text dimColor>QUIT</Text>
                </Box>
                <Box gap={1} key="?">
                    <Text bold color="white">
                        ?
                    </Text>
                    <Text dimColor>HELP</Text>
                </Box>
                <Box gap={1} key="nav">
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
                    <Text dimColor>NAV</Text>
                </Box>
                <Box gap={1} key="f">
                    <Text bold color="white">
                        1-3 /
                    </Text>
                    <Text dimColor>FILTER</Text>
                </Box>
                <Box gap={1} key="t">
                    <Text bold color="white">
                        Tab
                    </Text>
                    <Text dimColor>PANEL</Text>
                </Box>
            </Box>
        </Box>
    );

    // ── Help dialog ─────────────────────────────────────────────────

    const helpPopup = (
        <Dialog
            footer={
                <Text dimColor>
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>{" "}
                    scroll{" "}
                    <Text bold color="white">
                        ?
                    </Text>
                    /
                    <Text bold color="white">
                        Esc
                    </Text>{" "}
                    close
                </Text>
            }
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
                    <Text dimColor> Switch panel</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        {"\u2192"}/{"\u2190"}
                    </Text>
                    <Text dimColor> Focus detail/list</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        PgUp/PgDn
                    </Text>
                    <Text dimColor> Jump 10 items</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Home/End
                    </Text>
                    <Text dimColor> Jump to start/end</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        FILTERS
                    </Text>
                </Box>
                <Box>
                    <Box width={24}>
                        <Text>
                            <Text bold color="white">
                                {" "}
                                1
                            </Text>
                            <Text dimColor> All</Text>
                        </Text>
                    </Box>
                    <Text>
                        <Text bold color="white">
                            {" "}
                            2
                        </Text>
                        <Text dimColor> Apps only</Text>
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        3
                    </Text>
                    <Text dimColor> Libraries only</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        /
                    </Text>
                    <Text dimColor> Text filter</Text>
                </Text>
            </Box>
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        ACTIONS
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        q
                    </Text>
                    <Text dimColor> Quit</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        ?
                    </Text>
                    <Text dimColor> Toggle help</Text>
                </Text>
            </Box>
        </Dialog>
    );

    // ── Panels ──────────────────────────────────────────────────────

    const listPanel = (
        <ProjectListPanel
            filterActive={state.filterActive}
            filterText={state.filterText}
            filterType={state.filterType}
            focused={state.focusedPanel === "list"}
            nodes={filteredNodes}
            scrollOffset={listScrollOffset}
            selectedIndex={state.selectedIndex}
            stats={stats}
            viewportHeight={listViewportHeight}
        />
    );

    const detailPanel = <ProjectDetailPanel focused={state.focusedPanel === "detail"} node={selectedNode} scrollRef={detailScrollRef} />;

    // ── Horizontal layout ───────────────────────────────────────────

    if (isHorizontal) {
        const detailWidth = Math.floor(columns * 0.35);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexDirection="row" flexGrow={1}>
                    <Box flexGrow={1}>{listPanel}</Box>
                    <Box width={detailWidth}>{detailPanel}</Box>
                </Box>
                {footer}
                <QuitDialog
                    autoExitSeconds={autoExitSeconds ?? 3}
                    onCancel={() => {
                        setQuitDialogVisible(false);
                    }}
                    visible={quitDialogVisible}
                />
                {helpPopup}
            </Box>
        );
    }

    // ── Vertical layout ─────────────────────────────────────────────

    const listHeight = Math.floor(rows * 0.55);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box height={listHeight}>{listPanel}</Box>
            <Box flexGrow={1}>{detailPanel}</Box>
            {footer}
            <QuitDialog
                autoExitSeconds={autoExitSeconds ?? 3}
                onCancel={() => {
                    setQuitDialogVisible(false);
                }}
                visible={quitDialogVisible}
            />
            {helpPopup}
        </Box>
    );
};

export default VisGraphApp;
