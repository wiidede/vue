/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
	// 使用： Vue.use(plugin)
	// 本质就是执行插件暴露出来的 install 方法
  Vue.use = function (plugin: Function | Object) {
		// 不会重复注册同一个组件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
			// plugin 是对象 直接看 install 方法
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
			// plugin 是函数
      plugin.apply(null, args)
    }

		// 将 plugin 放到已经安装的插件数组中
    installedPlugins.push(plugin)
    return this
  }
}
