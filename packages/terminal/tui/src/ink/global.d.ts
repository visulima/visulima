/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Key, ReactNode } from "react";

import type { DOMElement } from "./dom";
import type { OutputTransformer } from "./render-node-to-output";

declare global {
    namespace Ink {
        type Box = {
            children?: ReactNode;
            internal_accessibility?: DOMElement["internal_accessibility"];
            internal_static?: boolean;
            internal_transform?: OutputTransformer;
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
            "ink-text": Ink.Text;
        }
    }
}
