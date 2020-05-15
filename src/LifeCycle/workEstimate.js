
import { expNode, unaryNode, binopNode, ternaryNode, parenNode, callNode, fileReaderNode } from "../ast/node.js"
import { error } from "../utils"
import { fileWriterNode } from "../ast/node.js";

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
        var w_init = 0
        /**
         * 注: 鉴于现在 COStream 的工作量估计极其不准确的事实, COStreamJS 为了简单起见使用了更简单的估计策略:
         *                          取 "标识符, 运算符" 的总数量 * 10 + 窗口大小 * 20
         * 未来有更优的工作量估计策略后可替换此处代码.
         */
        if(flat.contents instanceof fileReaderNode || flat.contents instanceof fileWriterNode){
            var w_steady = flat.contents.dataLength || 100; // 对读写文件节点先随便估一个工作量
        }else{
            var w_steady = (body.work + ';').match(/\w+|[-+*/=<>?:;]/g).length *10 //body.work ? body.work.WorkEstimate() : 0;
        }
        w_steady += (flat.outFlatNodes.length + flat.inFlatNodes.length) * 20; //多核下调整缓冲区head和tail
        ssg.mapInitWork2FlatNode.set(flat, w_init)
        ssg.mapSteadyWork2FlatNode.set(flat, w_steady)
    }
}

