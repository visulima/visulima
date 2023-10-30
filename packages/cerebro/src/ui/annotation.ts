import { stdout } from "supports-hyperlinks";

const annotation = (text: string, annotation: string): void => {
    if (stdout) {
        // \u001b]8;;https://google.com\u0007sometext\u001b]8;;\u0007
        // eslint-disable-next-line no-console
        console.log(`\u001B]1337;AddAnnotation=${text.length}|${annotation}\u0007${text}`);
    } else {
        // eslint-disable-next-line no-console
        console.log(text);
    }
};

export default annotation;
