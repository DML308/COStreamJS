import { FlatNode } from "./FlatNode";
import { top } from "./generateSymbolTables"
import { error } from "../utils";
import { fileReaderNode } from "../ast/node";
import { fileWriterNode } from "../ast/node";

export class StaticStreamGraph {
    constructor() {
        /** @type {FlatNode} SDF图的起始节点，假设只有一个输入为0的节点 */
        this.topNode = null 

        /** @type {FlatNode[]} 静态数据流图所有节点集合 */
        this.flatNodes = []

        /** @type {Map<string, FlatNode>} 将有向边与其上端绑定*/   
        this.mapEdge2UpFlatNode = new Map()
        /** @type {Map<string, FlatNode>}将有向边与其下端绑定*/   
        this.mapEdge2DownFlatNode = new Map()

        /** @type {Map<FlatNode,number>}  存放各个operator的workestimate（稳态工作量估计) */
        this.mapSteadyWork2FlatNode = new Map()

        /** @type {Ma<FlatNode,number>}    存放各个operator的workestimate初态）*/
        this.mapInitWork2FlatNode = new Map()

    };

    //给静态数据流图中所有的 FlatNode 加上数字后缀来表达顺序, 如 Source => Source_0
    ResetFlatNodeNames() {
        this.flatNodes.forEach((flat, idx) => flat.name = flat.name + '_' + idx)
    }

    /*重置ssg结点flatnodes内所有flatnode内的visitimes*/
    ResetFlatNodeVisitTimes() {
        this.flatNodes.forEach(flat => flat.ResetVisitTimes())
    }

    AddSteadyWork(/*FlatNode * */flat, work) {
        this.mapSteadyWork2FlatNode.set(flat, work);
    }
    // 存放初态调度工作量
    AddInitWork(flat, work) {
        this.mapInitWork2FlatNode.set(flat, work);
    }
}

/**
 * 创建一个新的 FlatNode, 例如对 out = operator(in){ init work window } , 
 */
StaticStreamGraph.prototype.GenerateFlatNodes = function (/* operatorNode* */ u, param_list) {

    const flat = new FlatNode(u, param_list)
    flat._symbol_table = top

    /* 寻找输出流  建立节点的输入输出流关系
     * 例如 out = call(in) 对 edgeName:out 来说, call 是它的"来源"节点 fromFlatNode */
    if (u.outputs) u.outputs.forEach((edgeName,index) => {
        top.streamTable[edgeName].fromIndex = index
        top.streamTable[edgeName].fromFlatNode = flat
    })

    /* 例如 out = call(in), 对 in 来说, call 是它的"去向"节点 toFlatNode */
    if (u.inputs) u.inputs.forEach((edgeName,index) => {
        const stream = top.streamTable[edgeName]
        stream.toIndex = index
        stream.toFlatNode = flat
        if(stream.fromFlatNode){
            /** 下面两行代码的作用是建立 FlatNodes 之间的输入输出关系, 例如 
             *     (S0, S1) = oper1()
             *     (S2) = oper2(S1)
             * 则设置 
             * oper1.outFlatNodes[1] = oper2
             * oper2.inFlatNodes[0] = oper1
             */
            stream.fromFlatNode.outFlatNodes[stream.fromIndex] = flat
            flat.inFlatNodes[index] = stream.fromFlatNode
        }else{
            error(u._loc, `流 ${edgeName} 没有上层计算节点, 请检查`)
        }
        
    })

    this.flatNodes.push(flat)

    // 下面 设置 flatNode 的边的 weight
    if(u instanceof fileReaderNode){
        flat.outPushWeights[0] = u.dataLength
    }else if(u instanceof fileWriterNode){
        flat.inPeekWeights[0] = u.dataLength
        flat.inPopWeights[0] = u.dataLength
    }else{
        let win_stmts = u.operBody.win
        for(let it of win_stmts){
            if(it.type === "sliding"){
                flat.inPeekWeights.push(it.arg_list[0].value)
                flat.inPopWeights.push(it.arg_list[1].value)
            }else if(it.type === "tumbling"){
                flat.outPushWeights.push(it.arg_list[0].value)
            }
        }
    }
}
