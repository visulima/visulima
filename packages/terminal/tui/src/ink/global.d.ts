/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Key } from "react";

import type { DOMElement } from "./dom.js";
import type { OutputTransformer } from "./render-node-to-output.js";

declare global {
    namespace Ink {
        type Box = {
            internal_accessibility?: DOMElement["internal_accessibility"];
            internal_static?: boolean;
            internal_transform?: OutputTransformer;
            key?: Key;
            ref?: unknown;
            style?: DOMElement["style"];
        };

        type Text = {
            internal_transform?: (children: string, index: number) => string;
            key?: Key;
            style?: DOMElement["style"];
        };

        type Cursor = {
            internal_cursor?: DOMElement["internal_cursor"];
            key?: Key;
        };
    }

    namespace JSX {
        interface IntrinsicElements {
            "ink-box": Ink.Box;
            "ink-cursor": Ink.Cursor;
            "ink-text": Ink.Text;
        }
    }
}
