/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers";

runIssue450RerenderFixture({
    frameLimit: 1,
    heightForFrame: (rows, frameCount) => (frameCount === 0 ? rows - 1 : rows + 1),
    rowsFallback: 3,
});
