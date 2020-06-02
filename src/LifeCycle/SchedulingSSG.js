
import { debug, error } from "../utils"
/**
 * 数据流图调度
 * @param {StaticStreamGraph} - ssg
 */
export function ShedulingSSG(ssg){
    InitScheduling(ssg)
    SteadyScheduling(ssg)
    debug("---稳态调度序列---\n")
    console.log(ssg.flatNodes.map(n=>({ name: n.name, steadyCount: n.steadyCount})))
}
function InitScheduling(ssg){
    ssg.flatNodes.forEach(n => n.initCount = 0)
}
function SteadyScheduling(ssg){
    // 默认第一个节点是源，也就是说peek和pop均为0,在图的表示上暂不允许有多个源，但可以有多个peek = pop = 0节点
    var up = ssg.topNode, down , flats = [up]
    up.steadyCount = 1
    //BFS 遍历 ssg.flatNodes
    while(flats.length !== 0){
        up = flats.shift()  
        for(let i = 0 ;i < up.outFlatNodes.length; i++){
            let nPush = up.outPushWeights[i]    // 上端节点的push值
            down = up.outFlatNodes[i]           // 找到下端节点
            let j = down.inFlatNodes.indexOf(up)    // 下端节点找到与上端节点对应的标号
            let nPop = down.inPopWeights[j]     // 下端节点取出对应的pop值

            // 检查down节点是否已进行稳态调度
            if( !down.steadyCount ){
                //若 down 之前未调度过
                let x = up.steadyCount
                nPush *= x
                if(nPush !== 0){
                    let scale = lcm(nPush,nPop) / nPush //放大倍数
                    ssg.flatNodes.forEach(n=>{
                        if(n.steadyCount) n.steadyCount *= scale
                    })
                    down.steadyCount = lcm(nPush, nPop) / nPop
                }else{
                    throw new Error("一般的 up 节点的 push 值不会为0")
                }
            }else{
                //若 down 节点已进行稳态调度，检查SDF图是否存在稳态调度系列，一般不存在的话表明程序有误
                if(nPush * up.steadyCount !== nPop * down.steadyCount){
                    throw new Error(error("调度算法出错, 请检查"))
                }
            }
            flats.push(down)
        }
    }
}

//求a,b的最大公约数
function gcd(a,b){
    return b ? gcd(b, a%b ) : a
}
//求a,b的最小公倍数
function lcm(a,b){
    return a*b / gcd(a,b)
}