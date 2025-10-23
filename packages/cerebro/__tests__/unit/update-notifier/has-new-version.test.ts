import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import hasNewVersion from "../../../src/update-notifier/has-new-version";

const { getDistributionVersion, getLastUpdate, saveLastUpdate } = vi.hoisted(() => {
    return {
        getDistributionVersion: vi.fn().mockReturnValue("1.0.0"),
        getLastUpdate: vi.fn(),
        saveLastUpdate: vi.fn(),
    };
});

vi.mock(import("../../../src/update-notifier/get-dist-version"), () => {
    return {
        default: getDistributionVersion,
    };
});
vi.mock(import("../../../src/update-notifier/cache"), () => {
    return {
        getLastUpdate,
        saveLastUpdate,
    };
});

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const package_ = { name: "has-new-version", version: "1.0.0" };

const defaultArguments = {
    alwaysRun: true,
    pkg: package_,
    shouldNotifyInNpmScript: true,
};

describe("update-notifier/has-new-version", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should not trigger update for same version", async () => {
        expect.assertions(1);

        const newVersion = await hasNewVersion(defaultArguments);

        expect(newVersion).toBeNull();
    });

    it("should trigger update for patch version bump", async () => {
        expect.assertions(1);

        vi.mocked(getDistributionVersion).mockReturnValue("1.0.1");

        const newVersion = await hasNewVersion(defaultArguments);

        expect(newVersion).toBe("1.0.1");
    });

    it("should trigger update for minor version bump", async () => {
        expect.assertions(1);

        vi.mocked(getDistributionVersion).mockReturnValue("1.1.0");

        const newVersion = await hasNewVersion(defaultArguments);

        expect(newVersion).toBe("1.1.0");
    });

    it("should trigger update for major version bump", async () => {
        expect.assertions(1);

        vi.mocked(getDistributionVersion).mockReturnValue("2.0.0");

        const newVersion = await hasNewVersion(defaultArguments);

        expect(newVersion).toBe("2.0.0");
    });

    it("should not trigger update if version is lower", async () => {
        expect.assertions(1);

        vi.mocked(getDistributionVersion).mockReturnValue("0.0.9");

        const newVersion = await hasNewVersion(defaultArguments);

        expect(newVersion).toBeNull();
    });

    it("should trigger update check if last update older than config", async () => {
        expect.assertions(2);

        const TWO_WEEKS = Date.now() - 1000 * 60 * 60 * 24 * 14;

        vi.mocked(getLastUpdate).mockReturnValue(TWO_WEEKS);

        const newVersion = await hasNewVersion({
            pkg: package_,
            shouldNotifyInNpmScript: true,
        });

        expect(newVersion).toBeNull();
        expect(getDistributionVersion).toHaveBeenCalledExactlyOnceWith("has-new-version", "latest", "https://registry.npmjs.org/-/package/__NAME__/dist-tags");
    });

    it("should not trigger update check if last update is too recent", async () => {
        expect.assertions(2);

        const TWELVE_HOURS = Date.now() - 1000 * 60 * 60 * 12;

        vi.mocked(getLastUpdate).mockReturnValue(TWELVE_HOURS);

        const newVersion = await hasNewVersion({
            pkg: package_,
            shouldNotifyInNpmScript: true,
        });

        expect(newVersion).toBeNull();
        expect(getDistributionVersion).not.toHaveBeenCalled();
    });
});
