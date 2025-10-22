import { redact } from "@visulima/redact/dist/dist";
import { bench, describe } from "vitest";

const input = [
    1,
    "password",
    3,
    "user",
    {
        password: "123456",
        user: {
            email: "test@example.com",
            password: "123456",
        },
    },
];

describe("redact array", () => {
    bench("@visulima/redact", () => {
        const output = redact(input, ["1"]);

        if (output[1] === "password") {
            throw new Error("Expected key 1 to be '<PASSWORD>'");
        }
    });
});
