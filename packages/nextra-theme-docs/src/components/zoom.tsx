import type { FC } from "react";
import type { UncontrolledProps } from "react-medium-image-zoom";
import Zoom from "react-medium-image-zoom";

// eslint-disable-next-line react/jsx-props-no-spreading
const ZoomWrapper: FC<UncontrolledProps> = ({ children = null, ...properties }) => <Zoom {...properties}>{children}</Zoom>;

export default ZoomWrapper;
