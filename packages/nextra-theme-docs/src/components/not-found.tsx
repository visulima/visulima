import { useRouter } from "next/router";
import { useMounted } from "nextra/hooks";
import { ArrowRightIcon } from "nextra/icons";
import type { JSX, ReactElement } from "react";

import { useConfig } from "../contexts";
import getGitIssueUrl from "../utils/get-git-issue-url";
import { renderComponent } from "../utils/render";
import Anchor from "./anchor";

const NotFoundPage = (): ReactElement | null => {
    const config = useConfig();
    const mounted = useMounted();
    const { asPath, locale } = useRouter();
    // eslint-disable-next-line no-empty-pattern
    const { content, labels, pages = ({}: { locale: string }) => [] } = config.notFound;

    if (!content) {
        return null;
    }

    const list = pages({ locale: locale as string });

    return (
        <div className="mx-auto max-w-screen-xl p-8 lg:px-4 xl:px-6 xl:py-16">
            <div className="mx-auto max-w-screen-sm">
                <div className="text-center">
                    <h1 className="mb-4 text-7xl font-extrabold tracking-tight text-primary-600 dark:text-primary-500 xl:text-9xl">404</h1>
                    <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white lg:text-4xl">This page does not exist.</p>
                    <p className="mb-4 text-lg font-normal text-gray-500 dark:text-gray-400">The page you are looking for could not be found.</p>
                </div>

                {list.length > 0 && (
                    <div className="mt-16 flex flex-col">
                        <div className="font-medium text-gray-600 dark:text-gray-200">Popular pages</div>

                        <div className="mt-4 flex flex-col items-stretch">
                            {list.map((page) => (
                                <div
                                    className="flex flex-row border-t px-4 py-8 transition-all delay-100 duration-200 hover:cursor-pointer"
                                    key={page.title + (page.subtitle ?? "")}
                                >
                                    {page.icon && <div className="rounded-lg bg-primary-100 p-2 lg:p-3 lg:py-4 xl:p-4">{page.icon as JSX.Element}</div>}
                                    {/* eslint-disable-next-line tailwindcss/no-custom-classname */}
                                    <a className="hover:no-underline! group flex grow flex-col pl-5" href={page.url} title={page.title}>
                                        <div className="text-sm font-bold lg:text-lg xl:text-xl xl:font-semibold">{page.title}</div>
                                        {page.subtitle && (
                                            <div className="text-sm font-semibold text-gray-400 group-hover:text-gray-500 lg:text-base xl:text-lg xl:font-medium">
                                                {page.subtitle}
                                            </div>
                                        )}
                                    </a>
                                    <ArrowRightIcon className="my-auto size-8 pr-2 text-gray-400 transition-all delay-100 duration-200 group-hover:text-gray-700" />
                                </div>
                            ))}
                            <hr />
                        </div>
                    </div>
                )}
                <div className="mt-8 flex flex-row">
                    <Anchor className="basis-2/4 text-primary-600 underline decoration-from-font [text-underline-position:under]" href="/">
                        Back to Homepage
                    </Anchor>
                    <Anchor
                        className="basis-2/4 text-right text-primary-600 underline decoration-from-font [text-underline-position:from-font]"
                        href={getGitIssueUrl({
                            labels,
                            repository: config.docsRepositoryBase,
                            title: `Found broken \`${mounted ? asPath : ""}\` link. Please fix!`,
                        })}
                        newWindow
                    >
                        {renderComponent(content)}
                    </Anchor>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
