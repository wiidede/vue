/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set() // TODO seen 最后在哪里用了呢？ A: 防止重复收集依赖

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * 递归遍历一个对象以调用所有转换的 getter，以便将对象内的每个嵌套属性都收集为“深度”依赖项。
 *
 * traverse 遍历
 *
 * 在遍历的时候，会调用深度对象上，已经有 __ob__ 的属性，这样就可以把这些 __ob__ 也收集起来
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
	// 如果 不是数组和对象 val被冻结 vnode 直接返回
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  if (val.__ob__) {
		// 如果有 ob，把 depId 放入 seen set
    const depId = val.__ob__.dep.id
	  // 如果 seen 已经存在了，就返回
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
	  // 如果是数组就遍历数组，对其每一个继续进行遍历
    while (i--) _traverse(val[i], seen)
  } else {
		// 如果是对象，遍历对象上的key
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
