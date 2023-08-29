import type { FC, SVGAttributes } from "react";

const PlusIcon: FC<SVGAttributes<SVGElement>> = (properties = {}) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...properties}>
        <path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default PlusIcon;
