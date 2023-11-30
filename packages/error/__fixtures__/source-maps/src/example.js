import React, {PropTypes, PureComponent} from 'react'

export default class SomeComponent extends PureComponent{
  static propTypes = {
    className: PropTypes.string
  }

  constructor(props) {
    super(props)

    this.state = {count: 0}
  }

  handleClick = () => {
    this.setState(prevState => ({count: prevState.count + 1}))
  }

  render() {
    return (
      <button
        className={this.props.className}
        onClick={this.handleClick}>
        Clicked {this.state.count} times
      </button>
    )
  }
}
