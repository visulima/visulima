import React, { FC, PropsWithChildren } from "react";

const StepContainer: FC<PropsWithChildren> = ({ children }) => {
    return <div className="steps-container">{children}</div>;
};

export default StepContainer;
