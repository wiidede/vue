/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
	// 将所有的事件和对应的回调放到 vm._events 对象上
	// 调用方式： this.$on('custom-click', function() {...})
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
	  // 事件为数组的情况 this.$on(['event1', 'event2'], function() {...})
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
				// 调用 $on
        vm.$on(event[i], fn)
      }
    } else {
			// 也就是说一个事件可以存在多个回调函数
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
	    // hook开头
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

	// 通过 $on 增加事件，在回调函数中，使用 $off 移除回调函数，然后执行函数
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
	  // 将 on 函数作为回调函数，调用的时候删除
    vm.$on(event, on)
    return vm
  }

	// 移除事件监听器
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
	  // 如果两个参数都没有传，移除所有的事件
    if (!arguments.length) {
			// 直接将 _events 置为空
      vm._events = Object.create(null)
      return vm
    }
    // array of events
	  // 移除每一个事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
	  // 获取指定事件的回调函数
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    if (!fn) {
			// 没有传 fn，表示移除所有回调函数
      vm._events[event] = null
      return vm
    }
    // specific handler
	  // 移除指定事件的指定回调函数
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
	    // 在 cbs (:_event) 中找到对应的事件
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
	  // 警告不要使用驼峰格式，因为 HTML 属性只有小写
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
		// 获取指定事件的所有回调函数
    let cbs = vm._events[event]
    if (cbs) {
			// 类数组转换成数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
				// 执行回调函数
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
