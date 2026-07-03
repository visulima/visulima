import { describe, expect, it } from "vitest";

import PackageNotFoundError from "../../../src/error/package-not-found-error";

describe("packageNotFoundError", () => {
    it("should include package name and package manager in error message", () => {
        expect.assertions(1);

        const packageName = "lodash";
        const packageManager = "yarn";
        const error = new PackageNotFoundError(packageName, packageManager);

        expect(error.message).toContain(`Package '${packageName}' was not found. Please install it using '${packageManager} install ${packageName}'`);
    });

    it("should include package name and default package manager in error message", () => {
        expect.assertions(1);

        const packageName = "react";
        const error = new PackageNotFoundError(packageName);

        expect(error.message).toContain(`Package '${packageName}' was not found. Please install it using 'pnpm install ${packageName}'`);
    });

    it("should include generic message in error message for empty package name array", () => {
        expect.assertions(1);

        const packageName = [];
        const error = new PackageNotFoundError(packageName);

        expect(error.message).toContain("Package was not found.");
    });

    it("should include generic message in error message for invalid package manager name", () => {
        expect.assertions(1);

        const packageName = "jest";
        const packageManager = "invalid";
        const error = new PackageNotFoundError(packageName, packageManager);

        expect(error.message).toContain(`Package '${packageName}' was not found. Please install it using '${packageManager} install ${packageName}'`);
    });

    it("should have the name 'PackageNotFoundError'", () => {
        expect.assertions(1);

        const error = new PackageNotFoundError("File already exists");

        expect(error.name).toBe("PackageNotFoundError");
    });

    it("should have the code 'PACKAGE_NOT_FOUND'", () => {
        expect.assertions(1);

        const error = new PackageNotFoundError("File already exists");

        expect(error.code).toBe("PACKAGE_NOT_FOUND");
    });

    it("should throw an error when overriding the name property", () => {
        expect.assertions(1);

        const error = new PackageNotFoundError("File already exists");

        expect(() => {
            error.name = "CustomError";
        }).toThrow("Cannot overwrite name of PackageNotFoundError");
    });

    it("should be read-only when accessing the code property", () => {
        expect.assertions(1);

        const error = new PackageNotFoundError("Invalid operation");

        expect(() => {
            error.code = "PackageNotFoundError";
        }).toThrow("Cannot overwrite code PACKAGE_NOT_FOUND");
    });
});
