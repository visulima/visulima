/* eslint-disable jsdoc/check-indentation, jsdoc/lines-before-block, jsdoc/match-description */
/**
 * DevTools — optional development overlay for TUI apps.
 *
 * Wraps your app and renders a HUD in the bottom-right corner.
 * Render rate is measured from actual render events (not a timer guess).
 *
 * Usage:
 *   import { DevTools } from '@visulima/tui/react'
 *
 *   render(
 *     &lt;DevTools>
 *       &lt;MyApp />
 *     &lt;/DevTools>
 *   )
 *
 * Props:
 *   enabled?   boolean   — show/hide without removing from tree (default: true)
 *
 * Future slots: render count, memory usage, custom metrics via props.
 */
import React, { useEffect, useRef, useState } from "react";

import { useTuiContext, useWindowSize } from "./hooks";
import { _Box as Box, _Spacer as Spacer, _Text as Text } from "./react";

export interface DevToolsProps {
    children: React.ReactNode;
    /** Show/hide the HUD without unmounting (default: true) */
    enabled?: boolean;
}

/**
 * Measures actual render throughput by counting 'render' events on the app.
 * Returns FPS averaged over the last 500ms window.
 */
function useFpsCounter() {
    const { app } = useTuiContext();
    const [fps, setFps] = useState(0);
    const frames = useRef(0);
    const windowStart = useRef(Date.now());
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const onRender = () => {
            // Reset the idle timeout — 2s of no renders → show '--'
            if (idleTimer.current) {
                clearTimeout(idleTimer.current);
            }

            idleTimer.current = setTimeout(() => {
                setFps(0);
                frames.current = 0;
                windowStart.current = Date.now();
            }, 2000);

            frames.current++;
            const now = Date.now();
            const elapsed = now - windowStart.current;

            if (elapsed >= 500) {
                setFps(Math.round((frames.current / elapsed) * 1000));
                frames.current = 0;
                windowStart.current = now;
            }
        };

        const unsub = app.onBeforeFlush(() => {
            onRender();
        });

        return () => {
            unsub();

            if (idleTimer.current) {
                clearTimeout(idleTimer.current);
            }
        };
    }, [app]);

    return fps;
}

/** Small updates/sec badge */
const FpsHud = ({ fps }: { fps: number }) => {
    const label = fps === 0 ? "--" : String(fps);

    return (
        <Box borderColor="gray" borderStyle="round" paddingX={1}>
            <Text dim>
{label}
{" "}
updates/sec
            </Text>
        </Box>
    );
};

export const DevTools = ({ children, enabled = true }: DevToolsProps): React.ReactElement => {
    const fps = useFpsCounter();
    const { columns, rows } = useWindowSize();

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            {/* App content fills all available space */}
            <Box flexGrow={1}>{children}</Box>

            {/* HUD row — only takes space when enabled */}
            {enabled && (
                <Box flexDirection="row" flexShrink={0}>
                    <Spacer />
                    <FpsHud fps={fps} />
                </Box>
            )}
        </Box>
    );
};
