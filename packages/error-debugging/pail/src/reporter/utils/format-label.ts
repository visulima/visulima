import colorize from "@visulima/colorize";

import type { PrettyStyleOptions } from "../pretty/abstract-pretty-reporter";

// `colorize` default export exposes named ANSI helpers as properties; the rule's check is a false positive here
// eslint-disable-next-line import/no-named-as-default-member
const { bold, underline } = colorize;

const formatLabel = (label: string, styles: PrettyStyleOptions): string => {
    let formattedLabel = styles.uppercase.label ? label.toUpperCase() : label;

    formattedLabel = styles.underline.label ? underline(formattedLabel) : formattedLabel;

    if (styles.bold.label) {
        formattedLabel = bold(formattedLabel);
    }

    return formattedLabel;
};

export default formatLabel;
