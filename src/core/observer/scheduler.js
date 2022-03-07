/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  flushing = true // flushing true 表示 watcher 队列正在被刷新
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
	// 在刷新之前对队列进行排序。这可确保：
	// 1. 组件从父组件更新到子组件。 （因为父组件总是在子组件之前创建）
	// 2. 组件的用户观察者在其渲染观察者之前运行（因为用户观察者是在渲染观察者之前创建的）
	// 3. 如果组件在父组件的观察者运行期间被销毁，其观察者可以被跳过。
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
	// 遍历 watcher 队列
  for (index = 0; index < queue.length; index++) {
    // TODO 为什么 queue.length 可能变化? 答：引用群友的问题：
		//    如何出现异步更新己经执行还有执行 queueWatcher 的情况?
	  // 	  A:如果是一个用户 watcher，即 watch 选项，监听到数据更新，经过异步更新队列的过程，
	  // 	  最后开始刷新队列，执行 watcher.run -> watcher.get -> 最后执行 watch 选项的回调函数，
	  // 	  如果回调函数中有更新另一个响应式数据的情况这时候就会触发 setter，然后触发依赖通知更新,
	  // 	  接着 watcher入队当前 watcher
	  //    另一位群友： 比如说，嵌套调用 $watch 就会出现这种情况
    watcher = queue[index]
	  // 执行 before 钩子
    if (watcher.before) {
      watcher.before()
    }
		// 清空缓存，表示当前 watcher 已经被执行，该 watcher 再次入队就可以进来了
    id = watcher.id
    has[id] = null
    watcher.run() // 执行 watcher
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState() // waiting = flushing = false 结束刷新

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * TODO keep alive?
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true // 第一次进来置为 true 防止 watcher 重新入队
    if (!flushing) {
			// TODO 了解 flushing A: flush 就是刷新的意思，表示当前队列在不在刷新
			// flushing false 表示当前 watcher 队列没有在被刷新，watcher 直接入队
      queue.push(watcher)
    } else {
			// watcher 队列正在被刷新
	    // TODO 什么情况下，会到这里？ flushing 的时候会调用这个？ A：这个问题同：为什么 queue.length 可能变化
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      } // 找到 watcher 的顺序，保证 watcher 入队后，队列还是有序的
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
			// waiting 为 false，表示当前浏览器的异步任务队列中没有 flushSchedulerQueue 函数
	    // TODO 然后呢？ A：这里应该是 prod 环境，flushSchedulerQueue在异步任务中了，不需要再次调用了，
	    //  当调用到 flushSchedulerQueue，就应该会把 Queue 中的 watcher 都 run 一下
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
				// 同步执行，直接去刷新 watcher
	      // 性能就会大打折扣
        flushSchedulerQueue() // TODO flushSchedulerQueue 什么东西啊？ A: 应该就是刷新队列，执行 queue 中所有 watcher 的 run
        return
      }
      nextTick(flushSchedulerQueue)  // this.$nextTick
    }
  }
}
