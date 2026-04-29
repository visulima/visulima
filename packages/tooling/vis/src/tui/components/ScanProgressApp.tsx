import { Box, Spinner, Text } from "@visulima/tui";
import React from "react";

import { CROSS, DASH, TICK, WARNING } from "../symbols";

export type ScanRowStatus = "error" | "ok" | "pending" | "running" | "skip" | "warn";

export interface ScanRowState {
    /** Stable id matching the corresponding `ScanTask`. */
    readonly id: string;
    /** Human label rendered before completion. */
    readonly label: string;
    readonly status: ScanRowStatus;
    /** Trailing dim summary, shown once a row finishes. */
    readonly summary?: string;
}

interface ScanProgressProps {
    readonly rows: ReadonlyArray<ScanRowState>;
}

/**
 * Multi-row live progress for parallel scans (doctor / audit).
 *
 * Each row carries its own status: a spinner while running, a final
 * glyph + dim summary on completion. Rerenders are driven externally
 * via `progress.start` / `progress.finish` on the wrapper returned by
 * `startScanProgress()`.
 */
const ScanProgressApp = ({ rows }: ScanProgressProps): React.JSX.Element => (
    <Box flexDirection="column">
        {rows.map((row) => {
            let icon: React.ReactElement;

            switch (row.status) {
                case "error": {
                    icon = <Text color="red">{CROSS}</Text>;
                    break;
                }
                case "ok": {
                    icon = <Text color="green">{TICK}</Text>;
                    break;
                }
                case "running": {
                    icon = (
                        <Text color="white">
                            <Spinner type="dots" />
                        </Text>
                    );
                    break;
                }
                case "warn": {
                    icon = <Text color="yellow">{WARNING}</Text>;
                    break;
                }
                default: {
                    icon = <Text dimColor>{DASH}</Text>;
                    break;
                }
            }

            return (
                <Box key={row.id}>
                    <Box width={3}>{icon}</Box>
                    <Box flexGrow={1}>
                        <Text>{row.label}</Text>
                    </Box>
                    {row.summary
                        ? (
                            <Box>
                                <Text dimColor>
                                    {DASH}
                                    {" "}
                                    {row.summary}
                                </Text>
                            </Box>
                        )
                        : null}
                </Box>
            );
        })}
    </Box>
);

export default ScanProgressApp;
