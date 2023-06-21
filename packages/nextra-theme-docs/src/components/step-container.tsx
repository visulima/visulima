import cn from "clsx";
import type { FC, PropsWithChildren } from "react";

const StepContainer: FC<PropsWithChildren<{ noTitle?: boolean }>> = ({ children, noTitle }) => <div className={cn("not-prose steps-container", {
    "no-title": noTitle,
})}>{children}</div>;

export default StepContainer;
