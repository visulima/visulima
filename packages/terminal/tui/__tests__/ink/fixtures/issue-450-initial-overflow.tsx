import { runIssue450InitialFixture } from "./issue-450-fixture-helpers";

runIssue450InitialFixture({
    lineCount: 4,
    linePrefix: "#450 initial overflow",
    renderedMarker: "__INITIAL_OVERFLOW_FRAME_RENDERED__",
});
