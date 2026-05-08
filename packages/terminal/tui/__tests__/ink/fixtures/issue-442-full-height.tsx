import process from "node:process";

import React, { useEffect } from "react";

import { Box, Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

const App = () => {
    const { exit } = useApp();

    useEffect(() => {
        const timer = setTimeout(() => {
            exit();
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [exit]);

    const rows = Number(process.argv[2]) || 5;
    const columns = process.stdout.columns || 100;

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <Box flexGrow={1}>
                <Text>#442 top</Text>
            </Box>
            <Text>#442 bottom</Text>
        </Box>
    );
};

process.stdout.rows = Number(process.argv[2]) || 5;

render(<App />);
