// Stands in for a CommonJS dependency: require() loads the CJS build, a separate module instance.
const { reachGoalUnsafe } = require('@boxlab/yandex-metrica-next')

exports.trackFromCommonJs = function trackFromCommonJs(goal) {
    reachGoalUnsafe(goal)
}
