import type { ColorizeType } from "@visulima/colorize";
import colorize from "@visulima/colorize";
import type { Options } from "@visulima/inspector";

// `colorize` default export exposes named ANSI helpers as properties; the rule's check is a false positive here
// eslint-disable-next-line import/no-named-as-default-member
const { bold, cyan, green, grey, magenta, red, yellow } = colorize;

const defaultInspectorConfig: Partial<Options> = {
    indent: 2,
    quoteStyle: "single",
    stylize: (string_: string, style: string): string => {
        const styles: Record<string, ColorizeType> = {
            bigint: yellow,
            boolean: yellow,
            date: magenta,
            null: bold,
            number: yellow,
            regexp: red,
            special: cyan,
            string: green,
            symbol: green,
            undefined: grey,
        };

        if (!Object.hasOwn(styles, style)) {
            return string_;
        }

        return styles[style](string_);
    },
};

export default defaultInspectorConfig;
