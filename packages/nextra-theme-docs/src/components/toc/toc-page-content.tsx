import type { Heading } from "nextra";
import type { FC, Ref } from "react";

import { useActiveAnchor } from "../../contexts";
import Toc from "./toc";
import cn from "clsx";

const TocPageContent: FC<TOCProperties> = ({ headings, wrapperRef }) => {
    const activeAnchor = useActiveAnchor();

    return (
        <div ref={wrapperRef} className={cn("pt-8 text-sm [hyphens:auto]", {
            "hidden": headings.length === 0,
        })}>
            <Toc headings={headings} activeAnchor={activeAnchor} isPage prefix="content" />
        </div>
    );
};

export type TOCProperties = {
    headings: Heading[];
    wrapperRef: Ref<HTMLDivElement>;
};

export default TocPageContent;
