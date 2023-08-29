import cn from "clsx";
import type { Heading } from "nextra";
import type { FC, Ref } from "react";

import Toc from "./toc";

const TocPageContent: FC<TOCProperties> = ({ headings, wrapperRef }) => {
    return (
        <div
            className={cn("pt-8 text-sm [hyphens:auto] mb-8 print:hidden", {
                hidden: headings.length === 0,
            })}
            ref={wrapperRef}
        >
            <Toc headings={headings} isPage prefix="content" />
        </div>
    );
};

export interface TOCProperties {
    headings: Heading[];
    wrapperRef: Ref<HTMLDivElement>;
}

export default TocPageContent;
