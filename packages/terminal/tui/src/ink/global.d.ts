import type { Key, ReactNode, Ref } from "react";
import type { Except } from "type-fest";

import type { DOMElement } from "./dom.js";
import type { Styles } from "./styles.js";

declare module "react" {
    namespace JSX {

        interface IntrinsicElements {
            "ink-box": Ink.Box;
            "ink-text": Ink.Text;
        }
    }
}

declare namespace Ink {
    type Box = {
        children?: ReactNode;
        internal_accessibility?: DOMElement["internal_accessibility"];
        internal_static?: boolean;
        key?: Key;
        ref?: Ref<DOMElement>;
        style?: Except<Styles, "textWrap">;
    };

    type Text = {
        children?: ReactNode;
        internal_accessibility?: DOMElement["internal_accessibility"];

        internal_transform?: (children: string, index: number) => string;

        key?: Key;
        style?: Styles;
    };
}
