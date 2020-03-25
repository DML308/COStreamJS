import * as utils from "./src/utils"
import * as NodeTypes from "./src/ast/node.js"
import parser from "./src/config/parser.js"
import "./src/ast/constantValuePropagation"
import { ast2String } from "./src/ast/toString"
import { SemCheck } from "./src/LifeCycle/semcheck"
import { AST2FlatStaticStreamGraph } from "./src/LifeCycle/ast2ssg"
import { UnfoldComposite } from "./src/FrontEnd/unfoldComposite"
import "./src/FrontEnd/unfoldSequential"
import { COStreamJS } from "./src/FrontEnd/global"
import { SymbolTable } from "./src/FrontEnd/symbol"
import {generateSymbolTables} from "./src/FrontEnd/generateSymbolTables"
import { WorkEstimate } from "./src/LifeCycle/workEstimate"
import { ShedulingSSG } from "./src/LifeCycle/SchedulingSSG"
import { DumpStreamGraph } from "./src/LifeCycle/DumpStreamGraph"
import { GreedyPartition } from "./src/BackEnd/GreedyPartition"
import { GetSpeedUpInfo, PrintSpeedUpInfo } from "./src/BackEnd/ComputeSpeedUp"
import { StageAssignment } from "./src/BackEnd/StageAssignment"
import { codeGeneration } from "./src/LifeCycle/codeGeneration"
import handle_options from './src/LifeCycle/handle_options'

Object.assign(COStreamJS.__proto__, {
    parser,
    AST2FlatStaticStreamGraph,
    unfold : new UnfoldComposite(),
    SemCheck,
    DumpStreamGraph,
    GreedyPartition,
    GetSpeedUpInfo,
    PrintSpeedUpInfo,
    StageAssignment,
    codeGeneration,
    SymbolTable,
})

COStreamJS.main = function(str, options = { coreNum:4 }){
    debugger
    COStreamJS.global.errors = utils.errors
    // 1. 先检查括号是否匹配
    if(!utils.checkBraceMatching(str)) return
    // 2. 词语法分析构建语法树
    this.ast = COStreamJS.parser.parse(str)
    // 3. 遍历语法树进行语义分析和构建符号表
    this.symbolTableList = generateSymbolTables(this.ast);
    if(COStreamJS.global.errors.length) return;
    this.S = this.symbolTableList[0]
    this.gMainComposite = this.SemCheck.findMainComposite(this.ast)
    
    // 4. 语法树转数据流图
    this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold, this.S)
    // 5. 工作量估计
    WorkEstimate(this.ssg)
    // 6. 调度
    ShedulingSSG(this.ssg)
    // 7. 划分
    this.mp = new this.GreedyPartition(this.ssg)
    this.mp.setCpuCoreNum(options.coreNum)
    this.mp.SssgPartition(this.ssg)
    this.mp.computeCommunication()
    // 8. 输出统计信息
    let SI = this.GetSpeedUpInfo(this.ssg,this.mp)
    utils.debug(this.PrintSpeedUpInfo(SI))
    // 9. 阶段赋值
    this.MaxStageNum = this.StageAssignment(this.ssg,this.mp)
    // 10.目标代码生成
    this.files = {}
    this.options.platform = options.platform || this.options.platform
    this.codeGeneration(this.mp.finalParts,this.ssg,this.mp)
}

//下面代码是为了在浏览器的 window 作用域下调试而做的妥协
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes, {
    ast2String,
    COStreamJS
})

/** 下面的代码用于支持命令行功能 */
if (typeof module !== 'undefined' && require.main === module) {
    handle_options.main(process.argv);
}

export default COStreamJS

