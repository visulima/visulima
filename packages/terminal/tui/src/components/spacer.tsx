/* eslint-disable react/function-component-definition */
import type { ReactElement } from "react";

import Box from "./box";

/**
 * A flexible space that expands along the major axis of its containing layout.
 *
 * It's useful as a shortcut for filling all the available space between elements.
 */
export default function Spacer(): ReactElement {
    return <Box flexGrow={1} />;
}

export { Spacer };
