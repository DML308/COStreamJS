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
import { WorkEstimate } from "./src/LifeCycle/workEstimate"
import { ShedulingSSG } from "./src/LifeCycle/SchedulingSSG"
import { DumpStreamGraph } from "./src/LifeCycle/DumpStreamGraph"
import { GreedyPartition } from "./src/BackEnd/GreedyPartition"
loadCVPPlugin()
loadToStringPlugin()

Object.assign(COStreamJS, {
    parser,
    AST2FlatStaticStreamGraph,
    unfold,
    SemCheck,
    DumpStreamGraph,
    GreedyPartition
})
COStreamJS.main = function(str){
    debugger
    this.ast = COStreamJS.parser.parse(str)
    this.S = new SymbolTable(this.ast)
    this.gMainComposite = this.SemCheck.findMainComposite(this.ast)
    this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold)
    WorkEstimate(this.ssg)
    ShedulingSSG(this.ssg)
    this.mp = new this.GreedyPartition(this.ssg)
    this.mp.setCpuCoreNum(4)
    this.mp.SssgPartition(this.ssg)
}

//下面代码是为了在浏览器的 window 作用域下调试而做的妥协
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes, {
    ast2String,
    COStreamJS
})

export default COStreamJS

