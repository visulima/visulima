import { beforeEach, describe, expect, it, vi } from "vitest";

import { findPackageRoot } from "../src/package";

const { findUp } = vi.hoisted(() => {
    return {
        findUp: vi.fn(),
    };
});

vi.mock("find-up", async (importOriginal) => {
    const module = await importOriginal();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        // @ts-expect-error - types are wrong
        ...module,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findUp,
    };
});

describe("package", () => {
    describe("findPackageRoot", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should find LockFile", async () => {
            findUp.mockResolvedValueOnce("/user/project/package-lock.json");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("should find Git Config", async () => {
            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce("/user/project/.git/config");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("should find Package.json", async () => {
            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            // This is used for the git config lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce("/user/project/package.json");

            const result = await findPackageRoot();

            expect(result).toBe("/user/project");
        });

        it("Throws error when no root directory is found", async () => {
            // This is used for the lock file lookup
            findUp.mockResolvedValueOnce(undefined);
            // This is used for the git config lookup
            findUp.mockResolvedValueOnce(undefined);
            findUp.mockResolvedValueOnce(undefined);

            try {
                await findPackageRoot();
                expect(true).toBe(false); // This is to make sure error is thrown.
            } catch (e) {
                expect(true).toBe(true);
            }
        });
    });
});
