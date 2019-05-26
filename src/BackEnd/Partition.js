/**
 * SDF 图划分算法的基类, 子类需要继承此类并实现对应方法
 */
export class Partition {
    constructor() {
        /** @type {map<FlatNode,number>} 节点到划分编号的映射 */
        this.FlatNode2PartitionNum = new Map()

        /** @type {map<number,FlatNode[]>} 划分编号到节点集合的映射 */
        this.PartitonNum2FlatNode = new Map()

        /** @type {map<number, number>} 划分编号到通信量的映射 */
        this.PartitonNum2Communication = new Map()

        /** @type {number} 核数 */
        this.mnparts = 1

        /** @type {number} 最终划分的份数,因为划分算法的极端情况下可能用不完全部的核 */
        this.finalParts = 0

        /** @type { number } 总工作量 */
        this.totalWork = 0
    }
    /**
     * 划分成员方法，具体实现由子类实现
     */
    SssgPartition(ssg, level) {
        throw new Error("不能调用基类的 SssgPartition 算法, 请在子类中实现该算法")
    }
    /**
     * 根据flatnode找到其下标号 如source_0中的0
     */
    findID(/* FlatNode */ flat) {
        return flat.name.match(/\d+$/g)[0]
    }
    /**
     * 根据编号num查找其中的节点，将节点集合返回给PartitonNumSet(编号->节点)
     */
    findNodeSetInPartition(num) {
        return this.PartitonNum2FlatNode.get(num)
    }
    /**
     * 根据节点返回其所在划分区的编号(节点->编号) for dot
     */
    findPartitionNumForFlatNode(/* FlatNode */ flat) {
        return this.FlatNode2PartitionNum.get(flat)
    }
    /**
     * 划分完毕后计算通信量
     */
    computeCommunication() {
        for (let [core, Xi] of this.PartitonNum2FlatNode) {
            let communication = 0
            for (let flat of Xi) {
                //如果flat的上端节点不在此Xi中则累计通信量
                flat.inFlatNodes.forEach((src, idx) => {
                    if (!Xi.includes(src)) {
                        communication += flat.inPopWeights[idx] * flat.steadyCount
                    }
                })
                //如果flat的下端节点不在此Xi中则累计通信量
                flat.outFlatNodes.forEach((out, idx) => {
                    if (!Xi.includes(out)) {
                        communication += flat.outPushWeights[idx] * flat.steadyCount
                    }
                })
            }
            //将该子图的通信量保存下来
            this.PartitonNum2Communication.set(core, communication)
        }
    }
};