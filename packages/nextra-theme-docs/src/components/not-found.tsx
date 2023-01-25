import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import type { ReactElement } from "react";

import { useConfig } from "../contexts";
import { getGitIssueUrl, renderComponent } from "../utils";
import Anchor from "./anchor";

const NotFoundPage = (): ReactElement | null => {
    const config = useConfig();
    const mounted = useMounted();
    const { asPath, locale } = useRouter();
    const { content, labels, pages = () => [] } = config.notFound;

    if (!content) {
        return null;
    }

    const list = pages({ local: locale as string });

    return (
        <div className="mx-auto max-w-screen-xl p-8 md:px-4 lg:py-16 lg:px-6">
            <div className="mx-auto max-w-screen-sm">
                <div className="text-center">
                    <h1 className="mb-4 text-7xl font-extrabold tracking-tight text-primary-600 dark:text-primary-500 lg:text-9xl">404</h1>
                    <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">This page does not exist.</p>
                    <p className="mb-4 text-lg font-normal text-gray-500 dark:text-gray-400">The page you are looking for could not be found.</p>
                </div>

                {list.length > 0 && (
                    <div className="mt-16 flex flex-col">
                        <div className="font-medium text-gray-600 dark:text-gray-200">Popular pages</div>

                        <div className="mt-4 flex flex-col items-stretch">
                            {list.map((page) => (
                                <div
                                    key={page.title + (page.subtitle || "")}
                                    className="flex flex-row border-t px-4 py-8 transition-all delay-100 duration-200 hover:cursor-pointer"
                                >
                                    {/* eslint-disable-next-line max-len */}
                                    {page.icon && (
                                        <div className="rounded-md bg-primary-100 p-2 md:p-3 md:py-4 lg:p-4">
                                            {page.icon as JSX.Element}
                                        </div>
                                    )}
                                    <a href={page.url} title={page.title} className="hover:no-underline! group flex grow flex-col pl-5">
                                        <div className="text-sm font-bold md:text-lg lg:text-xl lg:font-semibold">{page.title}</div>
                                        {page.subtitle && (
                                            <div className="md:text-md text-sm font-semibold text-gray-400 group-hover:text-gray-500 lg:text-lg lg:font-medium">
                                                {page.subtitle}
                                            </div>
                                        )}
                                    </a>
                                    {/* eslint-disable-next-line max-len */}
                                    <ChevronRightIcon className="my-auto h-8 w-8 pr-2 text-gray-400 transition-all delay-100 duration-200 group-hover:text-gray-700" />
                                </div>
                            ))}
                            <hr />
                        </div>
                    </div>
                )}
                <div className="mt-8 flex flex-row">
                    <Anchor href="/" newWindow className="basis-2/4 text-primary-600 underline decoration-from-font [text-underline-position:under]">
                        Back to Homepage
                    </Anchor>
                    <Anchor
                        href={getGitIssueUrl({
                            repository: config.docsRepositoryBase,
                            title: `Found broken \`${mounted ? asPath : ""}\` link. Please fix!`,
                            labels,
                        })}
                        newWindow
                        className="basis-2/4 text-right text-primary-600 underline decoration-from-font [text-underline-position:under]"
                    >
                        {renderComponent(content)}
                    </Anchor>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
