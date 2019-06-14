
import { expNode, unaryNode, binopNode, ternaryNode, parenNode, callNode, arrayNode } from "../ast/node.js"
import { error } from "../utils"

/**
 * 对 ssg 中的 flatNode 进行工作量估计
 * @param {StaticStreamGraph} ssg
 */
export function WorkEstimate(ssg)
{
    for (let flat of ssg.flatNodes)
    {
        /* 检查每一个operatorNode的body（包括init，work和window)*/
        var body = flat.contents.operBody;
        var w_init = 0//body.init ? body.init.WorkEstimate(): 0 ;
        var w_steady = (body.work + '').match(/\w+|[-+*/=<>?:]/g).length *10 //body.work ? body.work.WorkEstimate() : 0;
        w_steady += (flat.outFlatNodes.length + flat.inFlatNodes.length) * 20; //多核下调整缓冲区head和tail
        ssg.mapInitWork2FlatNode.set(flat, w_init)
        ssg.mapSteadyWork2FlatNode.set(flat, w_steady)
    }
}

