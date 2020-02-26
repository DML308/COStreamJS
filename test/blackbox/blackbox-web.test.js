/**
 * 黑盒测试, 执行 example 里的测试文件, 直到代码生成完成且生成的代码可以运行
 * 无编译错误或段错误.
 * 但不保证生成的代码执行的正确性
 */
import COStreamJS from "../../main"

const assert = require("assert")
const fs = require('fs')
const resolve = require('path').resolve


describe("blackbox 黑盒测试: 代码生成结果是否可运行 -- WEB 后端", () => {
    var files = [
        "wang.cos", 
        "multiOutputs.cos",
        // "DCT.cos", FIXME: 符号表引起的 this.i 未解决
        // "matrix.cos", FIXME: WEB 后端目前未支持矩阵
        // "pipeline.cos", // FIXME: 符号表引起的 this.current 未解决
        "scheduler.test.cos",
        //"splitjoinTest.cos" FIXME: 符号表引起的 this.i 未解决
        ]

    files.forEach(file => {
        it(`使用文件测试: ${file}`, () => {
            COStreamJS.options.platform = 'WEB'

            var str = fs.readFileSync(resolve(__dirname, `../../examples/${file}`), "utf8")
            console.warn(COStreamJS.options.platform)
            console.log(COStreamJS.files["main.cpp"])
            COStreamJS.main(str)
            assert(COStreamJS.files["main.cpp"])
            eval(COStreamJS.files["main.cpp"])
        })
    })
})