export type { MatcherResult, MatcherTarget } from "./matchers";
export {
    emailMatchers,
    registerEmailMatchers,
    toHaveSentMatching,
    toHaveSentTo,
    toHaveSentWithAttachment,
    toHaveSentWithSubject,
} from "./matchers";
export type { TestEmail } from "./test-email";
export { createTestEmail } from "./test-email";
