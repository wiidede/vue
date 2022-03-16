/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

//export const baseOptions: CompilerOptions = {
//   expectHTML: true,
//   modules,
//   directives,
//   isPreTag,
//   isUnaryTag,
//   mustUseProp,
//   canBeLeftOpenTag,
//   isReservedTag,
//   getTagNamespace,
//   staticKeys: genStaticKeys(modules)
// }

export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
		// 编译的函数
    function compile (
			// 模板字符串
      template: string,
			// 编译选项
      options?: CompilerOptions
    ): CompiledResult {
			// 平台特有的编译选项 比如 web 平台，
	    // 以平台特有的编译选项为原型创建最终的编译配置
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

			// 将 options baseOptions 合并到 finalOptions
      if (options) {
				// 增强日志
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
				// 合并一些选项
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

	    // 执行 baseCompile 得到编译结果
	    const compiled = baseCompile(template.trim(), finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
			// 执行之前产生的错误和提示
      compiled.errors = errors
      compiled.tips = tips
	    // 返回编译结果
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
