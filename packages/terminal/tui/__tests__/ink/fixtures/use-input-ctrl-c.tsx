import process from "node:process";

import React from "react";

import { render, useApp, useInput } from "../../../src/ink/index";

const UserInput = () => {
    const { exit } = useApp();

    useInput((input, key) => {
        if (input === "c" && key.ctrl) {
            exit();

            return;
        }

        throw new Error("Crash");
    });

    React.useEffect(() => {
        process.stdout.write("__READY__");
    }, []);

    return null;
};

const app = render(<UserInput />, { exitOnCtrlC: false });

await app.waitUntilExit();
console.log("exited");
