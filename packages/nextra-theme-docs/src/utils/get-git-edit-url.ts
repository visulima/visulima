import gitUrlParse from "git-url-parse";

import { useConfig } from "../contexts";

const getGitEditUrl = (filePath?: string): string => {
    const config = useConfig();
    const repo = gitUrlParse(config.docsRepositoryBase as string);

    return `${repo.href}/${filePath}`;
};

export default getGitEditUrl;
