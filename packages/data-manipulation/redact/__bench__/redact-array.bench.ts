import { redact } from "@visulima/redact";
import { describe, test } from "vitest";

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
    test("@visulima/redact", async ({ bench }) => {
        await bench("@visulima/redact", () => {
            const output = redact(input, ["1"]);

            if (output[1] === "password") {
                throw new Error("Expected key 1 to be '<PASSWORD>'");
            }
        }).run();
    });
});
