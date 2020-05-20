import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { top,setTop } from "../FrontEnd/global"
import { generateCompositeRunningContext } from "../FrontEnd/generateSymbolTables" 
import { runningStack, SymbolTable, Variable } from "../FrontEnd/symbol"
import { debug } from "../utils"
import { binopNode, operatorNode, compositeCallNode, splitjoinNode, pipelineNode, operNode, sequentialNode, parenNode } from "../ast/node";
import { fileReaderNode,fileWriterNode } from "../ast/node";

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


/**
 * 功能：递归的调用，生成 ssg 中的所有 flatNode
 * 算法思路: 2遍遍历
 * 1. 在第一遍遍历中 遇到 pipeline 或 splitjoin 等复合结构, 则将其展开为一个真正的 composite 并挂载至 COStream.ast
 * 2. 在第二遍遍历中 遇到 out = call(in){ int / work / window } 形式的 operatorNode, 则在 ssg 中创建该 flatNode 并连接Edge
 *                 遇到 out = compCall(in); 形式的 compositeCall 调用, 则查符号表找到该 composite, 再深入其中来连接数据流
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


    /** 先执行第一遍遍历, 检查是否有符合解构, 若有则展开复合结构, 将其替换为传统 compositeCall 调用, 方便打断点 toString 调试
     * 例如将  Out = splitjoin(In){ ... }; 替换为 Out = splitjoin_0(In);  在 ast 中会出现额外的定义 composite splitjoin_0(...) { ... }
     * 例如将  Out = sequential(In){ ... }; 替换为 Out = sequential(In);  在 ast 中会出现额外的定义 composite sequential(...) { ... }
     */
    for(let i in composite.body.stmt_list){

        let it = composite.body.stmt_list[i], call;
        let exp = it instanceof binopNode ? it.right : it //获取到要处理的 operNode, 无论是直接调用还是通过 binopNode 的 right 来调用

        switch(exp.constructor){
            case splitjoinNode: call = unfold.UnfoldSplitJoin(exp); break;
            case pipelineNode: call = unfold.UnfoldPipeline(exp); break;
            case sequentialNode: call = unfold.UnfoldSequential(exp); break;
            default: continue;
        }

        if(call.outputs && call.outputs.length > 0){
            const left = call.outputs.length > 1? new parenNode(it._loc, call.outputs) : call.outputs[0]
            const binop = new binopNode(it._loc, left,'=', call)
            composite.body.stmt_list[i] = binop
        }else{
            composite.body.stmt_list[i] = call
        }   
        
    }
    // 展开完毕, 可在 chrome 控制台中输入右侧代码来查看展开的结果 console.log(COStreamJS.ast.map(_=>_+'').join('\n').beautify())

    /** 再执行第二遍遍历, 这次遍历中, 仅有 operator 或 compositCall */
    for (let it of composite.body.stmt_list){
        
        let exp = it instanceof binopNode ? it.right : it

        if(exp instanceof fileReaderNode || exp instanceof fileWriterNode){
            ssg.GenerateFlatNodes(exp)
        }
        else if(exp instanceof operatorNode){
            ssg.GenerateFlatNodes(exp, params)

        }else if(exp instanceof compositeCallNode){
            const actual_composite = S.compTable[exp.compName].composite
            const params = (exp.params||[]).map(e => e.value)
            
            GraphToOperators(exp,actual_composite, ssg, unfold,S,params);
            
        }
    }

    setTop(runningStack.pop())
}