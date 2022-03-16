/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 备份 mount
// 优先级： render > template > el
const mount = Vue.prototype.$mount
// 覆写 $mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
	// 得到挂载点，如果是元素，直接返回，如果是字符串，则 querySelector
  el = el && query(el)

	// 提示挂载不能是 body 和 html
  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

	// 配置选项
  const options = this.$options
  // resolve template/el and convert to render function
	// 没有渲染函数
  if (!options.render) {
		// 找到选项上的模板
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
					// 如果是 # 开头，则通过 id 找到对应元素的 innerHTML
          template = idToTemplate(template)
	        // 没找到就给一个提示
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
				// 如果已经一个元素了，直接拿到 innerHTML
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
			// 没有指定 template，找到选项中的 el 获取 el.outerHTML
      template = getOuterHTML(el)
    }
		// 如果有 template
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
	      // 标记元素在 HTML 模板字符串中的开始和结束的索引位置
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
	      // 界定符 {{ }}
        delimiters: options.delimiters,
	      // 是否保留注释
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
