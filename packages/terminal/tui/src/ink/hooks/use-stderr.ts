import { useContext } from "react";

import type { Props } from "../../components/stderr-context";
import StderrContext from "../../components/stderr-context";

/**
 * A React hook that returns the stderr stream.
 */
const useStderr = (): Props => useContext(StderrContext);

export default useStderr;

export { useStderr };
