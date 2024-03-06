// eslint-disable-next-line import/no-named-as-default
import template from "@visulima/colorize/template";

const templateFormat = (string_?: string): string => {
    if (string_) {
        return template(Object.assign([], { raw: [string_.replaceAll("`", "\\`")] }));
    }

    return "";
};

export default templateFormat;
