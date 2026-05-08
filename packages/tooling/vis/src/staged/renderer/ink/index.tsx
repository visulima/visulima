import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Spinner } from "@visulima/tui/components/spinner";
import { Text } from "@visulima/tui/components/text";
import type { ReactElement } from "react";

import { CROSS, DASH, TICK } from "../../../tui/symbols";
import type { Renderer, TaskStatus } from "../../types";

interface CommandState {
    durationMs: number;
    error?: Error;
    readonly id: string;
    output?: string;
    status: TaskStatus;
    readonly title: string;
}

interface PatternState {
    commands: Map<string, CommandState>;
    readonly id: string;
    status: TaskStatus;
    readonly title: string;
}

interface AppState {
    errorMessages: { error?: Error; message: string }[];
    infoMessages: string[];
    patterns: Map<string, PatternState>;
    started: boolean;
    warnMessages: string[];
}

interface AppProps {
    readonly state: AppState;
    readonly tick: number;
    readonly verbose: boolean;
}

const colorForStatus = (status: TaskStatus): string => {
    switch (status) {
        case "failed": {
            return "red";
        }
        case "running": {
            return "cyan";
        }
        case "skipped": {
            return "yellow";
        }
        case "success": {
            return "green";
        }
        default: {
            return "gray";
        }
    }
};

const iconForStatus = (status: TaskStatus): ReactElement => {
    if (status === "running") {
        return <Spinner type="dots" />;
    }

    const glyph = status === "failed" ? CROSS : status === "skipped" ? DASH : status === "success" ? TICK : DASH;

    return <Text color={colorForStatus(status)}>{glyph}</Text>;
};

const App = ({ state, tick: _tick, verbose }: AppProps): ReactElement => (
    <Box flexDirection="column">
        {[...state.patterns.values()].map((pattern) => (
            <Box flexDirection="column" key={pattern.id}>
                <Box>
                    {iconForStatus(pattern.status)}
                    <Text>
{" "}
{pattern.title}
                    </Text>
                </Box>
                {[...pattern.commands.values()].map((command) => (
                    <Box flexDirection="column" key={command.id} marginLeft={2}>
                        <Box>
                            {iconForStatus(command.status)}
                            <Text>
{" "}
{command.title}
{" "}
                            </Text>
                            {command.status !== "pending" && command.status !== "running"
                                ? (
                                <Text color="gray">
                                    (
{command.durationMs}
                                    ms)
                                </Text>
                                )
                                : null}
                        </Box>
                        {verbose && command.output
                            ? (
                            <Box flexDirection="column" marginLeft={2}>
                                {command.output
                                    .split(/\r?\n/)
                                    .slice(0, 20)
                                    .map((line, index) => (
                                        <Text color="gray" key={`${command.id}-line-${index}`}>
                                            {line}
                                        </Text>
                                    ))}
                            </Box>
                            )
                            : null}
                        {command.status === "failed" && command.error
                            ? (
                            <Box marginLeft={2}>
                                <Text color="red">{command.error.message}</Text>
                            </Box>
                            )
                            : null}
                    </Box>
                ))}
            </Box>
        ))}
        {state.infoMessages.map((message, index) => (
            <Text color="gray" key={`info-${index}`}>
                {message}
            </Text>
        ))}
        {state.warnMessages.map((message, index) => (
            <Text color="yellow" key={`warn-${index}`}>
                {message}
            </Text>
        ))}
        {state.errorMessages.map(({ message }, index) => (
            <Text color="red" key={`err-${index}`}>
                {message}
            </Text>
        ))}
    </Box>
);

export const createInkRenderer = (options: { readonly verbose?: boolean } = {}): Renderer => {
    const verbose = options.verbose === true;
    const state: AppState = {
        errorMessages: [],
        infoMessages: [],
        patterns: new Map(),
        started: false,
        warnMessages: [],
    };

    let tick = 0;
    // `exitOnCtrlC: false` hands SIGINT off to runStaged's dedicated handler so the stash/patch cleanup path
    // can run to completion. With the default `true`, Ink would `process.exit()` before our cleanup fires.
    const instance = render(<App state={state} tick={tick} verbose={verbose} />, { exitOnCtrlC: false, stdout: process.stderr });

    const refresh = (): void => {
        tick += 1;
        instance.rerender(<App state={state} tick={tick} verbose={verbose} />);
    };

    return {
        commandEnd({ commandId, durationMs, error, output, patternId, status }) {
            const command = state.patterns.get(patternId)?.commands.get(commandId);

            if (command) {
                command.status = status;
                command.durationMs = durationMs;
                command.output = output;
                command.error = error;
                refresh();
            }
        },
        commandStart({ commandId, patternId }) {
            const command = state.patterns.get(patternId)?.commands.get(commandId);

            if (command) {
                command.status = "running";
                refresh();
            }
        },
        error({ error, message }) {
            state.errorMessages.push({ error, message });
            refresh();
        },
        info({ message }) {
            state.infoMessages.push(message);
            refresh();
        },
        patternEnd({ patternId, status }) {
            const pattern = state.patterns.get(patternId);

            if (pattern) {
                pattern.status = status;
                refresh();
            }
        },
        patternStart({ patternId }) {
            const pattern = state.patterns.get(patternId);

            if (pattern) {
                pattern.status = "running";
                refresh();
            }
        },
        start({ patterns }) {
            state.started = true;

            for (const pattern of patterns) {
                const commandMap = new Map<string, CommandState>();

                for (const command of pattern.commands) {
                    commandMap.set(command.id, {
                        durationMs: 0,
                        id: command.id,
                        status: "pending",
                        title: command.title,
                    });
                }

                state.patterns.set(pattern.id, {
                    commands: commandMap,
                    id: pattern.id,
                    status: "pending",
                    title: pattern.title,
                });
            }

            refresh();
        },
        async stop() {
            instance.unmount();
            await instance.waitUntilExit();
        },
        warn({ message }) {
            state.warnMessages.push(message);
            refresh();
        },
    };
};
