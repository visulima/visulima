import type { FC, PropsWithChildren } from "react";

const StepContainer: FC<PropsWithChildren> = ({ children }) => <div className="steps-container">{children}</div>;

export default StepContainer;
