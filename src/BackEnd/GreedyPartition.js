import { Partition } from "./Partition"
export class GreedyPartition extends Partition {
    constructor(ssg) {
        super()

        /** @type { vector<vector<FlatNode *>> }  划分的结果 */
        this.X = []

        /** @type { number[] } 划分的K个子图每个子图的总工作量 */
        this.w = []

        /** @type { number[] } 划分的K个子图每个子图的通信边的权重 */
        this.edge = [];

        /** @type { number[] } 每个顶点的权重(总工作量) */
        this.vwgt = [];

        /** @type { FlatNode[] } 候选节点的集合 */
        this.S = [];

        /** @type { number } 节点的个数 */
        this.nvtxs = 0

        /** @type { number } 平衡因子 */
        this.ee = 1.1

        /** @type { Map<FlatNode,string> } 每个节点对应的状态 */
        this.FlatNodeToState = new Map()
    }
    /**
     * 输入一个 flat, 返回该 flat 被 GAP 划分到的核号
     */
    getPart(flat) {
        return this.X.findIndex(nodes => nodes.includes(flat))
    }
    /**
     * 输入 i, 返回 i 号子图的总工作量
     */
    getPartWeight(i) {
        return this.w[i]
    }
    /**
     * 输入 i,返回 i 号子图总通信量
     */
    getPartEdge(i) { 
        return this.edge[i] 
    }
}