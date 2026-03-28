/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers";

runIssue450RerenderFixture({
    completionMarker: "__GROW_TO_FULLSCREEN_RERENDER_COMPLETED__",
    heightForFrame: (rows, frameCount) => (frameCount < 2 ? rows - 1 : rows),
});
