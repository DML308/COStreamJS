const assert = require('assert')
const fs = require('fs')
const resolve = require('path').resolve
const lexerPath = resolve(__dirname, "../src/config/parser.jison")
const TextContent = fs.readFileSync(lexerPath, "utf8").split('\n')

describe("lexer NUMBER",function(){
    var regOfNumber = '^'+ TextContent.find(x=>/return\s+'NUMBER'/.test(x)).split(/\s+/)[0] + '$'
    var reg = new RegExp(regOfNumber)
    //console.log(reg)
    it("数字可以有正负号",()=>{
        assert(reg.test("+9") && reg.test('-9'))
    })
    it("数字可以有小数点,但不能有超过1个的小数点",()=>{
        assert(reg.test('1.2'))
        assert(reg.test('1.2.3') === false)
    })
    it("数字可以加 E10,E+10 或 e-9 的后缀来表示科学记数法",()=>{
        ["1.2E9","1.2e9","3E+10","4E-10"].forEach(x=>{
            assert(reg.test(x))
        })
    })
})