import type { ScrollViewRef } from "@visulima/tui";
import { Box, Dialog, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { OutdatedEntry } from "../../../util/catalog";
import QuitDialog from "../QuitDialog";
import PackageDetailPanel from "./PackageDetailPanel";
import PackageListPanel from "./PackageListPanel";
import type { FilterType, UpdateStore } from "./UpdateStore";

// ── Layout constants ────────────────────────────────────────────────────

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;
const EMPTY_ENTRIES: OutdatedEntry[] = [];

// ── Component ───────────────────────────────────────────────────────────

interface VisUpdateAppProps {
    /** 0 = no auto-exit (default), >0 = countdown seconds */
    autoExitSeconds?: number;
    changelogUrls?: Map<string, string>;
    /** Total unique packages checked by the registry. */
    checkedCount?: number;
    /** Packages that have newer versions but were filtered out by the target constraint. */
    filteredOutEntries?: OutdatedEntry[];
    isDryRun: boolean;
    store: UpdateStore;
    /** Total catalog entries (before deduplication). */
    totalCatalogEntries?: number;
}

const VisUpdateApp = ({
    autoExitSeconds = 0,
    changelogUrls,
    checkedCount = 0,
    filteredOutEntries = EMPTY_ENTRIES,
    isDryRun,
    store,
    totalCatalogEntries = 0,
}: VisUpdateAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const [filteredOutVisible, setFilteredOutVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const filteredOutScrollRef = useRef<ScrollViewRef>(null);
    const detailScrollRef = useRef<ScrollViewRef>(null);
    const confirmScrollRef = useRef<ScrollViewRef>(null);
    const [listScrollOffset, setListScrollOffset] = useState(0);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);

    const filteredEntries = useMemo(() => store.getFilteredEntries(), [state.entries, state.filterType, state.filterText]);

    const selectedEntry = filteredEntries[state.selectedIndex] ?? null;
    const selectedRecommendation = selectedEntry ? store.getRecommendation(selectedEntry.packageName) : undefined;
    const selectedChangelog = selectedEntry && changelogUrls ? changelogUrls.get(selectedEntry.packageName) : undefined;

    // Compute the row position for a given entry index.
    // Each catalog header = 2 rows (marginTop + text), each package = 1 row.
    const getRowForIndex = useCallback(
        (index: number): number => {
            let row = 0;
            let count = 0;

            for (const [, catalogEntries] of state.groupedByCatalog) {
                row += 2; // catalog header

                for (let i = 0; i < catalogEntries.length; i++) {
                    if (count === index) {
                        return row;
                    }

                    row += 1;
                    count++;
                }
            }

            return row;
        },
        [state.groupedByCatalog],
    );

    // JS estimate of the list viewport — used as the initial value before
    // the panel reports its actual measured height. Excludes border(2),
    // header(1), filter tabs with padding(3), footer(2) = 8 fixed rows,
    // plus the text-filter row when active. The estimate doesn't account
    // for the conditional "filtered out" notice, so we measure the real
    // content row in PackageListPanel and replace this value below.
    const estimatedViewportHeight = Math.max(1, rows - 8 - (state.filterActive ? 1 : 0));
    const [measuredViewportHeight, setMeasuredViewportHeight] = useState(estimatedViewportHeight);
    const listViewportHeight = measuredViewportHeight > 0 ? measuredViewportHeight : estimatedViewportHeight;

    // Keep selected item in view by adjusting scroll offset
    const scrollToIndex = useCallback(
        (index: number) => {
            const targetRow = getRowForIndex(index);

            setListScrollOffset((current) => {
                // Item below visible area — scroll so item is near the bottom
                if (targetRow > current + listViewportHeight - 2) {
                    return Math.max(0, targetRow - listViewportHeight + 2);
                }

                // Item above visible area — scroll so item is near the top
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
    }, [selectedEntry?.packageName]);

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

            // Filtered-out dialog
            if (filteredOutVisible) {
                if (key.escape || input === "f" || input === "q") {
                    setFilteredOutVisible(false);
                } else if (key.downArrow || input === "j") {
                    filteredOutScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    filteredOutScrollRef.current?.scrollBy(-1);
                }

                return;
            }

            // Confirm dialog — u/Enter confirms, Esc/q cancels, arrows scroll
            if (confirmVisible) {
                if (input === "u" || key.return) {
                    setConfirmVisible(false);
                    store.startApply();
                    exit(store.getCheckedEntries());
                } else if (key.escape || input === "q") {
                    setConfirmVisible(false);
                } else if (key.downArrow || input === "j") {
                    confirmScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    confirmScrollRef.current?.scrollBy(-1);
                } else if (key.pageDown) {
                    confirmScrollRef.current?.scrollBy(5);
                } else if (key.pageUp) {
                    confirmScrollRef.current?.scrollBy(-5);
                }

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

            // Filter tab navigation (left/right arrows when list is focused)
            if (state.focusedPanel === "list" && (key.leftArrow || key.rightArrow)) {
                const tabs: FilterType[] = ["all", "major", "minor", "patch", "security"];
                const currentIndex = tabs.indexOf(state.filterType);
                const nextIndex = key.rightArrow ? (currentIndex + 1) % tabs.length : (currentIndex - 1 + tabs.length) % tabs.length;

                setListScrollOffset(0);
                detailScrollRef.current?.scrollToTop();
                store.setFilterType(tabs[nextIndex]!);

                return;
            }

            // Filtered-out packages dialog
            if (input === "f" && filteredOutEntries.length > 0) {
                setFilteredOutVisible((previous) => !previous);

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
                    setListScrollOffset(0);
                    store.setFilter(state.filterText.slice(0, -1));

                    return;
                }

                if (input && !key.ctrl && !key.meta) {
                    setListScrollOffset(0);
                    store.setFilter(state.filterText + input);

                    return;
                }

                return;
            }

            // List panel focused
            if (state.focusedPanel === "list") {
                if (key.downArrow || input === "j") {
                    const next = Math.min(state.selectedIndex + 1, filteredEntries.length - 1);

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
                    const next = Math.min(state.selectedIndex + 10, filteredEntries.length - 1);

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
                    const last = filteredEntries.length - 1;

                    store.setSelectedIndex(last);
                    scrollToIndex(last);

                    return;
                }

                // Toggle check
                if (input === " " || key.return) {
                    if (selectedEntry) {
                        store.toggleCheck(selectedEntry.packageName);
                    }

                    return;
                }

                // Toggle all
                if (input === "a") {
                    store.toggleAll();

                    return;
                }

                // Text filter
                if (input === "/") {
                    store.setFilterActive(true);

                    return;
                }

                // Apply
                if (input === "u" && !isDryRun && state.checkedEntries.size > 0) {
                    setConfirmVisible(true);

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
                    Terminal too small (
{columns}
x
{rows}
)
                </Text>
            </Box>
        );
    }

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

    // ── Footer ──────────────────────────────────────────────────────

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
                {"\u2191\u2193"}
            </Text>
            <Text dimColor>NAV</Text>
        </Box>,
        <Box gap={1} key="sp">
            <Text bold color="white">
                Space
            </Text>
            <Text dimColor>CHECK</Text>
        </Box>,
        <Box gap={1} key="a">
            <Text bold color="white">
                a
            </Text>
            <Text dimColor>ALL</Text>
        </Box>,
    ];

    if (!isDryRun && state.checkedEntries.size > 0) {
        footerItems.push(
            <Box gap={1} key="u">
                <Text bold color="green">
                    u
                </Text>
                <Text dimColor>APPLY</Text>
            </Box>,
        );
    }

    if (filteredOutEntries.length > 0) {
        footerItems.push(
            <Box gap={1} key="fo">
                <Text bold color="yellow">
                    f
                </Text>
                <Text dimColor>
FILTERED (
{filteredOutEntries.length}
)
                </Text>
            </Box>,
        );
    }

    footerItems.push(
        <Box gap={1} key="lr">
            <Text bold color="white">
                {"\u2190\u2192"}
            </Text>
            <Text dimColor>FILTER</Text>
        </Box>,
        <Box gap={1} key="f">
            <Text bold color="white">
                /
            </Text>
            <Text dimColor>SEARCH</Text>
        </Box>,
        <Box gap={1} key="t">
            <Text bold color="white">
                Tab
            </Text>
            <Text dimColor>PANEL</Text>
        </Box>,
    );

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            <Box flexWrap="wrap" gap={2} paddingX={1}>
                {footerItems}
            </Box>
        </Box>
    );

    // ── Help dialog ─────────────────────────────────────────────────

    const helpPopup = (
        <Dialog
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
                    <Text dimColor> Switch panel</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        {"\u2192"}
/
{"\u2190"}
                    </Text>
                    <Text dimColor> Focus detail/list</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        SELECTION
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        Space
                    </Text>
                    <Text dimColor> Toggle check on package</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        a
                    </Text>
                    <Text dimColor> Toggle check all</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        FILTERS
                    </Text>
                </Box>
                <Text>
                    <Text bold color="white">
                        {" "}
                        {"\u2190\u2192"}
                    </Text>
                    <Text dimColor> Switch filter tab</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" "}
                        /
                    </Text>
                    <Text dimColor> Text filter</Text>
                </Text>
                {filteredOutEntries.length > 0 && (
                    <Text>
                        <Text bold color="white">
                            {" "}
                            f
                        </Text>
                        <Text dimColor> View filtered-out packages</Text>
                    </Text>
                )}
            </Box>
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        ACTIONS
                    </Text>
                </Box>
                {!isDryRun && (
                    <Text>
                        <Text bold color="white">
                            {" "}
                            u
                        </Text>
                        <Text dimColor> Apply selected updates</Text>
                    </Text>
                )}
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

    // ── Confirm dialog ──────────────────────────────────────────────

    const checkedList = store.getCheckedEntries();
    const majorCount = checkedList.filter((e) => e.updateType === "major").length;

    const confirmFooter = (
        <Box alignItems="center" flexDirection="column">
            {majorCount > 0 && (
                <Box marginBottom={1} marginTop={1}>
                    <Text color="yellow">
                        {"\u26A0"}
{" "}
{majorCount}
{" "}
major update
{majorCount === 1 ? "" : "s"}
{" "}
— review breaking changes
                    </Text>
                </Box>
            )}
            <Text dimColor>
                Press
{" "}
                <Text bold color="white">
                    u
                </Text>
{" "}
                or
{" "}
                <Text bold color="white">
                    Enter
                </Text>
{" "}
                to confirm,
{" "}
                <Text bold color="white">
                    Esc
                </Text>
{" "}
                to cancel
            </Text>
        </Box>
    );

    const confirmDialog = (
        <Dialog
            footer={confirmFooter}
            scrollRef={confirmScrollRef}
            title={`Apply ${checkedList.length} update${checkedList.length === 1 ? "" : "s"}?`}
            visible={confirmVisible}
            width={70}
        >
            {checkedList.map((e) => (
                <Box gap={1} key={e.packageName}>
                    <Text>
{" "}
{e.packageName}
                    </Text>
                    <Text dimColor>
                        {e.currentRange}
{" "}
{"\u2192"}
{" "}
{e.newRange}
                    </Text>
                    <Text bold color={e.updateType === "major" ? "red" : e.updateType === "minor" ? "yellow" : "green"}>
                        {e.updateType}
                    </Text>
                </Box>
            ))}
        </Dialog>
    );

    // ── Filtered-out dialog ───────────────────────────────────────

    const filteredOutDialog
        = filteredOutEntries.length > 0
            ? (
            <Dialog
                footer={(
                    <Text dimColor>
                        <Text bold color="white">
                            {"\u2191\u2193"}
                        </Text>
{" "}
                        scroll
                        {"  "}
                        <Text bold color="white">
                            f
                        </Text>
                        /
                        <Text bold color="white">
                            Esc
                        </Text>
{" "}
                        close
                    </Text>
                  )}
                scrollRef={filteredOutScrollRef}
                title={`${filteredOutEntries.length} PACKAGE${filteredOutEntries.length === 1 ? "" : "S"} FILTERED BY TARGET`}
                visible={filteredOutVisible}
                width={70}
            >
                <Box flexDirection="column">
                    <Box marginBottom={1}>
                        <Text dimColor>
                            These packages have newer versions available but are excluded by the current target constraint. Use
{" "}
                            <Text bold color="white">
                                --target latest
                            </Text>
{" "}
                            to include them.
                        </Text>
                    </Box>
                    {filteredOutEntries.map((e) => (
                        <Box gap={1} key={e.packageName}>
                            <Text>
{" "}
{e.packageName}
                            </Text>
                            <Text dimColor>
                                {e.currentRange}
{" "}
{"\u2192"}
{" "}
{e.newRange}
                            </Text>
                            <Text bold color={e.updateType === "major" ? "red" : e.updateType === "minor" ? "yellow" : "green"}>
                                {e.updateType}
                            </Text>
                        </Box>
                    ))}
                </Box>
            </Dialog>
            )
            : null;

    // ── Panels ──────────────────────────────────────────────────────

    const listPanel = (
        <PackageListPanel
            checkedEntries={state.checkedEntries}
            entries={filteredEntries}
            filterActive={state.filterActive}
            filteredOutCount={filteredOutEntries.length}
            filterText={state.filterText}
            filterType={state.filterType}
            focused={state.focusedPanel === "list"}
            groupedByCatalog={state.groupedByCatalog}
            isDryRun={isDryRun}
            onViewportHeightChange={setMeasuredViewportHeight}
            scrollOffset={listScrollOffset}
            selectedIndex={state.selectedIndex}
            totalCatalogEntries={totalCatalogEntries}
            totalChecked={checkedCount}
            totalEntries={filteredEntries.length}
            viewportHeight={listViewportHeight}
        />
    );

    const detailPanel = (
        <PackageDetailPanel
            changelogUrl={selectedChangelog}
            entry={selectedEntry}
            focused={state.focusedPanel === "detail"}
            recommendation={selectedRecommendation}
            scrollRef={detailScrollRef}
        />
    );

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
                {confirmDialog}
                {filteredOutDialog}
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

    // ── Vertical layout ─────────────────────────────────────────────

    const listHeight = Math.floor(rows * 0.55);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box height={listHeight}>{listPanel}</Box>
            <Box flexGrow={1}>{detailPanel}</Box>
            {footer}
            {confirmDialog}
            {filteredOutDialog}
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

export default VisUpdateApp;
