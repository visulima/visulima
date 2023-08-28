import cn from "clsx";
import { ArrowRightIcon } from "nextra/icons";
import type { Item } from "nextra/normalize-pages";
import type { ReactElement } from "react";
import { Fragment } from "react";

import Anchor from "./anchor";

const Breadcrumb = ({ activePath }: { activePath: Item[] }): ReactElement => (
    <div className="nextra-breadcrumb mt-1.5 flex items-center gap-1 overflow-hidden text-sm text-gray-500 contrast-more:text-current">
        {activePath.map((item, index) => {
            const isLink = !item.children || item.withIndexPage;
            const isActive = index === activePath.length - 1;

            return (
                <Fragment key={item.route + item.name}>
                    {index > 0 && <ArrowRightIcon className="w-3.5 shrink-0" />}
                    <div
                        className={cn(
                            "whitespace-nowrap transition-colors",
                            isActive
                                ? "font-medium text-gray-700 contrast-more:font-bold contrast-more:text-current dark:text-gray-400 contrast-more:dark:text-current"
                                : ["min-w-[24px] overflow-hidden text-ellipsis px-1 -mx-1", isLink && "hover:text-gray-900 dark:hover:text-gray-200"],
                        )}
                        title={item.title}
                    >
                        {isLink && !isActive ? <Anchor href={item.route}>{item.title}</Anchor> : item.title}
                    </div>
                </Fragment>
            );
        })}
    </div>
);

export default Breadcrumb;
