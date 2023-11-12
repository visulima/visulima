import { parseStacktrace } from "@visulima/error";

import titleBar from "./components/title-bar";
import inlineCss from "./index.css";
import layout from "./layout";

const index = (error: Error) => {
    const { message, name } = error;
    const traces = parseStacktrace(error);
console.log(traces)
    const html = titleBar(name, message, "");

    return layout("Error", "Error", inlineCss, html);
};

export default index;
