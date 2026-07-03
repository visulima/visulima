import process from "node:process";

import React from "react";

import { useApp } from "../../../src/ink/hooks/use-app";
import { useInput } from "../../../src/ink/hooks/use-input";
import { render } from "../../../src/ink/index";

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
