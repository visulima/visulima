const between = (start: string, end: string, text: string): string => {
    const startPosition = text.indexOf(start);

    if (startPosition === -1) {
        return "";
    }

    const adjustedStartPosition = startPosition + start.length;
    const endPosition = text.indexOf(end, adjustedStartPosition);

    if (endPosition === -1) {
        return "";
    }

    return text.substring(adjustedStartPosition, endPosition).trim();
};

const aiSolutionResponse = (rawText: string): string => {
    const description = between("FIX", "ENDFIX", rawText);

    if (!description) {
        return [
            "No solution found.",
            "Provide this response to the Maintainer of <a href=\"https://github.com/visulima/visulima/issues/new?assignees=&labels=s%3A+pending+triage%2Cc%3A+bug&projects=&template=bug_report.yml\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-blue-500 hover:underline inline-flex items-center text-sm\">@visulima/flame</a>.",
            `"${rawText}"`,
        ].join("</br></br>");
    }

    const links = between("LINKS", "ENDLINKS", rawText)
        .split("\n")
        .map((link) => JSON.parse(link));

    return `${description.replaceAll(/\"([^\"]*)\"(\s|\.)/g, "<code>$1</code> ")}

## Links

${links.map((link) => `- <a href=\"${link.url}\" target=\"_blank\" rel=\"noopener noreferrer\">${link.title}</a>`).join("\n")}

--------------------
This solution was generated with the <a href=\"https://sdk.vercel.ai/\" target=\"_blank\" rel=\"noopener noreferrer\">AI SDK</a> and may not be 100% accurate.`;
};

export default aiSolutionResponse;
