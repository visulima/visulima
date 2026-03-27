import { useContext } from "react";

import type { Props } from "../components/StderrContext.js";
import StderrContext from "../components/StderrContext.js";

/**
 * A React hook that returns the stderr stream.
 */
const useStderr = (): Props => useContext(StderrContext);

export default useStderr;
