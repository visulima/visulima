import type { ScrollViewRef } from "@visulima/tui";
import { Box, Dialog, Text, useApp, useInput, useWindowSize } from "@visulima/tui";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import QuitDialog from "../QuitDialog";
import MigrateDetailPanel from "./MigrateDetailPanel";
import MigrateListPanel from "./MigrateListPanel";
import type { MigrateStore } from "./MigrateStore";

const MIN_HORIZONTAL_WIDTH = 100;
const MIN_VIEWPORT_WIDTH = 40;
const MIN_VIEWPORT_HEIGHT = 10;

interface VisMigrateAppProps {
    autoExitSeconds?: number;
    isDryRun: boolean;
    store: MigrateStore;
}

const VisMigrateApp = ({ autoExitSeconds = 0, isDryRun, store }: VisMigrateAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);
    const [listScrollOffset, setListScrollOffset] = useState(0);

    const helpScrollRef = useRef<ScrollViewRef>(null);
    const detailScrollRef = useRef<ScrollViewRef>(null);
    const confirmScrollRef = useRef<ScrollViewRef>(null);

    const selectedItem = state.items[state.selectedIndex] ?? null;

    const listViewportHeight = Math.max(1, rows - 6);

    const scrollToIndex = useCallback(
        (index: number) => {
            setListScrollOffset((current) => {
                if (index >= current + listViewportHeight) {
                    return Math.max(0, index - listViewportHeight + 1);
                }

                if (index < current) {
                    return Math.max(0, index);
                }

                return current;
            });
        },
        [listViewportHeight],
    );

    useEffect(() => {
        detailScrollRef.current?.scrollToTop();
    }, [selectedItem?.entry.id]);

    useInput(
        (input, key) => {
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            if (quitDialogVisible) {
                return;
            }

            if (confirmVisible) {
                if (input === "u" || key.return) {
                    setConfirmVisible(false);
                    store.startApply();
                    exit(store.getCheckedItems());
                } else if (key.escape || input === "q") {
                    setConfirmVisible(false);
                } else if (key.downArrow || input === "j") {
                    confirmScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    confirmScrollRef.current?.scrollBy(-1);
                }

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

            if (state.focusedPanel === "list") {
                if (key.downArrow || input === "j") {
                    const next = Math.min(state.selectedIndex + 1, state.items.length - 1);

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
                    const next = Math.min(state.selectedIndex + 10, state.items.length - 1);

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
                    const last = state.items.length - 1;

                    store.setSelectedIndex(last);
                    scrollToIndex(last);

                    return;
                }

                if (input === " " || key.return) {
                    if (selectedItem) {
                        store.toggleCheck(selectedItem.entry.id);
                    }

                    return;
                }

                if (input === "a") {
                    store.toggleAll();

                    return;
                }

                if (input === "u" && !isDryRun && state.checkedItems.size > 0) {
                    setConfirmVisible(true);

                    return;
                }

                if (key.rightArrow) {
                    store.setFocusedPanel("detail");
                }

                return;
            }

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

    if (!isDryRun && state.checkedItems.size > 0) {
        footerItems.push(
            <Box gap={1} key="u">
                <Text bold color="green">
                    u
                </Text>
                <Text dimColor>APPLY</Text>
            </Box>,
        );
    }

    footerItems.push(
        <Box gap={1} key="tab">
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

    const helpPopup = (
        <Dialog
            footer={
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
            }
            scrollRef={helpScrollRef}
            title="KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={52}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="white">
                    NAVIGATION
                </Text>
                <Text>
                    <Text bold color="white">
                        {" ↑/k"}
                    </Text>
                    <Text dimColor> Move up</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" ↓/j"}
                    </Text>
                    <Text dimColor> Move down</Text>
                </Text>
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
                    <Text dimColor> Focus detail/list</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="white">
                    SELECTION
                </Text>
                <Text>
                    <Text bold color="white">
                        {" Space"}
                    </Text>
                    <Text dimColor> Toggle migration</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" a"}
                    </Text>
                    <Text dimColor> Toggle all</Text>
                </Text>
            </Box>
            <Box flexDirection="column">
                <Text bold color="white">
                    ACTIONS
                </Text>
                {!isDryRun && (
                    <Text>
                        <Text bold color="white">
                            {" u"}
                        </Text>
                        <Text dimColor> Apply selected migrations</Text>
                    </Text>
                )}
                <Text>
                    <Text bold color="white">
                        {" q"}
                    </Text>
                    <Text dimColor> Quit</Text>
                </Text>
                <Text>
                    <Text bold color="white">
                        {" ?"}
                    </Text>
                    <Text dimColor> Toggle help</Text>
                </Text>
            </Box>
        </Dialog>
    );

    const checkedItems = store.getCheckedItems();
    const confirmFooter = (
        <Box alignItems="center" flexDirection="column">
            <Text dimColor>
                {"Press "}
                <Text bold color="white">
                    u
                </Text>
                {" or "}
                <Text bold color="white">
                    Enter
                </Text>
                {" to confirm, "}
                <Text bold color="white">
                    Esc
                </Text>
                {" to cancel"}
            </Text>
        </Box>
    );

    const confirmDialog = (
        <Dialog
            footer={confirmFooter}
            scrollRef={confirmScrollRef}
            title={`Apply ${String(checkedItems.length)} migration${checkedItems.length === 1 ? "" : "s"}?`}
            visible={confirmVisible}
            width={70}
        >
            {checkedItems.map((item) => (
                <Box gap={1} key={item.entry.id}>
                    <Text> {item.entry.title}</Text>
                    <Text dimColor>
                        ({item.preview.length} change
                        {item.preview.length === 1 ? "" : "s"})
                    </Text>
                </Box>
            ))}
        </Dialog>
    );

    const listPanel = (
        <MigrateListPanel
            checkedItems={state.checkedItems}
            focused={state.focusedPanel === "list"}
            isDryRun={isDryRun}
            items={state.items}
            scrollOffset={listScrollOffset}
            selectedIndex={state.selectedIndex}
            viewportHeight={listViewportHeight}
        />
    );

    const detailPanel = <MigrateDetailPanel focused={state.focusedPanel === "detail"} item={selectedItem} scrollRef={detailScrollRef} />;

    if (isHorizontal) {
        const detailWidth = Math.floor(columns * 0.55);

        return (
            <Box flexDirection="column" height={rows} width={columns}>
                <Box flexDirection="row" flexGrow={1}>
                    <Box flexGrow={1}>{listPanel}</Box>
                    <Box width={detailWidth}>{detailPanel}</Box>
                </Box>
                {footer}
                {confirmDialog}
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

    const listHeight = Math.floor(rows * 0.45);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box height={listHeight}>{listPanel}</Box>
            <Box flexGrow={1}>{detailPanel}</Box>
            {footer}
            {confirmDialog}
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

export default VisMigrateApp;
