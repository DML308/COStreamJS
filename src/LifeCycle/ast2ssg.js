import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { top, setTop, generateCompositeRunningContext } from "../FrontEnd/generateSymbolTables" 
import { runningStack, SymbolTable, Variable } from "../FrontEnd/symbol"
import { debug } from "../utils"
import { binopNode, operatorNode, compositeCallNode, splitjoinNode, pipelineNode, operNode } from "../ast/node";
import { COStreamJS } from "../FrontEnd/global";
/*
 *  功能：将抽象语法树转为平面图
 *  输入参数：gMaincomposite
 *  GraphToOperators：递归的调用，完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
 *  SetTopNode：设置顶层节点
 *  ResetFlatNodeNames：给所有的图节点重命名
 *  SetFlatNodesWeights：设置静态数据流图的peek，pop，push值
 *  输出：静态数据流图ssg
 */
export function AST2FlatStaticStreamGraph(mainComposite,unfold,S){
    var ssg = new StaticStreamGraph()
    debug("--------- 执行GraphToOperators, 逐步构建FlatNode ---------------\n");

    setTop(S);

    GraphToOperators(null, mainComposite, ssg, unfold, S);
    //若执行过 unfold 操作, 则可查看展开后的数据流程序: debug(COStreamJS.ast.map(_=>_+'').join('\n').beautify()) 

    ssg.topNode = ssg.flatNodes[0]
    ssg.ResetFlatNodeNames(); /* 将每个composite重命名 */
    // ssg.SetFlatNodesWeights(); 这一步移动到 GenerateFlatNodes 中做

    runningStack.length = 0 // 清空执行上下文栈
    debug("--------- 执行AST2FlatStaticStreamGraph后, 查看静态数据流图 ssg 的结构中的全部 FlatNode ---------\n");

    return ssg
}

/*
* 功能：递归的调用，
* 完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
* 输入参数：composite
* 输出：设置静态数据流图的对应flatNode节点，完成数据流边到flatNode节点的映射
*/

/**
 * 1.遇到 out = call(in){ int / work / window } 形式的 operatorNode, 则在 ssg 中创建该 flatNode 并连接Edge
 * 2.遇到 pipeline 或 splitjoin , 则将其展开为一个真正的 composite 并挂载至 COStream.ast
 * 
 * @param {operNode} call
 * @param {compositeNode} composite
 * @param {StaticStreamGraph} ssg
 * @param {SymbolTable} S
 * @param {number[]} params
 */
function GraphToOperators(call, composite, ssg, unfold, S, params = []){
    /** 执行上下文栈 */
    runningStack.push(top)
    generateCompositeRunningContext(call, composite, params); //传入参数,并生成 composite 调用的执行上下文环境

    for (let it of composite.body.stmt_list){
        
        let exp = it instanceof binopNode ? it.right : it //获取到要处理的 operator(){}或 pipeline()或其他,无论是直接调用还是通过 binopNode 的 right 来调用

        if(exp instanceof operatorNode){
            ssg.GenerateFlatNodes(exp, params)

        }else if(exp instanceof compositeCallNode){
            const actual_composite = S.compTable[exp.compName].composite
            const params = (exp.params||[]).map(e => e.value)
            
            GraphToOperators(exp,actual_composite, ssg, unfold,S,params);
            
        }else if(exp instanceof splitjoinNode){
            const call = unfold.UnfoldSplitJoin(exp)
            const actual_composite = S.compTable[call.compName].composite // 查看该生成的结构: debug(actual_composite.toString().beautify())
            GraphToOperators(call, actual_composite, ssg, unfold,S)

        }else if(exp instanceof pipelineNode){
            const call = unfold.UnfoldPipeline(exp)
            const actual_composite = S.compTable[call.compName].composite
            GraphToOperators(call, actual_composite, ssg, unfold, S)
        }
    }

    setTop(runningStack.pop())
}