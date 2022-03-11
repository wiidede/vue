/* @flow */

import { ASSET_TYPES } from '../../shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

/**
 * TODO 看一下与 mixin 的区别
 *   A: mixin 是混入到xx
 *   extend 是从xx继承
 * @param Vue
 */
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 扩展 Vue 子类，预设一些配置项
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
	  // 用同一个配置项多次调用 Vue.extend 方法时，第二次调用开始就会使用缓存
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

		// 验证组件名称
	  // 和 Vue 构造方法时一样的
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

		// 定义一个 Vue 子类
    const Sub = function VueComponent (options) {
      this._init(options)
    }
		// 设置子类的原型对象
    Sub.prototype = Object.create(Super.prototype)
	  // 设置构造函数
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
	  // 合并选项
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
	  // 将 props 和 computed 代理到子类上
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

		// 让子类可以继续向下扩展
    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
	  // 组件递归调用
    // enable recursive self-lookup
    if (name) {
	    // {
			// 	 name: 'Comp',
	    //   components: { Comp: Comp}
	    // }
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
	  // 在扩展时保留对超级选项的引用。稍后在实例化时，我们可以检查 Super 的选项是否已更新。
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
	  // 缓存
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
