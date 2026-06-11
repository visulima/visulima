import type { MockEmailEntry } from "../providers/mock/types";
import type { EmailAddress, EmailOptions } from "../types";
import type { TestEmail } from "./test-email";

/**
 * The minimal result shape a Vitest/Jest matcher must return.
 */
interface MatcherResult {
    message: () => string;
    pass: boolean;
}

/**
 * A value the email matchers can assert against: a {@link TestEmail} harness or a raw list of captured
 * entries.
 */
type MatcherTarget = ReadonlyArray<MockEmailEntry> | TestEmail;

const toEntries = (target: MatcherTarget): ReadonlyArray<MockEmailEntry> => {
    if (Array.isArray(target)) {
        return target;
    }

    return (target as TestEmail).sent();
};

const addressesOf = (value: EmailAddress | EmailAddress[] | undefined): string[] => {
    if (!value) {
        return [];
    }

    return (Array.isArray(value) ? value : [value]).map((address) => address.email.toLowerCase());
};

const recipientsOf = (options: EmailOptions): string[] => [...addressesOf(options.to), ...addressesOf(options.cc), ...addressesOf(options.bcc)];

/**
 * Asserts that at least one captured message was addressed to `address` (in To, Cc, or Bcc).
 * @param target The {@link TestEmail} harness or captured entries.
 * @param address The recipient address to look for (case-insensitive).
 * @returns The matcher result.
 */
const toHaveSentTo = (target: MatcherTarget, address: string): MatcherResult => {
    const wanted = address.toLowerCase();
    const pass = toEntries(target).some((entry) => recipientsOf(entry.options).includes(wanted));

    return {
        message: () => `expected ${pass ? "no " : ""}email to have been sent to ${address}`,
        pass,
    };
};

/**
 * Asserts that at least one captured message has a subject equal to (or matching) `expected`.
 * @param target The {@link TestEmail} harness or captured entries.
 * @param expected An exact subject string or a `RegExp`.
 * @returns The matcher result.
 */
const toHaveSentWithSubject = (target: MatcherTarget, expected: RegExp | string): MatcherResult => {
    const pass = toEntries(target).some((entry) => {
        if (typeof expected === "string") {
            return entry.options.subject === expected;
        }

        return expected.test(entry.options.subject);
    });

    return {
        message: () => `expected ${pass ? "no " : ""}email to have been sent with subject ${String(expected)}`,
        pass,
    };
};

/**
 * Asserts that at least one captured message carried an attachment (optionally with a given filename).
 * @param target The {@link TestEmail} harness or captured entries.
 * @param filename When provided, requires an attachment with this exact filename.
 * @returns The matcher result.
 */
const toHaveSentWithAttachment = (target: MatcherTarget, filename?: string): MatcherResult => {
    const pass = toEntries(target).some((entry) => {
        const attachments = entry.options.attachments ?? [];

        if (filename === undefined) {
            return attachments.length > 0;
        }

        return attachments.some((attachment) => attachment.filename === filename);
    });

    return {
        message: () => `expected ${pass ? "no " : ""}email to have been sent with attachment${filename ? ` "${filename}"` : ""}`,
        pass,
    };
};

/**
 * Asserts that at least one captured message matches a predicate or a partial {@link EmailOptions}.
 * @param target The {@link TestEmail} harness or captured entries.
 * @param matcher A predicate over the sent options, or a partial options object to shallow-match.
 * @returns The matcher result.
 */
const toHaveSentMatching = (target: MatcherTarget, matcher: Partial<EmailOptions> | ((options: EmailOptions) => boolean)): MatcherResult => {
    const predicate
        = typeof matcher === "function"
            ? matcher
            : (options: EmailOptions): boolean =>
                Object.entries(matcher).every(([key, value]) => (options as unknown as Record<string, unknown>)[key] === value);

    const pass = toEntries(target).some((entry) => predicate(entry.options));

    return {
        message: () => `expected ${pass ? "no " : ""}email to have been sent matching the given condition`,
        pass,
    };
};

/**
 * The matcher map, suitable for passing to Vitest/Jest `expect.extend(...)`.
 */
const emailMatchers: {
    toHaveSentMatching: typeof toHaveSentMatching;
    toHaveSentTo: typeof toHaveSentTo;
    toHaveSentWithAttachment: typeof toHaveSentWithAttachment;
    toHaveSentWithSubject: typeof toHaveSentWithSubject;
} = {
    toHaveSentMatching,
    toHaveSentTo,
    toHaveSentWithAttachment,
    toHaveSentWithSubject,
};

/**
 * The shape of the {@link emailMatchers} map.
 */
type EmailMatchers = typeof emailMatchers;

/**
 * A Vitest/Jest-compatible `expect` exposing `.extend(...)`.
 */
interface ExpectLike {
    extend: (matchers: Record<string, unknown>) => void;
}

/**
 * Registers the email matchers with a Vitest/Jest-compatible `expect`.
 *
 * Kept dependency-free by accepting `expect` as an argument rather than importing `vitest` into the
 * shipped bundle. Add the matching type augmentation to a `vitest.d.ts` in your project for typed
 * `expect(...).toHaveSentTo(...)` calls.
 * @param expectInstance The `expect` object exposing `.extend(...)`.
 * @example
 * ```ts
 * import { expect } from "vitest";
 * import { registerEmailMatchers } from "@visulima/email/test";
 *
 * registerEmailMatchers(expect);
 * ```
 */
const registerEmailMatchers = (expectInstance: ExpectLike): void => {
    expectInstance.extend(emailMatchers);
};

export type { EmailMatchers, MatcherResult, MatcherTarget };
export { emailMatchers, registerEmailMatchers, toHaveSentMatching, toHaveSentTo, toHaveSentWithAttachment, toHaveSentWithSubject };
