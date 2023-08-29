import type { FC, SVGAttributes } from "react";

const ArrowsPointingInIcon: FC<SVGAttributes<SVGElement>> = (properties = {}) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...properties}>
        <path
            d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default ArrowsPointingInIcon;
