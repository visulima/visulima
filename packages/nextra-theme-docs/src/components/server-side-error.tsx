import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import type { ReactElement } from "react";

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
        <div className="mx-auto max-w-screen-xl p-8 lg:px-4 xl:px-6 xl:py-16">
            <div className="text-center">
                <div className="mb-8 inline-flex rounded-full bg-red-100 p-4">
                    <div className="rounded-full bg-red-200 stroke-red-600 p-4">
                        <svg className="h-16 w-16" fill="none" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M6 8H6.01M6 16H6.01M6 12H18C20.2091 12 22 10.2091 22 8C22 5.79086 20.2091 4 18 4H6C3.79086 4 2 5.79086 2 8C2 10.2091 3.79086 12 6 12ZM6 12C3.79086 12 2 13.7909 2 16C2 18.2091 3.79086 20 6 20H14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                            />
                            <path d="M17 16L22 21M22 16L17 21" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                    </div>
                </div>
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white lg:text-4xl">500 - Server error</h1>
                <p className="mb-4 text-lg font-normal text-gray-500 dark:text-gray-400">
                    Oops something went wrong. Try to refresh this page or <br /> feel free to contact us if the problem presists.
                </p>
                <Anchor
                    href={getGitIssueUrl({
                        labels,
                        repository: config.docsRepositoryBase,
                        title: `Got server-side error in \`${mounted ? asPath : ""}\` url. Please fix!`,
                    })}
                    className="mt-10 block text-primary-600 underline decoration-from-font [text-underline-position:from-font]"
                    newWindow
                >
                    {renderComponent(content)}
                </Anchor>
            </div>
        </div>
    );
};

export default ServerSideErrorPage;
