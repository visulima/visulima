import process from "node:process";

import React, { useEffect, useState } from "react";

import { Box, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

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
