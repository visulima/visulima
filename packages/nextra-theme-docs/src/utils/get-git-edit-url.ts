import gitUrlParse from "git-url-parse";

import { useConfig } from "../contexts";

const getGitEditUrl = (filePath?: string): string => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const config = useConfig();
    const repo = gitUrlParse(config.docsRepositoryBase || "");

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!repo) {
        throw new Error("Invalid `docsRepositoryBase` URL!");
    }

    return `${repo.href}/${filePath}`;
};

export default getGitEditUrl;
