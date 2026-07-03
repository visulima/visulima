/* eslint-disable react/destructuring-assignment, sonarjs/function-return-type, sonarjs/public-static-readonly */
import type { ReactNode } from "react";
import { PureComponent } from "react";

import ErrorOverview from "./error-overview";

type Props = {
    readonly children: ReactNode;
    readonly onError: (error: Error) => void;
};

type State = {
    readonly error?: Error;
};

// Error boundary must be a class component since getDerivedStateFromError
// and componentDidCatch are not available as hooks
export default class ErrorBoundary extends PureComponent<Props, State> {
    // fallow-ignore-next-line unused-class-member -- consumed by React DevTools / the runtime, not called in-repo.
    static displayName = "InternalErrorBoundary";

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override state: State = {
        error: undefined,
    };

    override componentDidCatch(error: Error): void {
        this.props.onError(error);
    }

    override render(): ReactNode {
        if (this.state.error) {
            return <ErrorOverview error={this.state.error} />;
        }

        return this.props.children;
    }
}
