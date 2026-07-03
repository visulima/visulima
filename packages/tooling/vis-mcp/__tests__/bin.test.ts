import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main } from "../src/bin";
import { startMcpServer } from "../src/server";

// `main()` calls `startMcpServer` and forwards failures to stderr + exit(1).
// Mocking the server module keeps this a pure in-process unit test — no
// stdio transport, no child process. That's important because `bin.ts` used
// to be 0% covered: V8 coverage instrumentation never crosses the
// child-process boundary that the integration test uses to spawn the binary.
vi.mock(import("../src/server"), () => {
    return {
        startMcpServer: vi.fn<() => Promise<void>>(),
    };
});

const mockedStartMcpServer = vi.mocked(startMcpServer);

// `process.exit` has the `(code?: number) => never` signature; the spy
// replacement must keep that shape so test expectations type-check.
let exitSpy: MockInstance<(code?: number | string | null) => never>;
let stderrSpy: MockInstance<(typeof process.stderr)["write"]>;

beforeEach(() => {
    mockedStartMcpServer.mockReset();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => undefined) as never);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
});

describe(main, () => {
    it("should resolve without writing to stderr when startMcpServer succeeds", async () => {
        expect.assertions(3);

        mockedStartMcpServer.mockResolvedValueOnce(undefined);

        await main();

        expect(mockedStartMcpServer).toHaveBeenCalledTimes(1);
        expect(stderrSpy).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("should write the Error message to stderr and exit(1) when startMcpServer rejects", async () => {
        expect.assertions(3);

        mockedStartMcpServer.mockRejectedValueOnce(new Error("boot blew up"));

        await main();

        expect(stderrSpy).toHaveBeenCalledTimes(1);

        // First arg is the formatted message; assert it includes both the
        // prefix and the underlying error text.
        const message = String(stderrSpy.mock.calls[0]![0]);

        expect(message).toContain("[vis-mcp] failed to start: boot blew up");

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should coerce non-Error rejections to a string before logging", async () => {
        expect.assertions(2);

        mockedStartMcpServer.mockRejectedValueOnce("string thrown");

        await main();

        const message = String(stderrSpy.mock.calls[0]![0]);

        expect(message).toContain("string thrown");

        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
