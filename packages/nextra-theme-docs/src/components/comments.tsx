import type { Repo } from "@giscus/react";
import Giscus from "@giscus/react";
import { useTheme } from "next-themes";
import type { FC } from "react";

import type { Config } from "../contexts/config";

const Comments: FC<{ config: Config }> = ({ config }) => {
    const { systemTheme, theme } = useTheme();

    if (config.comments === undefined) {
        return null;
    }

    return (
        <div className="mt-16">
            <Giscus
                category="Docs"
                categoryId={config.comments.categoryId}
                emitMetadata="0"
                id="giscus-comments"
                inputPosition="top"
                lang="en"
                loading="lazy"
                mapping="title"
                reactionsEnabled="1"
                repo={config.comments.repository as Repo}
                repoId={config.comments.repositoryId}
                strict="1"
                // eslint-disable-next-line unicorn/no-negated-condition
                theme={theme !== "system" ? theme : systemTheme}
            />
        </div>
    );
};

export default Comments;
