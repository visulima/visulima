/* eslint-disable import/no-extraneous-dependencies */
import terminalSize from "terminal-size";
import { bench, describe } from "vitest";

import { boxen as visulimaBoxen } from "../src";

/**
 * This benchmark targets the perf fix where boxen() now calls terminalSize()
 * exactly once and threads the result into sanitizeOptions/determineDimensions,
 * instead of invoking terminalSize() a second time inside sanitizeOptions when
 * `fullscreen` is set.
 *
 * In a non-TTY context (piped output / CI / redirected logs) terminal-size@4
 * falls back to a synchronous child-process spawn (tput/stty/PowerShell), so
 * every extra terminalSize() call blocks the event loop. The "previous"
 * baseline below emulates that by performing one extra terminalSize() call per
 * iteration before rendering — the same redundant work the old code path did.
 */

const text = "Hello,\nworld!\nThis is a test of fullscreen rendering.";

describe("Fullscreen rendering (single vs double terminalSize call)", () => {
    bench("optimized: single terminalSize() call", () => {
        visulimaBoxen(text, { borderStyle: "round", fullscreen: true, padding: 1 });
    });

    bench("previous: extra terminalSize() call per render", () => {
        // Emulates the pre-fix behaviour: sanitizeOptions() re-invoked
        // terminalSize() a second time when fullscreen was set.
        terminalSize();

        visulimaBoxen(text, { borderStyle: "round", fullscreen: true, padding: 1 });
    });
});
