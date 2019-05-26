require('../../main.js')
const assert = require('assert')
import COStreamJS from "../../main"
const parser = COStreamJS.parser


describe("测试表达式的运算符优先级是否正确", () => {

    it("1+2*3 == 7", () => {
        var node = parser.parse("int i=1+2*3;")
        assert(getFirstValueByDFS(node) == 7)
    })
    it("-10-5%2 == -11", () => {
        var node = parser.parse("int i=-10-5%2;")
        assert(getFirstValueByDFS(node) == -11)
    })
    it("+5+-10 == -5", () => {
        var node = parser.parse("int i=+5+-10;")
        assert(getFirstValueByDFS(node) == -5)
    })
    it("10>>1 >= 5 ? 6 : 7 == 6", () => {
        var node = parser.parse("int i=10>>1 >= 5 ? 6 : 7;")
        assert(getFirstValueByDFS(node) == 6)
    })
    it("0? 1?2:3 : 4?5:6 == 5", () => {
        var node = parser.parse("int i=0? 1?2:3 : 4?5:6;")
        assert(getFirstValueByDFS(node) == 5)
    })
    it("!1 == 0", () => {
        var node = parser.parse("int i=!1 ;")
        assert(getFirstValueByDFS(node) == 0)
    })
    it("!0+2 == 2", () => {
        var node = parser.parse("int i=!0+2;")
        assert(getFirstValueByDFS(node) == 3)
    })
    it("3 || 0 && 0", () => {
        var node = parser.parse("int i= 3 || 0 && 0;")
        assert(getFirstValueByDFS(node) == 1)
    })
})

//深度优先遍历一个 node 来获取其中第一个数值
function getFirstValueByDFS(node) {
    if(typeof node !== 'object') return
    if (typeof node.value !== 'undefined') {
        return node.value
    }
    for (var i in node) {
        var result = getFirstValueByDFS(node[i])
        if (typeof result !== 'undefined')
            return result
    }
}