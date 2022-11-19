import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import React, { ReactElement } from "react";

import { useConfig } from "../contexts";
import { getGitIssueUrl, renderComponent } from "../utils";
import Anchor from "./anchor";

const NotFoundPage = (): ReactElement | null => {
    const config = useConfig();
    const mounted = useMounted();
    const { asPath } = useRouter();
    const { content, labels } = config.notFound;
    if (!content) {
        return null;
    }

    return (
        <p className="text-center">
            <Anchor
                href={getGitIssueUrl({
                    repository: config.docsRepositoryBase,
                    title: `Found broken \`${mounted ? asPath : ""}\` link. Please fix!`,
                    labels,
                })}
                newWindow
                className="text-primary-500 underline decoration-from-font [text-underline-position:under]"
            >
                {renderComponent(content)}
            </Anchor>
        </p>
    );
};

export default NotFoundPage;
