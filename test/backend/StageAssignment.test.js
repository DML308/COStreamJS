import { actorTopologicalorder } from "../../src/BackEnd/StageAssignment"
const assert = require('assert')

describe("测试 StageAssignment 内的函数",()=>{
    it("测试拓扑排序算法,随机生成100个点和1000条边,要求拓扑排序结果正确", () => {
        const EdgeNum = 1000, NodeNum = 100
        //生成随机的节点集合
        let flats = Array.from({ length: NodeNum }).map((_, idx) => ({
            name: randomName() + '_' + idx,
            inFlatNodes: []
        }))
        //随机的单项连接这些节点, 避免出现环路
        for (let i = 0; i < EdgeNum; i++) {
            let index = Math.random() * (NodeNum-1)+1 | 0
            let left = Math.random() * (index - 1) | 0
            //链接 left -> index
            flats[index].inFlatNodes.push(flats[left])
        }
        //console.log(flats)
        //执行拓扑排序
        let topos = actorTopologicalorder(flats)
        /**
         * 验证拓扑排序结果: 从源头起,要求访问 node 时该 node 的 inFlatNodes 全部已经访问过
         * 举个形象的例子: 执行"出门"操作前, 要求准备工作"洗脸,刷牙,穿衣"工作全部完成
         */
        let visited = new Set()
        topos.forEach(flat => {
            assert(flat.inFlatNodes.every(src => visited.has(src)))
            visited.add(flat)
        })
    })
})

function randomName() {
    let smallStrs = 'aeiou'.split('')
    let BigStrs = 'KSTLRMHYW'.split('')

    return randomChar(BigStrs) + randomChar(smallStrs)
        + randomChar(BigStrs).toLowerCase() + randomChar(smallStrs)

    function randomChar(arr) {
        return arr[Math.random() * arr.length | 0]
    }
}