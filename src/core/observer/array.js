/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// 基于数组的原型对象 创造一个新的对象
// 增强 数据原型方法
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 遍历这七个方法
 */
methodsToPatch.forEach(function (method) {
  // cache original method
	// 获取 array 原型上的原生方法
  const original = arrayProto[method]
	// 魔改原型上的七个方法
  def(arrayMethods, method, function mutator (...args) {
		// 先执行原生的方法
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
		// 如果有新增的元素, 对新增的元素进行响应式处理
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
