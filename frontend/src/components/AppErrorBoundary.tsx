import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Sentry } from '../lib/sentry'
import { reportClientError } from '../lib/telemetry'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ hasError: true })
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack
      }
    })
    void reportClientError(error, { componentStack: errorInfo.componentStack })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="container py-5">
          <div className="hero-panel p-5 text-center">
            <p className="eyebrow text-uppercase mb-2">Unexpected issue</p>
            <h1 className="h3 mb-3">PlayWise hit a client-side error.</h1>
            <p className="text-secondary-emphasis mb-0">
              The issue was reported automatically. Refresh the page to try again.
            </p>
          </div>
        </section>
      )
    }

    return this.props.children
  }
}
