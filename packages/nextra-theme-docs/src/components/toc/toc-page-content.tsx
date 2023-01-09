import type { Heading } from "nextra";
import type { FC, Ref } from "react";

import { useActiveAnchor } from "../../contexts";
import Toc from "./toc";

const TocPageContent: FC<TOCProperties> = ({ headings, wrapperRef }) => {
    const activeAnchor = useActiveAnchor();

    return (
        <div ref={wrapperRef} className="py-8 text-sm [hyphens:auto]">
            <Toc headings={headings} activeAnchor={activeAnchor} isPage prefix="content" />
        </div>
    );
};

export type TOCProperties = {
    headings: Heading[];
    wrapperRef: Ref<HTMLDivElement>;
};

export default TocPageContent;
