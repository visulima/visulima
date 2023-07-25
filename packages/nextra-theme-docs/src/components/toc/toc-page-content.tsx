import type { Heading } from "nextra";
import type { FC, Ref } from "react";

import { useActiveAnchor } from "../../contexts";
import Toc from "./toc";

const TocPageContent: FC<TOCProperties> = ({ headings, wrapperRef }) => {
    const activeAnchor = useActiveAnchor();

    return (
        <div className="py-8 text-sm [hyphens:auto]" ref={wrapperRef}>
            <Toc activeAnchor={activeAnchor} headings={headings} isPage prefix="content" />
        </div>
    );
};

export interface TOCProperties {
    headings: Heading[];
    wrapperRef: Ref<HTMLDivElement>;
}

export default TocPageContent;
