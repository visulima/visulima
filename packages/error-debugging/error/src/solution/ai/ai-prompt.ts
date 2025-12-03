import type { SolutionFinderFile } from "../types";

const aiPrompt = ({
    applicationType,
    error,
    file,
}: {
    applicationType: string | undefined;
    error: Error;
    file: SolutionFinderFile;
}): string => `You are a very skilled ${file.language} programmer.

${applicationType ? `You are working on a ${applicationType} application.` : ""}

Use the following context to find a possible fix for the exception message at the end. Limit your answer to 4 or 5 sentences. Also include a few links to documentation that might help.

Use this format in your answer, make sure links are json:

FIX
insert the possible fix here
ENDFIX
LINKS
{"title": "Title link 1", "url": "URL link 1"}
{"title": "Title link 2", "url": "URL link 2"}
ENDLINKS
---

Here comes the context and the exception message:

Line: ${file.line}

File:
${file.file}

Snippet including line numbers:
${file.snippet}

Exception class:
${error.name}

Exception message:
${error.message}`;

export default aiPrompt;
