import { runIssue450InitialFixture } from "./issue-450-fixture-helpers";

runIssue450InitialFixture({
    lineCount: 3,
    linePrefix: "#450 initial fullscreen",
    renderedMarker: "__INITIAL_FULLSCREEN_FRAME_RENDERED__",
});
