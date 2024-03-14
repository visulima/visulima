import { beforeEach, describe, expect, it, vi } from "vitest";

import { findPackageRoot } from "../../src/package";

const { findUp } = vi.hoisted(() => {
    return {
        findUp: vi.fn(),
    };
});

vi.mock("@visulima/fs", async (importOriginal) => {
    const module = await importOriginal();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        // @ts-expect-error - types are wrong
        ...module,

        findUp,
    };
});

describe("package", () => {
    describe("findPackageRoot", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should find LockFile", async () => {
            expect.assertions(1);

            findUp.mockResolvedValueOnce("/user/project/package-lock.json");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("should find Git Config", async () => {
            expect.assertions(1);

            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce("/user/project/.git/config");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("should find Package.json", async () => {
            expect.assertions(1);

            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            // This is used for the git config lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce("/user/project/package.json");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("throws error when no root directory is found", async () => {
            expect.assertions(1);

            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            // This is used for the git config lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce(undefined);

            try {
                await findPackageRoot();
                expect(true).toBeFalsy(); // This is to make sure error is thrown.
            } catch {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(true).toBeTruthy();
            }
        });
    });
});
