require('../../main.js')
const assert = require('assert')
const fs = require('fs')
const resolve = require('path').resolve

import COStreamJS from "../../main"
const parser = COStreamJS.parser

describe("测试能否正确识别 examples 里的.cos 文件", () => {

    var files = ["wang.cos","pipeline.cos","splitjoinTest.cos","multiOutputs.cos","scheduler.test.cos","DCT.cos"]
    files.forEach(file=>{
        it(`测试用例: ${file}`, () => {
            var str = fs.readFileSync(resolve(__dirname, `../../examples/${file}`), "utf8")
            var node = parser.parse(str)
        })
    })
  
})
