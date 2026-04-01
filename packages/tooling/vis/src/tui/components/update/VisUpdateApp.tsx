import type { ScrollViewRef } from "@visulima/tui";
import { Box, Dialog, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";

import PackageDetailPanel from "./PackageDetailPanel";
import PackageListPanel from "./PackageListPanel";
import type { FilterType } from "./UpdateStore";
import { UpdateStore } from "./UpdateStore";

// ── Layout constants ────────────────────────────────────────────────────

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;

const FILTER_KEYS: Record<string, FilterType> = {
    "1": "all",
    "2": "major",
    "3": "minor",
    "4": "patch",
    "5": "security",
};

// ── Component ───────────────────────────────────────────────────────────

interface VisUpdateAppProps {
    changelogUrls?: Map<string, string>;
    isDryRun: boolean;
    store: UpdateStore;
}

const VisUpdateApp = ({ changelogUrls, isDryRun, store }: VisUpdateAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const helpScrollRef = useRef<ScrollViewRef>(null);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const filteredEntries = useMemo(() => store.getFilteredEntries(), [state.entries, state.filterType, state.filterText]);

    const selectedEntry = filteredEntries[state.selectedIndex] ?? null;
    const selectedRecommendation = selectedEntry ? store.getRecommendation(selectedEntry.packageName) : undefined;
    const selectedChangelog = selectedEntry && changelogUrls ? changelogUrls.get(selectedEntry.packageName) : undefined;

    // ── Keyboard handling ───────────────────────────────────────────

    useInput(
        (input, key) => {
            // Ctrl+C: always exit
            if (input === "c" && key.ctrl) {
                exit();
                return;
            }

            // Confirm dialog
            if (confirmVisible) {
                if (input === "u" || key.return) {
                    setConfirmVisible(false);
                    store.startApply();
                    exit(store.getCheckedEntries());
                } else {
                    setConfirmVisible(false);
                }
                return;
            }

            // Help dialog
            if (helpVisible) {
                if (key.escape || input === "?") {
                    setHelpVisible(false);
                } else if (input === "q") {
                    setHelpVisible(false);
                    exit();
                } else if (key.downArrow || input === "j") {
                    helpScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    helpScrollRef.current?.scrollBy(-1);
                }
                return;
            }

            // Global
            if (input === "?") { setHelpVisible(true); return; }
            if (input === "q") { exit(); return; }
            if (key.tab) { store.setFocusedPanel(state.focusedPanel === "list" ? "detail" : "list"); return; }

            // Filter type shortcuts
            if (FILTER_KEYS[input]) {
                store.setFilterType(FILTER_KEYS[input]);
                return;
            }

            // Filter mode
            if (state.filterActive) {
                if (key.escape) { store.setFilterActive(false); return; }
                if (key.return) { store.setFilterActive(false); return; }
                if (key.backspace) { store.setFilter(state.filterText.slice(0, -1)); return; }
                if (input && !key.ctrl && !key.meta) { store.setFilter(state.filterText + input); return; }
                return;
            }

            // List panel focused
            if (state.focusedPanel === "list") {
                if (key.downArrow || input === "j") {
                    store.setSelectedIndex(state.selectedIndex + 1);
                    return;
                }
                if (key.upArrow || input === "k") {
                    store.setSelectedIndex(state.selectedIndex - 1);
                    return;
                }
                // Toggle check
                if (input === " " || key.return) {
                    if (selectedEntry) store.toggleCheck(selectedEntry.packageName);
                    return;
                }
                // Toggle all
                if (input === "a") { store.toggleAll(); return; }
                // Text filter
                if (input === "/") { store.setFilterActive(true); return; }
                // Apply
                if (input === "u" && !isDryRun && state.checkedEntries.size > 0) {
                    setConfirmVisible(true);
                    return;
                }
                // Focus detail
                if (key.rightArrow) { store.setFocusedPanel("detail"); return; }
                return;
            }

            // Detail panel focused
            if (state.focusedPanel === "detail") {
                if (key.escape || key.leftArrow) { store.setFocusedPanel("list"); return; }
                return;
            }
        },
        { isActive: true },
    );

    // ── Layout ──────────────────────────────────────────────────────

    if (columns < MIN_VIEWPORT_WIDTH || rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" height={rows} justifyContent="center" width={columns}>
                <Text color="yellow">Terminal too small ({columns}x{rows})</Text>
            </Box>
        );
    }

    const isHorizontal = columns >= MIN_HORIZONTAL_WIDTH;

    // ── Footer ──────────────────────────────────────────────────────

    const footer = (
        <Box flexShrink={0} borderStyle="single" borderColor="gray" borderLeft={false} borderRight={false} borderBottom={false}>
            <Box paddingX={1} gap={2}>
                <Text dimColor>quit: </Text><Text bold>q</Text>
                <Text dimColor>  help: </Text><Text bold>?</Text>
                <Text dimColor>  nav: </Text><Text bold>{"\u2191\u2193"}</Text>
                <Text dimColor>  check: </Text><Text bold>Space</Text>
                <Text dimColor>  all: </Text><Text bold>a</Text>
                {!isDryRun && state.checkedEntries.size > 0 && (
                    <>
                        <Text dimColor>  apply: </Text><Text bold color="green">u</Text>
                    </>
                )}
                <Text dimColor>  filter: </Text><Text bold>1-5 /</Text>
                <Text dimColor>  switch: </Text><Text bold>Tab</Text>
            </Box>
        </Box>
    );

    // ── Help dialog ─────────────────────────────────────────────────

    const helpPopup = (
        <Dialog
            footer={
                <Text dimColor>
                    <Text color="cyan">{"\u2191 \u2193"}</Text> scroll  <Text color="cyan">?</Text>/<Text color="cyan">Esc</Text> close
                </Text>
            }
            scrollRef={helpScrollRef}
            title="Keyboard Shortcuts"
            visible={helpVisible}
            width={52}
        >
            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text bold color="white">{"\u2500"} Navigation</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="cyan" bold>  {"\u2191"}/k</Text>  Move up</Text></Box>
                    <Text><Text color="cyan" bold>  {"\u2193"}/j</Text>  Move down</Text>
                </Box>
                <Text><Text color="cyan" bold>  Tab</Text>    Switch panel</Text>
                <Text><Text color="cyan" bold>  {"\u2192"}/{"\u2190"}</Text>  Focus detail/list</Text>
            </Box>
            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text bold color="white">{"\u2500"} Selection</Text></Box>
                <Text><Text color="cyan" bold>  Space</Text>  Toggle check on package</Text>
                <Text><Text color="cyan" bold>  a</Text>      Toggle check all</Text>
            </Box>
            <Box marginBottom={1} flexDirection="column">
                <Box marginBottom={1}><Text bold color="white">{"\u2500"} Filters</Text></Box>
                <Box>
                    <Box width={24}><Text><Text color="cyan" bold>  1</Text>  All</Text></Box>
                    <Text><Text color="cyan" bold>  2</Text>  Major</Text>
                </Box>
                <Box>
                    <Box width={24}><Text><Text color="cyan" bold>  3</Text>  Minor</Text></Box>
                    <Text><Text color="cyan" bold>  4</Text>  Patch</Text>
                </Box>
                <Text><Text color="cyan" bold>  5</Text>  Security only</Text>
                <Text><Text color="cyan" bold>  /</Text>  Text filter</Text>
            </Box>
            <Box flexDirection="column">
                <Box marginBottom={1}><Text bold color="white">{"\u2500"} Actions</Text></Box>
                {!isDryRun && <Text><Text color="cyan" bold>  u</Text>  Apply selected updates</Text>}
                <Text><Text color="cyan" bold>  q</Text>  Quit</Text>
                <Text><Text color="cyan" bold>  ?</Text>  Toggle this help</Text>
            </Box>
        </Dialog>
    );

    // ── Confirm dialog ──────────────────────────────────────────────

    const checkedList = store.getCheckedEntries();
    const majorCount = checkedList.filter((e) => e.updateType === "major").length;

    const confirmDialog = (
        <Dialog title="Apply Updates" visible={confirmVisible} width={56}>
            <Box flexDirection="column">
                <Text>Apply {checkedList.length} update{checkedList.length !== 1 ? "s" : ""}?</Text>
                <Text>{""}</Text>
                {checkedList.map((e) => (
                    <Box key={e.packageName} gap={1}>
                        <Text>  {e.packageName}</Text>
                        <Text dimColor>{e.currentRange} {"\u2192"} {e.newRange}</Text>
                        <Text color={e.updateType === "major" ? "red" : e.updateType === "minor" ? "yellow" : "green"} bold>
                            {e.updateType}
                        </Text>
                    </Box>
                ))}
                {majorCount > 0 && (
                    <Box marginTop={1}>
                        <Text color="yellow">{"\u26A0"} {majorCount} major update{majorCount !== 1 ? "s" : ""} — review breaking changes</Text>
                    </Box>
                )}
                <Box marginTop={1}>
                    <Text dimColor>Press <Text color="cyan" bold>u</Text> or <Text color="cyan" bold>Enter</Text> to confirm, <Text color="cyan" bold>Esc</Text> to cancel</Text>
                </Box>
            </Box>
        </Dialog>
    );

    // ── Panels ──────────────────────────────────────────────────────

    const listPanel = (
        <PackageListPanel
            checkedEntries={state.checkedEntries}
            entries={filteredEntries}
            filterActive={state.filterActive}
            filterText={state.filterText}
            filterType={state.filterType}
            focused={state.focusedPanel === "list"}
            groupedByCatalog={state.groupedByCatalog}
            isDryRun={isDryRun}
            selectedIndex={state.selectedIndex}
            totalEntries={store.getFilteredEntries().length}
        />
    );

    const detailPanel = (
        <PackageDetailPanel
            changelogUrl={selectedChangelog}
            entry={selectedEntry}
            focused={state.focusedPanel === "detail"}
            recommendation={selectedRecommendation}
        />
    );

    // ── Horizontal layout ───────────────────────────────────────────

    if (isHorizontal) {
        const listWidth = Math.floor(columns * 0.45);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexDirection="row" flexGrow={1}>
                    <Box width={listWidth}>{listPanel}</Box>
                    <Box flexGrow={1}>{detailPanel}</Box>
                </Box>
                {footer}
                {confirmDialog}
                {helpPopup}
            </Box>
        );
    }

    // ── Vertical layout ─────────────────────────────────────────────

    const listHeight = Math.floor(rows * 0.45);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box height={listHeight}>{listPanel}</Box>
            <Box flexGrow={1}>{detailPanel}</Box>
            {footer}
            {confirmDialog}
            {helpPopup}
        </Box>
    );
};

export default VisUpdateApp;
