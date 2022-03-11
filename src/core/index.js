import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from './util'
import { FunctionalRenderContext } from './vdom/create-functional-component'

initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
	// TODO 函数式组件？
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
