require('../main.js')
const assert = require('assert')
const parser = require("../dist/parser.js").parser
describe("测试表达式的运算符优先级是否正确",()=>{
    it("1+2*3 == 7",()=>{
        assert(parser.parse("1+2*3").value == 7)
    })
    it("-10-5%2 == -11", () => {
        assert(parser.parse("-10-5%2").value == -11)
    })
    it("+5+-10 == -5", () => {
        assert(parser.parse("+5+-10").value == -5)
    })
    it("10>>1 >= 5 ? 6 : 7 == 6", () => {
        assert(parser.parse("10>>1 >= 5 ? 6 : 7").value )
    })
})
