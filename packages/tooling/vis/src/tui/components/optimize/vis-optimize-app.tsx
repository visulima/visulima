import { Box } from "@visulima/tui/components/box";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useWindowSize } from "@visulima/tui/hooks/use-window-size";
import React, { useCallback, useRef, useState, useSyncExternalStore } from "react";

import QuitDialog from "../quit-dialog";
import OptimizeDetailPanel from "./optimize-detail-panel";
import OptimizeListPanel from "./optimize-list-panel";
import type { FilterType, OptimizeStore } from "./optimize-store";

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_HEIGHT = 10;

const FILTER_KEYS: Record<string, FilterType> = {
    1: "all",
    2: "native",
    3: "preferred",
    4: "micro-utility",
    5: "socket",
};

interface VisOptimizeAppProps {
    isDryRun: boolean;
    store: OptimizeStore;
}

const VisOptimizeApp = ({ isDryRun, store }: VisOptimizeAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const detailScrollRef = useRef<ScrollViewRef>(null);
    const [listScrollOffset, setListScrollOffset] = useState(0);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);

    const filteredEntries = store.getFilteredEntries();
    const selectedEntry = filteredEntries[state.selectedIndex] ?? null;

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;
    const headerHeight = 5;
    const viewportHeight = Math.max(0, rows - headerHeight);

    const handleExit = useCallback(
        (result?: unknown) => {
            exit(result);
        },
        [exit],
    );

    useInput(
        (input, key) => {
            if (quitDialogVisible) {
                if (input === "y" || input === "Y") {
                    handleExit();
                } else {
                    setQuitDialogVisible(false);
                }

                return;
            }

            if (state.filterActive) {
                if (key.escape) {
                    store.setFilterActive(false);
                    store.setFilterText("");
                } else if (key.return) {
                    store.setFilterActive(false);
                } else if (key.backspace || key.delete) {
                    store.setFilterText(state.filterText.slice(0, -1));
                } else if (input && !key.ctrl && !key.meta) {
                    store.setFilterText(state.filterText + input);
                }

                return;
            }

            if (input === "q") {
                if (!isDryRun && state.checkedEntries.size > 0) {
                    setQuitDialogVisible(true);
                } else {
                    handleExit();
                }

                return;
            }

            if (input === "/") {
                store.setFilterActive(true);

                return;
            }

            if (FILTER_KEYS[input]) {
                store.setFilter(FILTER_KEYS[input]);

                return;
            }

            if (key.tab) {
                store.setFocusedPanel(state.focusedPanel === "list" ? "detail" : "list");

                return;
            }

            if (state.focusedPanel === "list") {
                if (key.upArrow || input === "k") {
                    const newIndex = Math.max(0, state.selectedIndex - 1);

                    store.select(newIndex);

                    if (newIndex < listScrollOffset) {
                        setListScrollOffset(newIndex);
                    }
                } else if (key.downArrow || input === "j") {
                    const newIndex = Math.min(filteredEntries.length - 1, state.selectedIndex + 1);

                    store.select(newIndex);

                    if (newIndex >= listScrollOffset + viewportHeight) {
                        setListScrollOffset(newIndex - viewportHeight + 1);
                    }
                } else if (input === " ") {
                    if (selectedEntry) {
                        store.toggleCheck(selectedEntry.packageName);
                    }
                } else if (input === "a") {
                    store.toggleAll();
                } else if (key.return && !isDryRun && state.checkedEntries.size > 0) {
                    handleExit(store.getCheckedEntries());
                }
            } else if (state.focusedPanel === "detail") {
                if (key.upArrow || input === "k") {
                    detailScrollRef.current?.scrollBy(-1);
                } else if (key.downArrow || input === "j") {
                    detailScrollRef.current?.scrollBy(1);
                }
            }
        },
        { isActive: state.phase === "browsing" },
    );

    if (rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" justifyContent="center">
                <Text color="yellow">
                    Terminal too small. Resize to at least
                    {MIN_VIEWPORT_HEIGHT}
{" "}
rows.
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexDirection={isHorizontal ? "row" : "column"} flexGrow={1}>
                <Box flexBasis={isHorizontal ? "50%" : undefined} flexGrow={1}>
                    <OptimizeListPanel
                        checkedEntries={state.checkedEntries}
                        entries={filteredEntries}
                        filterActive={state.filterActive}
                        filterText={state.filterText}
                        filterType={state.filterType}
                        focused={state.focusedPanel === "list"}
                        isDryRun={isDryRun}
                        scrollOffset={listScrollOffset}
                        selectedIndex={state.selectedIndex}
                        totalEntries={state.entries.length}
                        viewportHeight={viewportHeight}
                    />
                </Box>
                <Box flexBasis={isHorizontal ? "50%" : undefined} flexGrow={1}>
                    <OptimizeDetailPanel entry={selectedEntry} focused={state.focusedPanel === "detail"} scrollRef={detailScrollRef} />
                </Box>
            </Box>

            <Box flexShrink={0} paddingX={1}>
                <Text dimColor>
                    {isDryRun ? "Preview mode" : "space:toggle a:all enter:apply"}
{" "}
| tab:switch panel /: filter q:quit |
{"\u2699"}
                    =codemod available
                </Text>
            </Box>

            <QuitDialog
                autoExitSeconds={3}
                onCancel={() => {
                    setQuitDialogVisible(false);
                }}
                visible={quitDialogVisible}
            />
        </Box>
    );
};

export default VisOptimizeApp;
