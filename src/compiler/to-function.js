/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'
import { generateCodeFrame } from './codeframe'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  return function compileToFunctions (
		// 字符串模板
    template: string,
		// 编译选项
    options?: CompilerOptions,
		// 组件实例
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options)
	  // 日志
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
	          // 看来你是在一个有内容安全策略的环境中使用Vue.js的独立构建，
	          // 该策略禁止 unsafe-eval。 模板编译器不能在这种环境下工作。
	          // 可以考虑放宽政策，允许 unsafe-eval，或者将模板预编译成渲染函数。
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

		// 从缓存中获取编译结果
    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
	  // 执行编译函数，检查编译结果
    const compiled = compile(template, options)

    // check compilation errors/tips
	  // 检查编译过程中产生的所有 error 和 tip 并输出
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

		// 编译结果 compiled.render 是一个字符串，是一个可执行函数的字符串形式
    // turn code into functions
    const res = {}
    const fnGenErrors = []
	  // 执行 new Function(code) 将字符串转换成函数
    res.render = createFunction(compiled.render, fnGenErrors)
	  // 将静态函数的字符串转化为函数
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
	  // 检查函数生成错误。只有在编译器本身存在错误时才会发生这种情况。主要用于代码生成开发使用
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

		// 将编译结果缓存 并返回
    return (cache[key] = res)
  }
}
