/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers";

runIssue450RerenderFixture({
    heightForFrame: (rows, frameCount) => (frameCount < 2 ? rows : rows - 1),
});
