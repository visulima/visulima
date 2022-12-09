import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import type { ReactElement } from "react";
import React from "react";

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
        <div className="py-8 px-8 md:px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
            <div className="mx-auto max-w-screen-sm">
                <div className="text-center">
                    <h1 className="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-primary-600 dark:text-primary-500">404</h1>
                    <p className="mb-4 text-3xl tracking-tight font-bold text-gray-900 md:text-4xl dark:text-white">This page does not exist.</p>
                    <p className="mb-4 text-lg font-normal text-gray-500 dark:text-gray-400">The page you are looking for could not be found.</p>
                </div>

                {list.length > 0 && (
                    <div className="flex flex-col mt-16">
                        <div className="text-gray-600 dark:text-gray-200 font-medium">Popular pages</div>

                        <div className="flex flex-col items-stretch mt-4">
                            {list.map((page) => (
                                <div
                                    key={page.title + (page.subtitle || "")}
                                    className="flex flex-row px-4 py-8 border-t hover:cursor-pointer transition-all duration-200 delay-100"
                                >
                                    {/* eslint-disable-next-line max-len */}
                                    {page.icon && (
                                        <div className="rounded-md bg-primary-100 px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4 md:py-4">
                                            {page.icon as JSX.Element}
                                        </div>
                                    )}
                                    <a href={page.url} title={page.title} className="grow flex flex-col pl-5 hover:no-underline! group">
                                        <div className="font-bold lg:font-semibold text-sm md:text-lg lg:text-xl">{page.title}</div>
                                        {page.subtitle && (
                                            <div className="font-semibold lg:font-medium text-sm md:text-md lg:text-lg text-gray-400 group-hover:text-gray-500">
                                                {page.subtitle}
                                            </div>
                                        )}
                                    </a>
                                    {/* eslint-disable-next-line max-len */}
                                    <ChevronRightIcon className="h-8 w-8 text-gray-400 my-auto pr-2 group-hover:text-gray-700 transition-all duration-200 delay-100" />
                                </div>
                            ))}
                            <hr />
                        </div>
                    </div>
                )}
                <div className="flex flex-row mt-8">
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
