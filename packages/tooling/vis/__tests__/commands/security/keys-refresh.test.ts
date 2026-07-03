import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pailMock = { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() };

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: pailMock };
});

const clearRegistryKeysCacheMock = vi.fn(() => true);
const fetchRegistryKeysMock = vi.fn(async () => {
    return { fromCache: false, keys: [{ key: "ABC", keyid: "sha256-abc" }] };
});

vi.mock(import("../../../src/security/marshalls/registry-keys"), () => {
    return {
        clearRegistryKeysCache: clearRegistryKeysCacheMock,
        fetchRegistryKeys: fetchRegistryKeysMock,
    };
});

const handlerPromise = import("../../../src/commands/security/keys-refresh");

interface ToolboxShape {
    options: { clear?: boolean; json?: boolean };
}

const buildToolbox = (options: ToolboxShape["options"] = {}): ToolboxShape => {
    return { options };
};

describe("security keys-refresh handler", () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;
    let written: string[];

    beforeEach(() => {
        clearRegistryKeysCacheMock.mockClear();
        clearRegistryKeysCacheMock.mockReturnValue(true);
        fetchRegistryKeysMock.mockClear();
        fetchRegistryKeysMock.mockResolvedValue({ fromCache: false, keys: [{ key: "ABC", keyid: "sha256-abc" }] });

        pailMock.error.mockClear();
        pailMock.info.mockClear();
        pailMock.success.mockClear();
        pailMock.warn.mockClear();

        written = [];
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
            written.push(String(chunk));

            return true;
        });
    });

    afterEach(() => {
        writeSpy.mockRestore();
        process.exitCode = undefined;
    });

    it("--clear drops the cache without refetching", async () => {
        expect.assertions(3);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ clear: true }) as never);

        expect(clearRegistryKeysCacheMock).toHaveBeenCalledTimes(1);
        expect(fetchRegistryKeysMock).not.toHaveBeenCalled();
        expect(pailMock.success).toHaveBeenCalledWith("Cleared cached npm signing keys.");
    });

    it("--clear with nothing cached reports a friendlier message", async () => {
        expect.assertions(1);

        clearRegistryKeysCacheMock.mockReturnValueOnce(false);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ clear: true }) as never);

        expect(pailMock.success).toHaveBeenCalledWith("No cached npm signing keys to clear.");
    });

    it("--clear --json emits the clear result without refetching", async () => {
        expect.assertions(3);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ clear: true, json: true }) as never);

        expect(fetchRegistryKeysMock).not.toHaveBeenCalled();

        const payload = JSON.parse(written.join(""));

        expect(payload).toStrictEqual({ cleared: true, refetched: false });
        expect(pailMock.success).not.toHaveBeenCalled();
    });

    it("default path force-refreshes WITHOUT pre-clearing the cache", async () => {
        // Regression: previously the handler cleared the cache before fetching.
        // That defeated stale-while-revalidate — a network failure would leave the
        // signatures marshall with no keys at all. We must NOT touch the cache here.
        expect.assertions(3);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(clearRegistryKeysCacheMock).not.toHaveBeenCalled();
        expect(fetchRegistryKeysMock).toHaveBeenCalledWith({ forceRefresh: true });
        expect(pailMock.success).toHaveBeenCalledWith("Refreshed npm signing keys (1 keys).");
    });

    it("--json on a successful refresh reports the key count and cleared:false", async () => {
        expect.assertions(2);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ json: true }) as never);

        const payload = JSON.parse(written.join(""));

        expect(payload).toMatchObject({ cleared: false, fromCache: false, keyCount: 1, refetched: true, stale: false });
        expect(pailMock.success).not.toHaveBeenCalled();
    });

    it("warns and exits 0 when fetch falls back to stale cache", async () => {
        expect.assertions(3);

        fetchRegistryKeysMock.mockResolvedValueOnce({ fromCache: true, keys: [{ key: "ABC", keyid: "sha256-abc" }], stale: true });

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.warn).toHaveBeenCalledWith(expect.stringContaining("falling back to expired cache"));
        expect(pailMock.error).not.toHaveBeenCalled();
        expect(process.exitCode).toBeUndefined();
    });

    it("errors and exits 1 when fetch fails and no cache exists", async () => {
        expect.assertions(3);

        fetchRegistryKeysMock.mockResolvedValueOnce(undefined);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox() as never);

        expect(pailMock.error).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch npm signing keys"));
        expect(process.exitCode).toBe(1);
        // Critical: we did NOT call clearRegistryKeysCache, so any existing entry
        // is still on disk for the signatures marshall to consume.
        expect(clearRegistryKeysCacheMock).not.toHaveBeenCalled();
    });

    it("--json fetch-failed emits a parsable error payload and sets exit 1", async () => {
        expect.assertions(2);

        fetchRegistryKeysMock.mockResolvedValueOnce(undefined);

        const { default: execute } = await handlerPromise;

        await execute(buildToolbox({ json: true }) as never);

        const payload = JSON.parse(written.join(""));

        expect(payload).toStrictEqual({ cleared: false, error: "fetch-failed", refetched: false });
        expect(process.exitCode).toBe(1);
    });
});
