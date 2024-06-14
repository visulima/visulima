import type { ColorizeType } from "@visulima/colorize";
import { bold, cyan, green, grey, magenta, red, yellow } from "@visulima/colorize";
import type { Options } from "@visulima/inspector";

const defaultInspectorConfig: Partial<Options> = {
    indent: 2,
    quoteStyle: "single",
    stylize: (string_: string, style): string => {
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

        // eslint-disable-next-line security/detect-object-injection
        if (styles[style] === undefined) {
            return string_;
        }

        // eslint-disable-next-line security/detect-object-injection
        return (styles[style] as ColorizeType)(string_);
    },
};

export default defaultInspectorConfig;
