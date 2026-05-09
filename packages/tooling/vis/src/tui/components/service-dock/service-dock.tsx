import { Box } from "@visulima/tui/components/box";
import { Spinner } from "@visulima/tui/components/spinner";
import { Text } from "@visulima/tui/components/text";
import React, { useSyncExternalStore } from "react";

import type { ServiceDockStore, ServiceState, ServiceStatus } from "./service-dock-store";

interface ServiceDockProps {
    /** Index of the row currently focused inside the dock; ignored when `focused` is false. */
    activeIndex: number;
    /** True when the parent app routes keyboard input to the dock. */
    focused: boolean;
    store: ServiceDockStore;
}

// `ready` uses a filled circle, not a check mark — the service is alive
// and accepting connections, NOT "done". A check would imply the process
// exited successfully, which is the opposite of what's true for a long-
// running service still in the process table. ✖ stays for crashed/failed
// because at that point the process really has stopped.
const STATUS_GLYPH: Record<ServiceStatus, string> = {
    crashed: "✖",
    failed: "✖",
    pending: "·",
    ready: "●",
    starting: "•",
};

const statusColor = (status: ServiceStatus): string => {
    if (status === "ready") {
        return "green";
    }

    if (status === "crashed" || status === "failed") {
        return "red";
    }

    if (status === "starting") {
        return "cyan";
    }

    return "gray";
};

const StatusGlyph = ({ status }: { status: ServiceStatus }): React.JSX.Element => {
    if (status === "starting") {
        return (
            <Text color="cyan">
                <Spinner type="dots" />
            </Text>
        );
    }

    return (
        <Text bold color={statusColor(status)}>
            {STATUS_GLYPH[status]}
        </Text>
    );
};

const ServiceRow = ({ active, focused, state }: { active: boolean; focused: boolean; state: ServiceState }): React.JSX.Element => {
    const isFocusedRow = focused && active;
    const indicator = isFocusedRow ? ">" : " ";
    const detail = (() => {
        if (state.status === "ready") {
            return state.port ? `running, port ${String(state.port)}` : "running";
        }

        if (state.status === "failed" || state.status === "crashed") {
            return state.errorMessage ?? "exited";
        }

        return state.lastLine ?? "booting…";
    })();

    return (
        <Box flexDirection="row" flexShrink={0} overflow="hidden">
            <Text>{indicator}</Text>
            <Text> </Text>
            <Box flexShrink={0} width={3}>
                <StatusGlyph status={state.status} />
            </Box>
            <Box flexGrow={0} flexShrink={0} width={28}>
                <Text bold={isFocusedRow} inverse={isFocusedRow}>
                    {state.id}
                </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1} overflow="hidden">
                <Text color={statusColor(state.status)} dimColor={state.status !== "crashed" && state.status !== "failed"} wrap="truncate-end">
                    {" "}
                    {detail}
                </Text>
            </Box>
        </Box>
    );
};

const StatusPill = ({ states }: { states: ServiceState[] }): React.JSX.Element => {
    const readyIds: string[] = [];

    for (const state of states) {
        if (state.status === "ready") {
            readyIds.push(state.id);
        }
    }

    const summary = readyIds.join(", ");

    return (
        <Box paddingX={1}>
            <Text bold color="green">
                {"● "}
                Services
            </Text>
            <Text>
                {"  "}
                {String(readyIds.length)}
                {" / "}
                {String(states.length)}
                {" running"}
            </Text>
            {summary.length > 0 && (
                <Text dimColor>
                    {"  "}
                    {summary}
                </Text>
            )}
            <Text dimColor>{"  [Tab ↓]"}</Text>
        </Box>
    );
};

const CrashHeader = ({ states }: { states: ServiceState[] }): React.JSX.Element => {
    const crashed = states.find((state) => state.status === "crashed" || state.status === "failed");

    if (!crashed) {
        return <></>;
    }

    return (
        <Box flexDirection="column" paddingX={1}>
            <Text bold color="red">
                {"✖ "}
                Service crashed:
{" "}
{crashed.id}
            </Text>
            {crashed.tailLines.slice(-3).map((line, index) => (
                <Text color="red" dimColor key={`crash-${String(index)}`}>
                    {"   "}
                    {line}
                </Text>
            ))}
        </Box>
    );
};

const ServiceDock = ({ activeIndex, focused, store }: ServiceDockProps): React.JSX.Element => {
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const ids = store.getIds();

    if (ids.length === 0) {
        return <></>;
    }

    const states: ServiceState[] = [];

    for (const id of ids) {
        const state = snapshot.get(id);

        if (state !== undefined) {
            states.push(state);
        }
    }
    const dockState = store.getDockState();
    const borderColor = dockState === "crash" ? "red" : dockState === "ready" ? "gray" : focused ? "white" : "cyan";
    const title = dockState === "crash" ? "Services (crashed)" : dockState === "ready" ? "Services" : "Services (starting)";
    const bottomHint = focused
        ? dockState === "crash"
            ? "↑↓ select  Enter logs  R retry  Esc back"
            : "↑↓ select  Enter logs  Esc back"
        : "Tab to focus services";

    if (dockState === "ready" && !focused) {
        return (
            <Box borderColor={borderColor} borderStyle="single" flexDirection="row" flexShrink={0}>
                <StatusPill states={states} />
            </Box>
        );
    }

    // Expanded mode (boot / crash / focused) takes a 2:1 share of
    // remaining vertical space against the task list above. Services
    // are hidden from the task list (they live in the dock), so the
    // task column is mostly the user's own task — letting the dock
    // dominate keeps the live boot status in focus, which is the
    // information the user actually cares about during this phase.
    // minHeight reserves room for at least 4 service rows + 2 borders
    // so the panel doesn't squish to a sliver on short workspaces.
    return (
        <Box
            borderBottomTitle={bottomHint}
            borderColor={borderColor}
            borderStyle={focused ? "bold" : "single"}
            borderTopTitle={title}
            flexDirection="column"
            flexGrow={2}
            flexShrink={0}
            minHeight={6}
            paddingX={1}
        >
            {dockState === "crash" && <CrashHeader states={states} />}
            {states.map((state, index) => (
                <ServiceRow active={index === activeIndex} focused={focused} key={state.id} state={state} />
            ))}
        </Box>
    );
};

export default ServiceDock;
