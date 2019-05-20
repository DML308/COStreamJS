import * as utils from "./src/utils"
import * as NodeTypes from "./src/ast/node.js"
import parser from "./src/config/parser.js"
import { loadCVPPlugin } from "./src/ast/constantValuePropagation"
import { loadToStringPlugin, ast2String } from "./src/ast/toString"
import { SemCheck } from "./src/LifeCycle/semcheck"
import { AST2FlatStaticStreamGraph } from "./src/LifeCycle/ast2ssg"
import { unfold } from "./src/FrontEnd/unfoldComposite"
import { COStreamJS } from "./src/FrontEnd/global"
import { SymbolTable } from "./src/FrontEnd/symbol"
loadCVPPlugin()
loadToStringPlugin()

COStreamJS.parser = parser
COStreamJS.AST2FlatStaticStreamGraph = AST2FlatStaticStreamGraph
COStreamJS.unfold = unfold
COStreamJS.SemCheck = SemCheck
COStreamJS.main = function(str){
    debugger
    this.ast = COStreamJS.parser.parse(str)
    this.S = new SymbolTable(this.ast)
    this.gMainComposite = this.SemCheck.findMainComposite(this.ast)
    this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold)
}

//下面代码是为了在浏览器的 window 作用域下调试而做的妥协
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes, {
    ast2String,
    COStreamJS
})

export default COStreamJS

