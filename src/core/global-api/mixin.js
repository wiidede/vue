/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
		// 利用 mergeOptions 合并两个选项
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
