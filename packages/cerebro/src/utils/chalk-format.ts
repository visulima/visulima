import chalkTemplate from "chalk-template";

const chalkFormat = (string_?: string): string => {
    if (string_) {
        return chalkTemplate(Object.assign([], { raw: [string_.replaceAll("`", "\\`")] }));
    }

    return "";
};

export default chalkFormat;
