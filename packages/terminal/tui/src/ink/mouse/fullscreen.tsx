/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { PropsWithChildren } from "react";
import React from "react";

import Box from "../../components/box";
import useWindowSize from "../hooks/use-window-size";

const Fullscreen = ({ children }: PropsWithChildren): React.JSX.Element => {
    const { columns, rows } = useWindowSize();

    return (
        <Box flexGrow={1} height={rows} width={columns}>
            {children}
        </Box>
    );
};

export default Fullscreen;
