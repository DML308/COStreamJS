/**
 * 计算加速比信息, 返回一个格式化的 Object
 */
export function GetSpeedUpInfo(ssg, mp, sourceFileName = "default.cos", pSelected = "GAPartition") {
    let SpeedUpInfo = { pSelected, sourceFileName, finalParts: mp.finalParts }
    SpeedUpInfo.date = new Date().toLocaleString()

    let PartitionInfo = []
    for (var [core, communication] of mp.PartitonNum2Communication) {
        let info = {
            part: core,
            workload: mp.w[core],
            percent: (100 * mp.w[core] / mp.totalWork).toFixed(2) + '%',
            communication: communication
        }
        PartitionInfo.push(info)
    }

    let Detail = []
    ssg.flatNodes.forEach((flat, idx) => {
        let workload = ssg.mapSteadyWork2FlatNode.get(flat) * flat.steadyCount
        Detail.push({
            part: idx,
            actor: flat.name,
            workload: workload,
            percent: (workload * 100 / mp.totalWork).toFixed(2) + '%'
        })
    })

    let TotalInfo = {
        totalWorkload: mp.totalWork,
    }
    TotalInfo.totalCommunication = PartitionInfo.reduce((sum,info) => sum + info.communication, 0)
    debugger
    TotalInfo.maxWorkload = PartitionInfo.reduce((max,info) => info.workload > max.workload ? info : max).workload
    TotalInfo.maxSpeedUp = (TotalInfo.totalWorkload / TotalInfo.maxWorkload).toFixed(2)

    Object.assign(SpeedUpInfo, { PartitionInfo, Detail, TotalInfo })
    return SpeedUpInfo
}
/**
 * 输入一个加速比信息的 Object, 返回它的格式化字符串
 */
export function PrintSpeedUpInfo(SpeedUpInfo) {
    if (!SpeedUpInfo) console.warn("SpeedUpInfo 为空")

    let header =`---------------------default.cos - GAPartition(4) DATE ---------------------\n`
    header = header.replace("default.cos", SpeedUpInfo.sourceFileName)
    header = header.replace("GAPartition", SpeedUpInfo.pSelected)
    header = header.replace("4", SpeedUpInfo.finalParts)
    header = header.replace("DATE", SpeedUpInfo.date)

    let partitionStr =
        `#######################  Partition info  ##########################
part            workload             percent      communication\n`
    SpeedUpInfo.PartitionInfo.forEach(info=>{
        let line = info.part + setw(info.workload,23) + setw(info.percent,19)
        line += setw(info.communication,20)
        partitionStr += line +'\n'
    })

    let detailStr = `######################## Detail ###################################
part               actor             workload           percent\n`
    SpeedUpInfo.Detail.forEach(info=>{
        let line = info.part + setw(info.actor, 23) + setw(info.workload, 19)
        line += setw(info.percent, 20)
        detailStr += line + '\n'
    })

    let totalStr = `##################### total info ###############################\n`
    for(let key in SpeedUpInfo.TotalInfo){
        totalStr += key.padEnd(20) + '=    ' + SpeedUpInfo.TotalInfo[key] + '\n'
    }

    return header+ partitionStr + '\n' + detailStr + '\n' + totalStr
}

/**
 * 在字符串 str 左边填充空格使得整个字符串具有 num 指定的长度
 */
function setw(str = '', num = 20) {
    str = str + ''
    if (str.length > num) {
        console.warn("[ComputeSpeedUp.js] setw 的 str 字符串较长, 影响排版")
        console.trace()
    }
    return str.padStart(num)
}