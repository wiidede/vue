/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// createCompilerCreator 返回一个 createCompiler 函数
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
	// 执行 最核心的 baseCompile
	// 将 html 模板字符串解析为 ast 对象
  const ast = parse(template.trim(), options)
	// 优化
  if (options.optimize !== false) {
    optimize(ast, options)
  }
	// 代码生成，将 ast 转换成 render 函数的字符串形式
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
