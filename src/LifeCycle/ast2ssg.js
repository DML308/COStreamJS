import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { streamFlow } from "./compositeFLow"
import { debug } from "../utils"
import { binopNode, operatorNode, compositeCallNode, splitjoinNode, pipelineNode } from "../ast/node";
/*
 *  功能：将抽象语法树转为平面图
 *  输入参数：gMaincomposite
 *  streamFlow：对所有Main composite的composite调用进行实际流边量名的替换
 *  GraphToOperators：递归的调用，完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
 *  SetTopNode：设置顶层节点
 *  ResetFlatNodeNames：给所有的图节点重命名
 *  SetFlatNodesWeights：设置静态数据流图的peek，pop，push值
 *  输出：静态数据流图ssg
 */
export function AST2FlatStaticStreamGraph(mainComposite,unfold){
    var ssg = new StaticStreamGraph()
    streamFlow(mainComposite);
    debug("--------- 执行GraphToOperators, 逐步构建FlatNode ---------------\n");
    GraphToOperators(mainComposite, ssg, unfold);
    ssg.topNode = ssg.flatNodes[0]
    /* 将每个composite重命名 */
    ssg.ResetFlatNodeNames();
    ssg.SetFlatNodesWeights();
    debug("--------- 执行AST2FlatStaticStreamGraph后, 查看静态数据流图 ssg 的结构中的全部 FlatNode ---------\n");
    typeof window !== 'undefined' && debug(ssg);
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
 * 2.遇到 pipeline 或 splitjoin , 则将其展开为一个真正的 composite 并挂载至 exp.replace_composite
 * 
 * @param {StaticStreamGraph} ssg
 */
function GraphToOperators(/*compositeNode*/composite, ssg, unfold){
    for (let it of composite.body.stmt_list){
        
        let exp = it instanceof binopNode ? it.right : it //获取到要处理的 operator(){}或 pipeline()或其他,无论是直接调用还是通过 binopNode 的 right 来调用

        if(exp instanceof operatorNode){
            ssg.GenerateFlatNodes(exp)

        }else if(exp instanceof compositeCallNode){
            GraphToOperators(exp.actual_composite, ssg, unfold);

        }else if(exp instanceof splitjoinNode){
            exp.replace_composite = unfold.UnfoldSplitJoin(exp)
            GraphToOperators(exp.replace_composite, ssg, unfold)

        }else if(exp instanceof pipelineNode){
            exp.replace_composite = unfold.UnfoldPipeline(exp)
            GraphToOperators(exp.replace_composite, ssg, unfold)
        }
    }
}