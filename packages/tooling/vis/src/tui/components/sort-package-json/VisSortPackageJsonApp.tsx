import type { ScrollViewRef } from "@visulima/tui";
import { Box, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useCallback, useRef, useSyncExternalStore } from "react";

import SortDetailPanel from "./SortDetailPanel";
import SortListPanel, { computeGroupCounts } from "./SortListPanel";
import type { FilterType, SortPackageJsonStore } from "./SortPackageJsonStore";

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_HEIGHT = 10;

// Lines the list panel itself spends on chrome (rendered inside SortListPanel):
//   1 (border top) + 1 (title) + 3 (filter row with paddingY=1) + 1 (border bottom) = 6.
const LIST_PANEL_CHROME = 6;
// Lines outside the panels: the keymap footer at the bottom of the screen.
const APP_FOOTER_LINES = 1;

const FILTER_KEYS: Record<string, FilterType> = {
    1: "all",
    2: "rewritten",
    3: "errors",
    4: "unchanged",
};

interface VisSortPackageJsonAppProps {
    checkMode: boolean;
    store: SortPackageJsonStore;
}

const VisSortPackageJsonApp = ({ checkMode, store }: VisSortPackageJsonAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const detailScrollRef = useRef<ScrollViewRef>(null);

    const filteredEntries = store.getFilteredEntries();
    const selectedEntry = filteredEntries[state.selectedIndex] ?? null;
    const tabCounts = computeGroupCounts(state.entries);

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

    // The two panels share the area above the keymap footer. In horizontal
    // mode each takes the full height; in vertical mode they split it evenly
    // (both have flexGrow=1). The list panel's own chrome (border+title+filter)
    // eats another 6 rows before the scroll viewport begins.
    const panelsArea = Math.max(0, rows - APP_FOOTER_LINES);
    const listPanelHeight = isHorizontal ? panelsArea : Math.floor(panelsArea / 2);
    const viewportHeight = Math.max(0, listPanelHeight - LIST_PANEL_CHROME);

    const handleExit = useCallback(() => {
        exit();
    }, [exit]);

    useInput((input, key) => {
        if (input === "q" || key.escape) {
            handleExit();

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
                store.selectStep(-1);
            } else if (key.downArrow || input === "j") {
                store.selectStep(1);
            }
        } else if (state.focusedPanel === "detail") {
            if (key.upArrow || input === "k") {
                detailScrollRef.current?.scrollBy(-1);
            } else if (key.downArrow || input === "j") {
                detailScrollRef.current?.scrollBy(1);
            }
        }
    });

    if (rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" justifyContent="center">
                <Text color="yellow">
                    Terminal too small. Resize to at least
                    {MIN_VIEWPORT_HEIGHT}
{' '}
rows.
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexDirection={isHorizontal ? "row" : "column"} flexGrow={1}>
                <Box flexBasis={isHorizontal ? "50%" : undefined} flexGrow={1}>
                    <SortListPanel
                        counts={tabCounts}
                        entries={filteredEntries}
                        filterType={state.filterType}
                        focused={state.focusedPanel === "list"}
                        selectedIndex={state.selectedIndex}
                        totalEntries={state.entries.length}
                        viewportHeight={viewportHeight}
                    />
                </Box>
                <Box flexBasis={isHorizontal ? "50%" : undefined} flexGrow={1}>
                    <SortDetailPanel checkMode={checkMode} entry={selectedEntry} focused={state.focusedPanel === "detail"} scrollRef={detailScrollRef} />
                </Box>
            </Box>

            <Box flexShrink={0} paddingX={1}>
                <Text dimColor>↑/↓ or j/k:navigate | tab:switch panel | 1-4:filter | q:quit</Text>
            </Box>
        </Box>
    );
};

export default VisSortPackageJsonApp;
