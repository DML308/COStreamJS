/**
 * 执行阶段赋值, 为ssg 中的每个 flatNode 添加 stageNum 字段
 * @param { StaticStreamGraph } ssg
 * @param { Partition } mp
 * @returns { number } MaxStageNum - 最大阶段号
 */
export function StageAssignment(ssg, mp) {
    //第一步根据SDF图的输入边得到拓扑序列，并打印输出
    let topologic = actorTopologicalorder(ssg.flatNodes);
    debugger
    //第二步根据以上步骤的节点划分结果，得到阶段赋值结果
    actorStageMap(mp.FlatNode2PartitionNum);
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
        if(!head){
            throw new Error("[StageAssignment.js] 算法或SDF图出错,这里 head 不应该为空")
        }
        //找到该前驱节点后,将它加入 topologic 拓扑排序序列,并从初始集合中移出
        topologic.add(head)
        flats.splice(flats.indexOf(head),1)
        
    }

    return [...topologic]
}