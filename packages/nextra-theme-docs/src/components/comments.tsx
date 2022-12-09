import React from "react";
import type { Repo } from "@giscus/react";
import Giscus from "@giscus/react";
import { useTheme } from "next-themes";

const Comments = () => {
    const { theme, systemTheme } = useTheme();

    return (
        <div className="mt-16">
            <Giscus
                id="giscus-comments"
                repo={process.env.NEXT_PUBLIC_COMMENTS_REPO as Repo}
                repoId={process.env.NEXT_PUBLIC_COMMENTS_REPO_ID ?? ""}
                category="Docs"
                categoryId={process.env.NEXT_PUBLIC_COMMENTS_CATEGORY_ID ?? ""}
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
