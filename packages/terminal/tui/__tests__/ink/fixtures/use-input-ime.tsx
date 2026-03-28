/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React from "react";

import { render, Text, useApp, useInput } from "../../../src/ink/index.js";

const IMEInput = ({ test }: { readonly test: string | undefined }) => {
    const { exit } = useApp();
    const [received, setReceived] = React.useState<string>("");

    useInput(
        (input, _key) => {
            if (test === "chinese") {
                setReceived(input);

                if (input === "\u4F60\u597D") {
                    // "你好"
                    exit();
                }
            }

            if (test === "japanese") {
                setReceived(input);

                if (input === "\u3053\u3093\u306B\u3061\u306F") {
                    // "こんにちは"
                    exit();
                }
            }

            if (test === "korean") {
                setReceived(input);

                if (input === "\uC548\uB155") {
                    // "안녕"
                    exit();
                }
            }

            if (test === "thai") {
                setReceived(input);

                if (input === "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35") {
                    // "สวัสดี"
                    exit();
                }
            }

            if (test === "mixedInput") {
                setReceived((previous) => previous + input);

                // After receiving IME text followed by ASCII
                if (input === "x") {
                    exit();
                }
            }
        },
        {
            imeTimeout: 30,
        },
    );

    React.useEffect(() => {
        process.stdout.write("__READY__");
    }, []);

    return <Text>received:{received}</Text>;
};

const app = render(<IMEInput test={process.argv[2]} />);

await app.waitUntilExit();
console.log("exited");
