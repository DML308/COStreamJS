require('../main.js')
const assert = require('assert')
const fs = require('fs')
const resolve = require('path').resolve
const parser = require("../dist/parser.js").parser
describe("测试能否正确识别 examples 里的.cos 文件", () => {

    it("测试用例: wang.cos", () => {
        var str = fs.readFileSync(resolve(__dirname,"../examples/wang.cos"),"utf8")
        var node = parser.parse(str)
    })
  
})
