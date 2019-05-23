import { FlatNode } from "./FlatNode";

export class StaticStreamGraph {
    constructor() {
        this.topNode = null // SDF图的起始节点，假设只有一个输入为0的节点

        //@type {FlatNode[]} 静态数据流图所有节点集合
        this.flatNodes = []

        // map < string, FlatNode *> mapEdge2UpFlatNode; // 将有向边与其上端绑定
        this.mapEdge2UpFlatNode = new Map()
        // map < string, FlatNode *> mapEdge2DownFlatNode; //将有向边与其下端绑定
        this.mapEdge2DownFlatNode = new Map()

        // map < FlatNode *, int > mapSteadyWork2FlatNode;  // 存放各个operator的workestimate（稳态工作量估计)
        this.mapSteadyWork2FlatNode = new Map()

        //map < FlatNode *, int > mapInitWork2FlatNode;    // 存放各个operator的workestimate（初态）
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
 * 标记 out 的 up 指向 flat, 同时标记 in 的 down 指向 flat,
 * 如果 in 是由 parent 产生的, 则 parent 指向 flat
 */
StaticStreamGraph.prototype.GenerateFlatNodes = function (/* operatorNode* */ u) {

    const flat = new FlatNode(u)

    /* 寻找输出流  建立节点的输入输出流关系
     * 例如 out = call(in) 对 edgeName:out 来说, call 是它的"上端"节点, 所以插入 mapEdge2UpFlatNode */
    if (u.outputs) u.outputs.forEach(edgeName => this.mapEdge2UpFlatNode.set(edgeName, flat))

    this.flatNodes.push(flat)

    /* 例如 out = call(in), 对 in 来说, call 是它的"下端"节点, 所以插入 mapEdge2DownFlatNode */
    if (u.inputs) {
        u.inputs.forEach(inEdgeName => {
            this.mapEdge2DownFlatNode.set(inEdgeName, flat)

            /* 同时还要找找看 in 是由哪个 operator 输出的, 如果找得到则建立连接*/
            if (this.mapEdge2UpFlatNode.has(inEdgeName)) {
                var parent = this.mapEdge2UpFlatNode.get(inEdgeName)
                parent.AddOutEdges(flat)
                flat.AddInEdges(flat)
            }
        })
    }
}


/**
 * 设置 flatNode 的边的 weight
 * @eaxmple
 * window{
 *   In  sliding(1,2); //则分别设置inPeekWeights 为1, inPopWeights 为2
 *   Out tumbling(2);  //设置 outPushWeights 为2
 * }
 */
StaticStreamGraph.prototype.SetFlatNodesWeights = function () {
    for (let flat of this.flatNodes) {
        let oper = flat.contents
        let win_stmts = oper.operBody.win
        for(let it of win_stmts){
            let edgeName = it.winName
            if(it.type === "sliding"){
                flat.inPeekString.push(edgeName)
                flat.inPopString.push(edgeName)
                flat.inPeekWeights.push(it.arg_list[0].value)
                flat.inPopWeights.push(it.arg_list[1].value)
            }else if(it.type === "tumbling"){
                flat.outPushString.push(edgeName)
                flat.outPushWeights.push(it.arg_list[0].value)
            }
        }
    }
}