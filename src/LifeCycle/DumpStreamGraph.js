var dotString = ''


/**
 * 用XML文本的形式描述SDF图
 * @param { StaticStreamGraph } ssg
 * @param { Partition } mp
 * @returns { String }
 */
export function DumpStreamGraph(ssg, mp) {
    dotString = "digraph Flattend {\n"
    let isVisited = new Map()
    toBuildOutPutString(ssg.topNode, ssg,isVisited,mp);
    dotString += "\n\n}\n"
    return dotString.beautify()
}

function toBuildOutPutString(/*FlatNode*/ node,ssg, isVisited, mp) {
    isVisited.set(node, true)
    dotString += MyVisitNode(node,ssg,mp);
    node.outFlatNodes.filter(out => !isVisited.get(out)).forEach(out => {
        toBuildOutPutString(out, ssg,isVisited, mp)
    })
}

const colors = ["aliceblue", "antiquewhite", "yellowgreen", "aquamarine",
    "azure", "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid"]

function MyVisitNode(node,ssg,mp){
    let str = `name[ label = "name \\n init Mult: initMult steady Mult: steadyMult \\n init work: initWork steady work:steadyWork \\n  PPP \\n" color="azure" style="filled"  ]\n\n`
    str = str.replace(/name/g,node.name)
    str = str.replace(/initMult/,node.initCount)
    str = str.replace(/steadyMult/, node.steadyCount)
    str = str.replace(/initWork/, ssg.mapInitWork2FlatNode.get(node))
    str = str.replace(/steadyWork/, ssg.mapSteadyWork2FlatNode.get(node))

    let peek = node.inPeekWeights.map(w => " peek: "+w)
    let pop  = node.inPopWeights.map(w => " pop: " + w)
    let push = node.outPushWeights.map(w => " push: " + w)
    let ppp = [peek,pop,push].filter(s=>s.length>0).join('\\n')
    str = str.replace(/PPP/,ppp)

    if(mp){
        throw new Error("上色代码还没写")
    }

    //链接输出边
    node.outFlatNodes.forEach((out,idx) =>{
        str += node.name + '->' + out.name + `[label="${node.outPushWeights[idx]}"];\n\n`;
    })
    return str
}