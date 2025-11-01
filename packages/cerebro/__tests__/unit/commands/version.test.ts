import { describe, expect, it, vi } from "vitest";

import type { Cli as ICli } from "../../../src/@types/cli";
import type { Toolbox as IToolbox } from "../../../src/@types/toolbox";
import versionCommand from "../../../src/commands/version-command";

describe("command/version", () => {
    it("should output the version number when version is defined", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
        } satisfies Logger;
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue("1.0.0"),
        };

        await versionCommand.execute({ logger: loggerMock as unknown as Console, runtime: runtimeMock as unknown as ICli } as IToolbox);

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock).toMatchSnapshot();
    });

    it("should warn and debug when version is undefined", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue(undefined),
        };

        await versionCommand.execute({ logger: loggerMock as unknown as Console, runtime: runtimeMock as unknown as ICli } as IToolbox);

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock).toMatchSnapshot();
    });
});
