import type { Context } from "react";
import { createContext } from "react";

import type { CursorPosition } from "../ink/log-update";

export type Props = {
    /**
     * Set the cursor position relative to the Ink output.
     *
     * Pass `undefined` to hide the cursor.
     */
    readonly setCursorPosition: (position: CursorPosition | undefined) => void;
};

const CursorContext: Context<Props> = createContext<Props>({
    setCursorPosition() {},
});

CursorContext.displayName = "InternalCursorContext";

export default CursorContext;
