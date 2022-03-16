/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this // 是否由渲染函数创建的，给 vm._watcher 赋值渲染函数的 watcher
    }
    vm._watchers.push(this)
    // options
	  // watcher 的选项
    if (options) {
      this.deep = !!options.deep // 深度
      this.user = !!options.user // 用户
      this.lazy = !!options.lazy // 懒执行
      this.sync = !!options.sync // 同步的?
      this.before = options.before // TODO 什么before? A: 在 watcher.run() 之前执行的函数
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : '' // 开发环境把函数字符串放到 expression 属性上
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
			// 处理 expOrFn 为字符串的情况, 如果是字符串, 接解析一下, 变成函数(返回一个表达式的对象)
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }


  /**
   * Evaluate the getter, and re-collect dependencies.
   * 执行 this.getter，并重新收集依赖
   * this.getter 是实例化 watcher 时传递的第二个参数，一个函数或者字符串，比如：updateComponent 或者 parsePath 返回的函数
   * 为什么要重新收集依赖？
   *   因为触发更新说明有响应式数据被更新了，但是被更新的数据虽然已经经过 observe 观察了，但是却没有进行依赖收集，
   *   所以，在更新页面时，会重新执行一次 render 函数，执行期间会触发读取操作，这时候进行依赖收集
   */
  get () {
		// 对新值进行依赖收集
		// Dep.target = this
    pushTarget(this)
    let value
    const vm = this.vm
    try {
			// 执行实例化 watcher 传进来的第二个参数
	    // 可能是函数
	    // 可能是一个 key，用 vm call
	    // 触发读取操作，进行依赖收集
      value = this.getter.call(vm, vm)
	    // 执行一遍 getter, 从 getter 中收集依赖,
	    // getter 的响应式对象, dep 的 subs 会添加当前这个 watcher
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property, so they are all tracked as
      // dependencies for deep watching
	    // 遍历一遍所有属性，触发 getter 收集依赖 （traverse - 遍历）
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
	    // 在 watcher 中添加 dep
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
				// 在 dep 中添加 watcher
        dep.addSub(this)
	      // 实现了 双向收集
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 梳理依赖关系
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
	      // 如果 旧的 dep 已经不在新的 dep 中了, 在旧的 dep 中, 移除自己(移除相应的 watcher)
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
			// 懒执行 比如 computed
      this.dirty = true // dirty 为 true，重新计算
    } else if (this.sync) {
			// 同步执行
	    // 在 watcher 中加入一个 sync 配置，比如 { sync: true}
      this.run()
    } else {
			// 将当前 watcher 放入 watcher 队列
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
	/**
	 * 由 刷新队列函数 flushSchedulerQueue 调用，如果是同步 watch，则由 this.update 直接调用，完成如下几件事：
	 *   1、执行实例化 watcher 传递的第二个参数，updateComponent 或者 获取 this.xx 的一个函数(parsePath 返回的函数)
	 *   2、更新旧值为新值
	 *   3、执行实例化 watcher 时传递的第三个参数，比如用户 watcher 的回调函数
	 */
  run () {
    if (this.active) {
			// 执行 get
      const value = this.get()
      if (// 值不相同 执行 cb
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
	      // 即使值相同，深度观察者和 ObjectArrays 上的观察者也应该触发，因为该值可能已经发生了变化。
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
					// 用户 watcher 调用，处理错误
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
