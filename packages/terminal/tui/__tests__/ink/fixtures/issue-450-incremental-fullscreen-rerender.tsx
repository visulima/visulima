import { runIssue450RerenderFixture } from "./issue-450-fixture-helpers";

runIssue450RerenderFixture({
    heightForFrame: (rows) => rows,
    incrementalRendering: true,
});
