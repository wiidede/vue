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
 * 附加到每个被观察对象的观察者类。附加后，观察者将目标对象的属性键转换为收集依赖项和调度更新的 getter/setter
 * 观察者类，会被附加到每个被观察的对象上，value.__ob__ = this
 * 而对象的各个属性则会被转换成 getter/setter，并收集依赖和通知更新
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    // 实例话一个 dep
    this.dep = new Dep()
    this.vmCount = 0
    // 在 value 对象上设置 __ob__ 属性
    def(value, '__ob__', this)
    /**
     * value 为数组
     * hasProto = '__proto__' in {}
     * 用于判断对象是否存在 __proto__ 属性，通过 obj.__proto__ 可以访问对象的原型链
     * 但由于 __proto__ 不是标准属性，所以有些浏览器不支持，比如 IE6-10，Opera10.1
     * 为什么要判断，是因为一会儿要通过 __proto__ 操作数据的原型链
     * 覆盖数组默认的七个原型方法，以实现数组响应式
     */
    if (Array.isArray(value)) {
      if (hasProto) {
        // 有 __proto__
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    } else {
      // value 为对象，为对象的每个属性（包括嵌套对象）设置响应式
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 遍历所有属性并将它们转换为 getter/setter。仅当值类型为 Object 时才应调用此方法
   *
   * 遍历对象上的每个 key，为每个 key 设置响应式
   * 仅当值为对象时才会走这里
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   *
   * 遍历数组，为数组的每一项设置观察，处理数组元素为对象的情况
   */
  observeArray (items: Array<any>) {
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
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 * 通过定义隐藏属性来增强目标对象或数组。
 *
 * 在目标对象上定义指定属性
 * 比如数组：为数组对象定义那七个方法
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
 * 尝试为一个值创建一个观察者实例，如果成功观察到，则返回新的观察者，如果该值已经有一个，则返回现有的观察者。
 */
/**
 * 响应式处理的真正入口
 * 为对象创建观察者实例，如果对象已经被观察过，则返回已有的观察者实例，否则创建新的观察者实例
 * @param {*} value 对象 => {}
 * @param asRootData
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 非对象和 VNode 实例不做响应式处理
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果 value 对象上存在 __ob__ 属性，则表示已经做过观察了，直接返回 __ob__ 属性
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建观察者实例
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 *
 * 拦截 obj[key] 的读取和设置操作：
 *   1、在第一次读取时收集依赖，比如执行 render 函数生成虚拟 DOM 时会有读取操作
 *   2、在更新时设置新值并通知依赖更新
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化 dep，一个 key 一个 dep
  const dep = new Dep()

  // 获取 obj[key] 的属性描述符，发现它是不可配置对象的话直接 return
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 记录 getter 和 setter，获取 val 值
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 递归调用，处理 val 即 obj[key] 的值为对象的情况，保证对象中的所有 key 都被观察
  let childOb = !shallow && observe(val)
  // 响应式核心
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // get 拦截对 obj[key] 的读取操作
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      /**
       * Dep.target 为 Dep 类的一个静态属性，值为 watcher，在实例化 Watcher 时会被设置
       * 实例化 Watcher 时会执行 new Watcher 时传递的回调函数（computed 除外，因为它懒执行）
       * 而回调函数中如果有 vm.key 的读取行为，则会触发这里的 读取 拦截，进行依赖收集
       * 回调函数执行完以后又会将 Dep.target 设置为 null，避免这里重复收集依赖
       */
      if (Dep.target) {
        // 依赖收集，在 dep 中添加 watcher，也在 watcher 中添加 dep
        dep.depend()
        // childOb 表示对象中嵌套对象的观察者对象，如果存在也对其进行依赖收集
        if (childOb) {
          // 这就是 this.key.childKey 被更新时能触发响应式更新的原因
          childOb.dep.depend()
          // 如果是 obj[key] 是 数组，则触发数组响应式
          if (Array.isArray(value)) {
            // 为数组项为对象的项添加依赖
            dependArray(value)
          }
        }
      }
      return value
    },
    // set 拦截对 obj[key] 的设置操作
    set: function reactiveSetter (newVal) {
      // 旧的 obj[key]
      const value = getter ? getter.call(obj) : val
      // 如果新老值一样，则直接 return，不跟新更不触发响应式更新过程
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // setter 不存在说明该属性是一个只读属性，直接 return
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      // 设置新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 对新值进行观察，让新值也是响应式的
      childOb = !shallow && observe(newVal)
      // 依赖通知更新
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
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
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
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 当数组被触摸时收集对数组元素的依赖关系，因为我们不能像属性 getter 那样拦截数组元素的访问
 *
 * 遍历每个数组元素，递归处理数组项为对象的情况，为其添加依赖
 * 因为前面的递归阶段无法为数组中的对象元素添加依赖
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
