import { Heading } from "nextra";

function getHeadingText(heading: Heading) {
    return heading.value || "";
}

export default getHeadingText;
