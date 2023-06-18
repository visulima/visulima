import type { UncontrolledProps } from "react-medium-image-zoom";
import Zoom from "react-medium-image-zoom";

const ZoomWrapper = ({ children, ...properties }: UncontrolledProps) => <Zoom {...properties}>{children}</Zoom>;

export default ZoomWrapper;
