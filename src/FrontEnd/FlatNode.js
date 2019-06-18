import { operatorNode } from "../ast/node"

export class FlatNode {
    constructor(/** @type {operatorNode} */ node) {
        this.name = node.operName       // opeator名字
        this.PreName = node.operName    // cwb记录Operator被重命名前的名字
        this.visitTimes = 0             // 表示该结点是否已经被访问过,与dumpdot有关

        /** @type {operatorNode} 指向operator(经常量传播后的) */
        this.contents = node
        // 指向原始operator
        this.oldContents = node

        this.nOut = 0 // 输 出 边个数
        this.nIn = 0  // 输 入 边个数

        //两级划分算法中,actor所在的place号、thread号、thread中的序列号
        this.place_id = 0;
        this.thread_id = 0
        this.post_thread_id = 0;
        this.serial_id = 0;

        //节点work函数的静态工作量
        this.work_estimate = 0
        // opeator在ssg的flatnodes中的顺序编号
        this.num = 0

        /** @type {FlatNode[]} 输出边各operator */
        this.outFlatNodes = []  
        /** @type {FlatNode[]} 输入边各operator */
        this.inFlatNodes = []

        /** @type {number[]} */
        this.outPushWeights = [] // 输 出 边各权重
        this.inPopWeights = []   // 输 入 边各权重
        this.inPeekWeights = []  // 输 入 边各权重

        /** @type {string[]} */
        this.outPushString = []
        this.inPopString = []
        this.inPeekString = []

        /** init调度次数 */
        this.initCount = 0
        /** 稳态调度次数 */
        this.steadyCount = 0
        /** 阶段号 */
        this.stageNum = 0
    }

    AddOutEdges(/*FlatNode */ dest) {
        this.outFlatNodes.push(dest)
        this.nOut++
    }
    AddInEdges(/*FlatNode */ src) {
        this.inFlatNodes.push(src)
        this.nIn++
    }
    // 访问该结点
    VisitNode() {
        this.visitTimes++
    }
    ResetVisitTimes() {
        this.visitTimes = 0
    }

}
