import cn from "clsx";
import type { FC } from "react";

import type { Config } from "../contexts/config";
import getGitIssueUrl from "../utils/get-git-issue-url";
import { renderComponent } from "../utils/render";
import Anchor from "./anchor";

const linkClassName = cn(
    "text-sm lg:text-xs py-2 lg:py-0 font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 text-right ",
    "contrast-more:text-gray-800 contrast-more:dark:text-gray-50",
);

const MetaInfo: FC<{ config: Config; filePath: string; locale: string; route: string }> = ({ config, filePath, locale, route }) => (
    <>
        {config.feedback.content ? (
            <Anchor
                href={
                    config.feedback.link
                        ? config.feedback.link({
                              docsRepositoryBase: config.docsRepositoryBase,
                              labels: config.feedback.labels,
                              route,
                              title: config.title,
                          })
                        : getGitIssueUrl({
                              labels: config.feedback.labels,
                              repository: config.docsRepositoryBase,
                              title: `Feedback for “${config.title}”`,
                          })
                }
                className={linkClassName}
                newWindow
            >
                {renderComponent(config.feedback.content, { locale })}
            </Anchor>
        ) : null}

        {renderComponent(config.editLink.component, {
            children: renderComponent(config.editLink.content, { locale }),
            className: linkClassName,
            filePath,
        })}

        {config.backToTop.active && (
            <button
                onClick={() => {
                    window.scrollTo({ behavior: "smooth", left: 0, top: 0 });
                }}
                className={linkClassName}
                type="button"
            >
                {renderComponent(config.backToTop.content, { locale })}
            </button>
        )}
    </>
);

export default MetaInfo;
