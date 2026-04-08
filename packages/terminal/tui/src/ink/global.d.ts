/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Key, ReactNode } from "react";

import type { DOMElement } from "./dom";
import type { OutputTransformer } from "./render-node-to-output";
import type { Region } from "./region";

declare global {
    namespace Ink {
        type Box = {
            children?: ReactNode;
            internal_accessibility?: DOMElement["internal_accessibility"];
            internal_static?: boolean;
            internal_terminalCursorFocus?: boolean;
            internal_terminalCursorPosition?: number;
            internal_transform?: OutputTransformer;
            internalStickyAlternate?: boolean;
            key?: Key;
            opaque?: boolean;
            ref?: unknown;
            scrollbar?: boolean;
            sticky?: boolean | "top" | "bottom";
            style?: DOMElement["style"];
        };

        type StaticRender = {
            cachedRender?: Region;
            children?: ReactNode;
            internal_onRendered?: () => void;
            key?: Key;
            ref?: unknown;
            style?: DOMElement["style"];
        };

        type Text = {
            children?: ReactNode;
            internal_transform?: (children: string, index: number) => string;
            key?: Key;
            style?: DOMElement["style"];
        };

        type Cursor = {
            internal_cursor?: DOMElement["internal_cursor"];
            key?: Key;
        };
    }
}

declare module "react" {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            "ink-box": Ink.Box;
            "ink-cursor": Ink.Cursor;
            "ink-static-render": Ink.StaticRender;
            "ink-text": Ink.Text;
        }
    }
}
