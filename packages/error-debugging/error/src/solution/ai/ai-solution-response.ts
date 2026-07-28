const escapeHtml = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");

const isSafeUrl = (url: string): boolean => {
    try {
        const { protocol } = new URL(url);

        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
};

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

    return text.slice(adjustedStartPosition, endPosition).trim();
};

const aiSolutionResponse = (rawText: string): string => {
    const description = between("FIX", "ENDFIX", rawText);

    if (!description) {
        return [
            "No solution found.",
            // eslint-disable-next-line no-secrets/no-secrets
            `Provide this response to the Maintainer of <a href="https://github.com/visulima/visulima/issues/new?assignees=&labels=s%3A+pending+triage%2Cc%3A+bug&projects=&template=bug_report.yml" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline inline-flex items-center text-sm">@visulima/error</a>.`,
            `"${escapeHtml(rawText)}"`,
        ].join("</br></br>");
    }

    const linksRaw = between("LINKS", "ENDLINKS", rawText);
    const links = linksRaw
        ? linksRaw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((link) => {
                try {
                    const parsed = JSON.parse(link) as { title?: unknown; url?: unknown };

                    if (typeof parsed.url === "string" && typeof parsed.title === "string" && isSafeUrl(parsed.url)) {
                        return { title: parsed.title, url: parsed.url };
                    }

                    return undefined;
                } catch {
                    return undefined;
                }
            })
            .filter((link): link is { title: string; url: string } => link !== undefined)
        : [];

    const linksSection
        = links.length > 0
            ? `\n\n## Links\n\n${links
                .map((link) => `- <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a>`)
                .join("\n")}`
            : "";

    return `${escapeHtml(description).replaceAll(/&quot;(.*?)&quot;(?:\s|\.)/g, "<code>$1</code> ")}${linksSection}

--------------------
This solution was generated with the <a href="https://sdk.vercel.ai/" target="_blank" rel="noopener noreferrer">AI SDK</a> and may not be 100% accurate.`;
};

export default aiSolutionResponse;
