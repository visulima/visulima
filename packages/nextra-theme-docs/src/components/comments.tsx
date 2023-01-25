import type { Repo } from "@giscus/react";
import Giscus from "@giscus/react";
import { useTheme } from "next-themes";
import type { FC } from "react";

import type { Config } from "../contexts/config";

const Comments: FC<{ config: Config }> = ({ config }) => {
    const { theme, systemTheme } = useTheme();

    if (config.comments === undefined) {
        return null;
    }

    return (
        <div className="mt-16">
            <Giscus
                id="giscus-comments"
                repo={config.comments.repository as Repo}
                repoId={config.comments.repositoryId}
                category="Docs"
                categoryId={config.comments.categoryId}
                mapping="title"
                strict="1"
                reactionsEnabled="1"
                emitMetadata="0"
                inputPosition="top"
                // eslint-disable-next-line unicorn/no-negated-condition
                theme={theme !== "system" ? theme : systemTheme}
                lang="en"
                loading="lazy"
            />
        </div>
    );
};

export default Comments;
