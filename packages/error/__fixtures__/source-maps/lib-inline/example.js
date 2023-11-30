'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SomeComponent = function (_PureComponent) {
  _inherits(SomeComponent, _PureComponent);

  function SomeComponent(props) {
    _classCallCheck(this, SomeComponent);

    var _this = _possibleConstructorReturn(this, (SomeComponent.__proto__ || Object.getPrototypeOf(SomeComponent)).call(this, props));

    _this.handleClick = function () {
      _this.setState(function (prevState) {
        return { count: prevState.count + 1 };
      });
    };

    _this.state = { count: 0 };
    return _this;
  }

  _createClass(SomeComponent, [{
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        'button',
        {
          className: this.props.className,
          onClick: this.handleClick },
        'Clicked ',
        this.state.count,
        ' times'
      );
    }
  }]);

  return SomeComponent;
}(_react.PureComponent);

SomeComponent.propTypes = {
  className: _react.PropTypes.string
};
exports.default = SomeComponent;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9leGFtcGxlLmpzIl0sIm5hbWVzIjpbIlNvbWVDb21wb25lbnQiLCJwcm9wcyIsImhhbmRsZUNsaWNrIiwic2V0U3RhdGUiLCJjb3VudCIsInByZXZTdGF0ZSIsInN0YXRlIiwiY2xhc3NOYW1lIiwicHJvcFR5cGVzIiwic3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7SUFFcUJBLGE7OztBQUtuQix5QkFBWUMsS0FBWixFQUFtQjtBQUFBOztBQUFBLDhIQUNYQSxLQURXOztBQUFBLFVBTW5CQyxXQU5tQixHQU1MLFlBQU07QUFDbEIsWUFBS0MsUUFBTCxDQUFjO0FBQUEsZUFBYyxFQUFDQyxPQUFPQyxVQUFVRCxLQUFWLEdBQWtCLENBQTFCLEVBQWQ7QUFBQSxPQUFkO0FBQ0QsS0FSa0I7O0FBR2pCLFVBQUtFLEtBQUwsR0FBYSxFQUFDRixPQUFPLENBQVIsRUFBYjtBQUhpQjtBQUlsQjs7Ozs2QkFNUTtBQUNQLGFBQ0U7QUFBQTtBQUFBO0FBQ0UscUJBQVcsS0FBS0gsS0FBTCxDQUFXTSxTQUR4QjtBQUVFLG1CQUFTLEtBQUtMLFdBRmhCO0FBQUE7QUFHVyxhQUFLSSxLQUFMLENBQVdGLEtBSHRCO0FBQUE7QUFBQSxPQURGO0FBT0Q7Ozs7OztBQXZCa0JKLGEsQ0FDWlEsUyxHQUFZO0FBQ2pCRCxhQUFXLGlCQUFVRTtBQURKLEM7a0JBREFULGEiLCJmaWxlIjoiZXhhbXBsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwge1Byb3BUeXBlcywgUHVyZUNvbXBvbmVudH0gZnJvbSAncmVhY3QnXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNvbWVDb21wb25lbnQgZXh0ZW5kcyBQdXJlQ29tcG9uZW50e1xuICBzdGF0aWMgcHJvcFR5cGVzID0ge1xuICAgIGNsYXNzTmFtZTogUHJvcFR5cGVzLnN0cmluZ1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcylcblxuICAgIHRoaXMuc3RhdGUgPSB7Y291bnQ6IDB9XG4gIH1cblxuICBoYW5kbGVDbGljayA9ICgpID0+IHtcbiAgICB0aGlzLnNldFN0YXRlKHByZXZTdGF0ZSA9PiAoe2NvdW50OiBwcmV2U3RhdGUuY291bnQgKyAxfSkpXG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxidXR0b25cbiAgICAgICAgY2xhc3NOYW1lPXt0aGlzLnByb3BzLmNsYXNzTmFtZX1cbiAgICAgICAgb25DbGljaz17dGhpcy5oYW5kbGVDbGlja30+XG4gICAgICAgIENsaWNrZWQge3RoaXMuc3RhdGUuY291bnR9IHRpbWVzXG4gICAgICA8L2J1dHRvbj5cbiAgICApXG4gIH1cbn1cbiJdfQ==