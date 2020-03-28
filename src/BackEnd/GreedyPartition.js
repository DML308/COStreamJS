import { Partition } from "./Partition"
export class GreedyPartition extends Partition {
    constructor() {
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
    setCpuCoreNum(num) {
        this.mnparts = num
        this.X = Array.from({ length: num }).map(_ => []) // 初始化一个二维数组(先创建一个长度为 num 的一维数组, 再将每个位置映射为一个新数组)
        this.w = Array.from({ length: num }).fill(0)
    }
}

/**
 * 执行划分算法, 统计 ssg 中 flatNode 的工作量,作初始划分, 并计算通信量等数据, 最终将划分结果存入 this.X 中
 * @param { StaticStreamGraph } ssg
 */
GreedyPartition.prototype.SssgPartition = function (ssg) {
    if (this.mnparts == 1) {
        this.X = [ssg.flatNodes] // 此时 X 的长度为1, 下标0对应了全部的 flatNodes
        this.finalParts = 1
    } else {
        this.nvtxs = ssg.flatNodes.length
        this.setActorWorkload(ssg)
        this.doPartition(ssg)
        this.orderPartitionResult()
    }
    //将 X 的信息保存至 Partion 基类的两个 map 中
    this.X.forEach((flatNodes, coreNum) => {
        flatNodes.forEach(flat => {
            this.FlatNode2PartitionNum.set(flat, coreNum)
        })
        this.PartitonNum2FlatNode.set(coreNum, flatNodes)
    })
}
/**
 * 设置每个节点的权重(实际上对每个节点: 权重 = 工作量*调度次数)
 */
GreedyPartition.prototype.setActorWorkload = function (ssg) {
    ssg.flatNodes.forEach((flat, idx) => {
        this.vwgt[idx] = flat.steadyCount * ssg.mapSteadyWork2FlatNode.get(flat)
        flat.vwgt = this.vwgt[idx]
        this.totalWork += this.vwgt[idx]
    })
}
/**
 * 正式的划分过程
 */
GreedyPartition.prototype.doPartition = function (ssg) {
    this.X[0] = ssg.flatNodes.slice() //首先划分全部点到0号核上
    let we = this.totalWork / this.mnparts //每个子图平均工作量
    let e = 2 - this.ee                //满足系数（2-ee）即可 
    this.w[0] = this.totalWork

    for (let i = 1; i < this.mnparts; i++) {
        //开始构造子图 X[1] ~ X[n-1]
        this.S.length = 0
        while (this.w[i] < we * e && this.X[0].length > 0) {
            if (this.S.length === 0) {
                //如果候选集合为空,选择X[0]中顶点权重最大的节点
                var chooseFlat = this.X[0].reduce((a, b) => a.vwgt >= b.vwgt ? a : b)
            } else {
                //如果候选集合 S 不为空, 则选择 S 中收益函数值最大的节点
                var chooseFlat = this.chooseMaxGain(this.X[i])
                this.S.splice(this.S.indexOf(chooseFlat), 1) //从 S 中删除
            }
            this.w[0] -= chooseFlat.vwgt
            this.X[0].splice(this.X[0].indexOf(chooseFlat), 1)
            this.X[i].push(chooseFlat)  //将该节点加入 X[i]子图
            this.w[i] += chooseFlat.vwgt //维护 X[i]子图的工作量
            this.updateCandidate(ssg, chooseFlat)
        }
    }
}

/**
 * 移动一个节点后更新 候选节点集合S.
 * @summary 遍历chooseFlat 的所有上端节点&&下端节点, 如果该节点 在X[0]中 && 不在 S 中,则将它加入 S
 * @param { FlatNode } chooseFlat
 */
GreedyPartition.prototype.updateCandidate = function (ssg, chooseFlat) {
    let srcs = chooseFlat.inFlatNodes.filter(flat => this.X[0].includes(flat) && !this.S.includes(flat))
    let dests = chooseFlat.outFlatNodes.filter(flat => this.X[0].includes(flat) && !this.S.includes(flat))
    this.S = this.S.concat(srcs, dests)
}

/**
 * 选择 S 中增益函数最大的节点
 * @description 增益函数 : 用 increase 表示减少与 Xi 子图通信带来的增益 ,
 *                        用 decrease 表示增加与 X[0] 的通信来带的损失,
 *                        则 increase - decrease 就是增益函数
 */
GreedyPartition.prototype.chooseMaxGain = function (Xi) {
    let gains = []
    for (let i in this.S) {
        let flat = this.S[i]
        let increase = 0, decrease = 0

        flat.inFlatNodes.forEach((src, idx) => {
            if (this.X[0].includes(src)) decrease += flat.steadyCount * flat.inPopWeights[idx]
            if (Xi.includes(src)) increase += flat.steadyCount * flat.inPopWeights[idx]
        })
        flat.outFlatNodes.forEach((out, idx) => {
            if (this.X[0].includes(out)) decrease += flat.steadyCount * flat.outPushWeights[idx]
            if (Xi.includes(out)) increase += flat.steadyCount * flat.outPushWeights[idx]
        })
        gains[i] = increase - decrease
    }
    let max = gains.indexOf(Math.max(...gains))
    return this.S[max]
}

/**
 * 按子图负载由大到小排序,选择排序算法
 */
GreedyPartition.prototype.orderPartitionResult = function () {
    this.X.forEach((flats, idx) => flats.w = this.w[idx])
    this.X.sort((a, b) => b.w - a.w)
    this.w.sort((a, b) => b - a)
    this.X = this.X.filter(flats => flats.length != 0) //过滤掉不含节点的子图
    this.X.forEach(flats=>flats.sort((a,b)=>a.name.match(/\d+/)[0] - b.name.match(/\d+/)[0])) //对一个子图按照名字序号升序排序
    this.finalParts = this.X.length
}