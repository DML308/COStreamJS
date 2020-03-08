import { checkBraceMatching } from "../../src/utils"
const assert = require('assert')
const fs = require("fs")
const resolve = require('path').resolve


describe("测试 checkBraceMatching 函数", ()=>{
    it("()[]{}", ()=>{
        assert(checkBraceMatching("()[]{}"))
    })    
    it("([)]",()=>{
        assert(!checkBraceMatching("([)]"))
    })
    it("code", ()=>{
        let content = fs.readFileSync(resolve(__dirname,"../../examples/wang.cos"), "utf8")
        assert(checkBraceMatching(content))
    })
})