import { Component } from "react"
import { RouteError } from "../../design-system/patterns/RouteState.jsx"

export class AppErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  reset = () => this.setState({ error: null })
  render() { return this.state.error ? <RouteError reset={this.reset} /> : this.props.children }
}
