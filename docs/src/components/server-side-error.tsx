import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import type { ReactElement } from "react";
import React from "react";

import { useConfig } from "../contexts";
import { getGitIssueUrl, renderComponent } from "../utils";
import Anchor from "./anchor";

const ServerSideErrorPage = (): ReactElement | null => {
    const config = useConfig();
    const mounted = useMounted();
    const { asPath } = useRouter();
    const { content, labels } = config.serverSideError;
    if (!content) {
        return null;
    }

    return (
        <p className="text-center">
            <Anchor
                href={getGitIssueUrl({
                    repository: config.docsRepositoryBase,
                    title: `Got server-side error in \`${mounted ? asPath : ""}\` url. Please fix!`,
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

export default ServerSideErrorPage;
