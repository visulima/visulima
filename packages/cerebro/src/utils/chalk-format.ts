import chalkTemplate from "chalk-template";

const chalkFormat = (str?: string): string => {
    if (str) {
        return chalkTemplate(Object.assign([], { raw: [str.replace(/`/g, "\\`")] }));
    }

    return "";
}

export default chalkFormat;
