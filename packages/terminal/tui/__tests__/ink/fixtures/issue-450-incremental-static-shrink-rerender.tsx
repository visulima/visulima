import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers";

// First frame at full height, second frame shrinks to rows - 1 with Static content.
// Tests that Static output is not dropped in the incremental early-return path.
runIssue450RerenderFixture({
    heightForFrame: (rows, frameCount) => (frameCount === 0 ? rows : rows - 1),
    includeStaticLine: true,
    incrementalRendering: true,
});
