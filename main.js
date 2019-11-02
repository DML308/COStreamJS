import * as utils from "./src/utils"
import * as NodeTypes from "./src/ast/node.js"
import parser from "./src/config/parser.js"
import "./src/ast/constantValuePropagation"
import { ast2String } from "./src/ast/toString"
import { SemCheck } from "./src/LifeCycle/semcheck"
import { AST2FlatStaticStreamGraph } from "./src/LifeCycle/ast2ssg"
import { unfold } from "./src/FrontEnd/unfoldComposite"
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

Object.assign(COStreamJS.__proto__, {
    parser,
    AST2FlatStaticStreamGraph,
    unfold,
    SemCheck,
    DumpStreamGraph,
    GreedyPartition,
    GetSpeedUpInfo,
    PrintSpeedUpInfo,
    StageAssignment,
    codeGeneration,
    SymbolTable
})
COStreamJS.main = function(str, cpuCoreNum = 4){
    debugger
    this.ast = COStreamJS.parser.parse(str)
    //this.S = new SymbolTable(this.ast)
    this.S = generateSymbolTables(this.ast);
    this.gMainComposite = this.SemCheck.findMainComposite(this.ast)
    this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold)
    WorkEstimate(this.ssg)
    ShedulingSSG(this.ssg)
    this.mp = new this.GreedyPartition(this.ssg)
    this.mp.setCpuCoreNum(cpuCoreNum)
    this.mp.SssgPartition(this.ssg)
    this.mp.computeCommunication()
    let SI = this.GetSpeedUpInfo(this.ssg,this.mp)
    debug(this.PrintSpeedUpInfo(SI))
    this.MaxStageNum = this.StageAssignment(this.ssg,this.mp)
    this.files = {}
    this.codeGeneration(this.mp.finalParts,this.ssg,this.mp)
}

//下面代码是为了在浏览器的 window 作用域下调试而做的妥协
COStreamJS.global = typeof window === "object" ? window : global
Object.assign(COStreamJS.global, utils)
Object.assign(COStreamJS.global, NodeTypes, {
    ast2String,
    COStreamJS
})

export default COStreamJS

/** 下面的代码用于支持命令行功能 */
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {

    const fs = require('fs')
    const argv = require('yargs')
        .option('j', {
            alias: 'nCpucore',
            demand: false,
            default: '4',
            describe: '设置可用核数',
            type: 'string'
        })
        .argv;

    exports.main = function commonjsMain(args) {
        if (!args[1]) {
            console.log('Usage: ' + args[0] + ' FILE');
            process.exit(1);
        }
        
        const source_content = fs.readFileSync(require('path').normalize(args[1]), "utf8");
        const source_filename = args[1].split('/').pop().split('.')[0]
        COStreamJS.main(source_content, argv.j); //执行编译
        fs.rmdirSync('./dist/' + source_filename, { recursive: true })
        fs.mkdirSync('./dist/' + source_filename)
        Object.entries(COStreamJS.files).forEach(([out_filename, content]) =>{
            fs.writeFileSync(`./dist/${source_filename}/${out_filename}`, content)
        })
    };
    if (typeof module !== 'undefined' && require.main === module) {
        exports.main(process.argv.slice(1));
    }
}

