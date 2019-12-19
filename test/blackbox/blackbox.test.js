/**
 * 黑盒测试, 执行 example 里的测试文件, 直到代码生成完成且生成的代码可以运行
 * 无编译错误或段错误.
 * 但不保证生成的代码执行的正确性
 */

const test_file_names = ['wang', 'multiOutputs', 'matrix']

const assert = require("assert")
const fs = require('fs')
const resolve = require('path').resolve


describe("blackbox 黑盒测试: 代码生成结果是否可运行", () => {
    test_file_names.forEach(file => {
        it(`使用文件测试: ${file}`, () => {
            const { execSync } = require('child_process');
            const command = `node dist/costreamjs-cli.js -j4 examples/${file}.cos`
            execSync(command)
            const command_run = `cd dist/${file} && make && ./a.out`
            execSync(command_run)
        })
    })
})