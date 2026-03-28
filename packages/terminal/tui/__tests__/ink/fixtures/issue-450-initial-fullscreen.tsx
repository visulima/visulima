/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import { runIssue450InitialFixture } from "./issue-450-fixture-helpers.js";

runIssue450InitialFixture({
    lineCount: 3,
    linePrefix: "#450 initial fullscreen",
    renderedMarker: "__INITIAL_FULLSCREEN_FRAME_RENDERED__",
});
