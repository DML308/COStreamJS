import { COStreamJS } from "../FrontEnd/global"
/**
 * 执行阶段赋值, 为ssg 中的每个 flatNode 添加 stageNum 字段
 * @param { StaticStreamGraph } ssg
 * @param { Partition } mp
 * @returns { number } MaxStageNum - 最大阶段号
 */
export function StageAssignment(ssg, mp) {
    //第一步根据SDF图的输入边得到拓扑序列，并打印输出
    COStreamJS.topologic = actorTopologicalorder(ssg.flatNodes);
    //第二步根据以上步骤的节点划分结果，得到阶段赋值结果
    return actorStageMap(mp.FlatNode2PartitionNum, COStreamJS.topologic);
}

/**
 * 拓扑排序算法, 输入一组 flatNode 的 list, 在不改变其中数据的情况下, 返回拓扑排序后的 list
 */
export function actorTopologicalorder(flatNodes) {
    let flats = flatNodes.slice()   //初始 flatNode 集合
    let topologic = new Set() //拓扑排序集合, 使用 Set 是为了判断 has 的时候更快

    while (flats.length) {
        //寻找没有前驱的节点(入度为0, 或它的上端节点都已经被拓扑过了)
        let head = flats.find(flat => {
            return flat.inFlatNodes.length == 0 ||
                flat.inFlatNodes.every(src => topologic.has(src))
        })
        if (!head) {
            throw new Error("[StageAssignment.js] 算法或SDF图出错,这里 head 不应该为空")
        }
        //找到该前驱节点后,将它加入 topologic 拓扑排序序列,并从初始集合中移出
        topologic.add(head)
        flats.splice(flats.indexOf(head), 1)

    }

    return [...topologic]
}

/**
 * 根据拓扑排序结果、获得阶段赋值结果
 * 若节点和其输入节点在一个划分子图，则其阶段号一致; 否则阶段号=上端最大阶段号+1
 * @param { map<FlatNode,int> } map - mp.FlatNode2PartitionNum
 */
export function actorStageMap(map, topologic) {
    topologic.forEach(flat => {
        //判断该节点是否和其输入节点都在一个划分子图
        const isInSameSubGraph = flat.inFlatNodes.every(src => map.get(src) == map.get(flat))

        //获取它的入节点的最大阶段号
        const maxstage = flat.inFlatNodes.length > 0 ? Math.max(...flat.inFlatNodes.map(f => f.stageNum)) : 0

        //如果有上端和自己不在同一子图的话,就要让阶段号+1
        flat.stageNum = isInSameSubGraph ? maxstage : maxstage + 1
    })

    //返回总共有几个阶段, 例如阶段号分别是0,1,2,3,那么要返回一共有"4"个阶段
    return topologic[topologic.length-1].stageNum + 1
}