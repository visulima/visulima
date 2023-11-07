import { describe, expect, it } from "vitest";

import { VisulimaError } from "../src";

class MyError extends VisulimaError {}

describe("error", () => {
    it("should be a instance of the thrown error", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ name: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toBeInstanceOf(MyError);
    });

    it("should have name prop", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ name: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toHaveProperty("name", "MyError");
    });

    it("should have constructor.name as give error name", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ name: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_.constructor).toHaveProperty("name", "MyError");
    });

    it("should have name and message prop", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ message: "MyError", name: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toHaveProperty("name", "MyError");
        expect(error_).toHaveProperty("message", "MyError");
    });

    it("should have name, hint and message prop", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ hint: "MyError", message: "MyError", name: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toHaveProperty("name", "MyError");
        expect(error_).toHaveProperty("message", "MyError");
        expect(error_).toHaveProperty("hint", "MyError");
    });

    it("should have name, hint, title and message prop", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ hint: "MyError", message: "MyError", name: "MyError", title: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toHaveProperty("name", "MyError");
        expect(error_).toHaveProperty("message", "MyError");
        expect(error_).toHaveProperty("hint", "MyError");
        expect(error_).toHaveProperty("title", "MyError");
    });

    it("should have name, hint, title, loc and message prop", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        let error_: Error;

        try {
            throw new MyError({ hint: "MyError", location: { column: 1, file: "MyError", line: 1 }, message: "MyError", name: "MyError", title: "MyError" });
        } catch (error) {
            error_ = error;
        }

        expect(error_).toHaveProperty("name", "MyError");
        expect(error_).toHaveProperty("message", "MyError");
        expect(error_).toHaveProperty("hint", "MyError");
        expect(error_).toHaveProperty("title", "MyError");
        expect(error_).toHaveProperty("loc", { column: 1, file: "MyError", line: 1 });
    });
});
