const assert = require('assert')
const fs = require('fs')
const resolve = require('path').resolve
const lexerPath = resolve(__dirname, "../src/config/parser.jison")
const TextContent = fs.readFileSync(lexerPath, "utf8").split('\n')
import COStreamJS from "../main"
const lexer = COStreamJS.parser.lexer
describe("lexer NUMBER", function () {
    var regOfNumber = '^' + TextContent.find(x => /return\s+'NUMBER'/.test(x)).split(/\s+/)[0] + '$'
    var reg = new RegExp(regOfNumber)
    //console.log(reg)
    it("数字可以有正负号", () => {
        assert("但为避免歧义, 该正负号放在了文法中处理")
    })
    it("数字可以有小数点,但不能有超过1个的小数点", () => {
        assert(reg.test('1.2'))
        assert(reg.test('1.2.3') === false)
    })
    it("数字可以加 E10,E+10 或 e-9 的后缀来表示科学记数法", () => {
        ["1.2E9", "1.2e9", "3E+10", "4E-10"].forEach(x => {
            assert(reg.test(x))
        })
    })
})
describe("lexer 字符串长度为1的运算符", function () {
    var regOfSingle = lexer.rules.find(x => /-\*\+/.test(x.source))
    //console.log(regOfSingle)
    var reg = new RegExp(regOfSingle)
    "-*+/%&|~!.?:;,#'\"()[]{}<>=".split('').forEach(x => {
        it(`输入运算符 ${x}`, () => {
            assert(reg.test(x))
        })
    })
})

describe("lexer 字符串长度大于1的运算符", function () {
    var regOfDouble = lexer.rules.find(x => /##/.test(x.source))
    var reg = new RegExp(regOfDouble)
    "## ++ -- >> >> <= >= == != && ||".split(' ').forEach(x => {
        it(`输入运算符 ${x}`, () => {
            assert(reg.test(x))
        })
    })
})

describe("lexer '='以外的赋值运算符", function () {
    var regStr = lexer.rules.find(x => /-=/.test(x.source))
    //console.log(regStr)
    var reg = new RegExp(regStr)
    "*= /= += -= <<= >>= &= ^= |=".split(' ').forEach(x => {
        it(`输入运算符 ${x}`, () => {
            assert(reg.test(x))
        })
    })
})

describe("lexer 字符串的识别", function () {
    var regStr = lexer.rules.find(x => /\*'\|/.test(x.source))
    var reg = new RegExp(regStr);
    //console.log(regStr, reg);
    it("识别 stringConstant 的正则存在", () => {
        assert(regStr instanceof RegExp);
    });
    if (regStr instanceof RegExp){
        `'123.dot' "456.1" "123'45" '789"10'`.split(' ').forEach(x => {
            it(`输入字符串 ${x}`, () => {
                assert(reg.test(x))
            })
        })
    }
})

describe("lexer 注释的识别", function () {
    it("识别 单行注释 //", () => {
        var regStr = lexer.rules.find(x => /\\\/\\\//.test(x.source))
        var reg = new RegExp(regStr);
        //console.log(regStr, reg);
        assert(regStr.test('//12345'));
    });
    it("识别 多行注释 /* */", () => {
        var regStr = lexer.rules.find(x => /\\\/\\\*/.test(x.source))
        var reg = new RegExp(regStr);
        //console.log(regStr, reg);
        assert(regStr.test('/* \n */'));
    });
 
})