/* eslint-disable */
'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
module.exports = function generateError () {
  var prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'Meh'
  var message = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Some error'
  return new Error(prefix + ': ' + message)
}
//# sourceMappingURL=invalid.js.map
