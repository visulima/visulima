import { bold, underline } from "@visulima/colorize";

import type { PrettyStyleOptions } from "../pretty/abstract-pretty-reporter";

const formatLabel = (label: string, styles: PrettyStyleOptions): string => {
    let formattedLabel = styles.uppercase.label ? label.toUpperCase() : label;

    formattedLabel = styles.underline.label ? underline(formattedLabel) : formattedLabel;

    if (styles.bold.label) {
        formattedLabel = bold(formattedLabel);
    }

    return formattedLabel;
};

export default formatLabel;
