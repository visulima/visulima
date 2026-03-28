/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React, { useEffect, useState } from "react";

import { Box, render, Text } from "../../../src/ink/index";

const Erase = () => {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
        });

        return () => {
            clearTimeout(timer);
        };
    }, []);

    return (
        <Box flexDirection="column">
            {show
                ? (
                    <>
                        <Text>A</Text>
                        <Text>B</Text>
                        <Text>C</Text>
                    </>
                )
                : null}
        </Box>
    );
};

process.stdout.rows = Number(process.argv[2]);
render(<Erase />);
