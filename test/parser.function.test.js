require('../main.js')
const assert = require('assert')
import COStreamJS from "../main"
const parser = COStreamJS.parser

describe("测试能否正确识别函数定义 functino_definition 和它的 函数体内的各种 statement", () => {

    it("纪录函数头 int main(int x, int y){}", () => {
        var node = parser.parse("int main(double x, string y){}")[0]
        assert(['int','main','double','string','x','y'].every(x=>checkHasValueByDFS(node,x)))
    })
    it("return", () => {
        var node = parser.parse("int main(){ return; return 0;}")[0]
    })
    it("switch case", () => {
        var node = parser.parse("int main(){ switch(i){ case 0: return ;}}")[0]
    })
    it("switch case default", () => {
        var node = parser.parse("int main(){ switch(i){ case 0: return ; default: return ;}}")[0]
    })
    it("if", () => {
        var node = parser.parse("int main(){ if(i) return; }")[0]
    })
    it("if else ", () => {
        var node = parser.parse("int main(){ if(i) return; else return 1; }")[0]
    })
    it("if if else 优先级测试", () => {
        var node = parser.parse("int main(){ if(1) if(2){} else { i++; } }")[0]
        var statements = node.funcBody.stmt_list
        var flag = statements[0].op4 !== "else" && statements[0].statement.op4 === "else"
        assert(flag)
    })
    it("for(i=0,j=2;i<10;i++){}", () => {
        var node = parser.parse("int main(){ for(i=0,j=2;i<10;i++){} }")[0]
    })
    it("for(;;){ break ;}", () => {
        var node = parser.parse("int main(){ for(;;){break;} }")[0]
    })
    it("while(0){ continue ;}", () => {
        var node = parser.parse("int main(){ while(0){ continue ;} }")[0]
    })
    it("do{i++;}while(1)", () => {
        var node = parser.parse("int main(){ do{i++;}while(1); }")[0]
    })
})

//深度优先遍历一个 node 来检查其数值
function checkHasValueByDFS(node,value) {
    if (typeof node !== 'object') {
        return node == value
    }
    var result = false
    for (var i of Object.keys(node)) {
        if(node[i] !== undefined && node[i] !== null){
            var result = result || checkHasValueByDFS(node[i],value)
            if (result === true) {
                return result
            }
        }
    }
}