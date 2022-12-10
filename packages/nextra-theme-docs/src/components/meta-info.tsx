import cn from "clsx";
import { FC } from "react";

import { Config } from "../contexts/config";
import { getGitIssueUrl, renderComponent, renderString } from "../utils";
import Anchor from "./anchor";

const linkClassName = cn(
    "text-sm md:text-xs py-2 md:py-0 font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
    "contrast-more:text-gray-800 contrast-more:dark:text-gray-50",
);

const MetaInfo: FC<{ config: Config; filePath: string; locale: string; route: string }> = ({
    config, filePath, locale, route,
}) => (
        <>
            {config.feedback.content ? (
                <Anchor
                    className={linkClassName}
                    href={
                        config.feedback?.link
                            ? config.feedback.link(config.title, route)
                            : getGitIssueUrl({
                                repository: config.docsRepositoryBase,
                                title: `Feedback for “${config.title}”`,
                                labels: config.feedback.labels,
                            })
                    }
                    newWindow
                >
                    {renderComponent(config.feedback.content, { locale })}
                </Anchor>
            ) : null}

            {renderComponent(config.editLink.component, {
                filePath,
                className: linkClassName,
                children: renderString(config.editLink.text, { locale }),
            })}
        </>
);

export default MetaInfo;
