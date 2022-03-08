import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// _init
initMixin(Vue)
// 处理 $data $props $set $delete $watch
stateMixin(Vue)
// 处理 $on $once $off $emit
eventsMixin(Vue)
// 处理 _update $destroy $forceUpdate
lifecycleMixin(Vue)
// 处理 renderHelper $nextTick _render
renderMixin(Vue)

export default Vue
