/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
		// observer 上记录 value dep vmCount
	  // TODO vmCount 有什么用? observer 上的 dep 和 key 上的 dep?
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
	  // 处理数组响应式
    if (Array.isArray(value)) {
			// 判断是否有 proto
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
			// 处理对象响应式
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
			// 对象上的每个 key 执行 defineReactive 方法
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
		// 遍历数组, 进行响应式处理
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
	// 用重写的原型覆盖数组原来的原型
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 * 如果没有原型对象, 直接在 array 上赋值相应的方法
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 响应式处理
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
	// 如果已经有 __ob__ 表明已经被响应式处理了,直接返回 ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
		// 判断是否需要响应式, 需要响应式的值需要是一个对象/数组
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
		// 实例化一个 Observer, 进行响应式处理
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
	// 实例化一个 dep, 一个 key 对应一个 dep
  const dep = new Dep()

	// 获取属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
	// 如果 configurable 为 false, 不可配就直接返回
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

	// 递归, 处理对象, 也就是说, 这里是先给子属性进行响应式处理的
  let childOb = !shallow && observe(val)
	// 拦截 obj.key
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
			// 先获取值
      const value = getter ? getter.call(obj) : val
	    // 依赖收集 dep 和 watcher 双向收集
      if (Dep.target) {
        dep.depend()
        if (childOb) {
					// 对嵌套对象同样进行依赖收集
          childOb.dep.depend() // 也就是说, child 上有响应式更新, 会触发这里的 watcher
	        // TODO 这样是不是说, 当前的 watcher 会存在于 子属性/根属性 上?
          if (Array.isArray(value)) {
						// 如果嵌套的对象是数组, 处理数组
            dependArray(value)
          }
        }
      }
			// 返回值
      return value
    },
	  // 拦截 set
    set: function reactiveSetter (newVal) {
			// 获取老值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
	    // TODO 自己和自己比较干嘛呢? A: 提交记录表示为了识别 NaN 重新赋值 NaN 会触发响应式
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
			// 不相等则更新值
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
			// 对新值做响应式处理
      childOb = !shallow && observe(newVal)
	    // 通知更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
	// 处理数组的情况，实际就是调用 splice
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
	// 处理对象的情况，并且 target 原来就有这个属性（不在原型上），则不需要处理响应式，直接更新对应的 key
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
	// 不要在 vm 实例上使用 或者 data 上 set
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
	// 如果 target 不是响应式对象，不做响应式处理，直接设置对应的 key
  if (!ob) {
    target[key] = val
    return val
  }
	// 对新属性设置 getter 和 setter， 读取时收集依赖，更新时触发依赖通知更新
  defineReactive(ob.value, key, val)
	// 直接通知依赖通知更新
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
	// 数组里用 splice 方法
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
	// 不要在 Vue 实例和 data 上用 del
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
	// 对象上没有这个key
  if (!hasOwn(target, key)) {
    return
  }
	// 删除对象上的属性
  delete target[key]
  if (!ob) {
    return
  }
	// 通知更新
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 处理嵌套对象为数组的情况
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
