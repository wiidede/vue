/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
// import { ASSET_TYPES } from 'shared/constants'
import { ASSET_TYPES } from '../../shared/constants'
import builtInComponents from '../components/index'
// import { observe } from 'core/observer/index'
import { observe } from '../../core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 初始化全局 API 的入口
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
	// Vue 全局默认配置
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
	// 将配置代理到 Vue.config
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
		// 日志
    warn,
	  // 将 A 对象上的属性复制到 B 对象上
    extend,
	  // 合并选项
    mergeOptions,
	  // 给对象设置 getter setter 依赖收集 依赖通知
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }

	/**
	 * 相当于 Vue.options = { components: {}, directives: {}, filters: {}}
	 */
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
	// 将 Vue 构造函数 暴露到 Vue.options 上
  Vue.options._base = Vue

	// 将内置组件放到 Vue.options.components 中。 keepalive
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
	// 初始化   'component', 'directive', 'filter'
  initAssetRegisters(Vue)
}
