import { deepCloneWithoutCircle } from "../utils"
import { compositeCall_list, COStreamJS } from "./global"
import { addNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode, compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode, declarator, idNode } from "../ast/node";
import { matrix_section } from "../ast/node";
import { matrix_slice_pair } from "../ast/node";
export class UnfoldComposite {
    constructor() {
        this.num = 0
    }
    /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
    MakeCompositeName(/*string*/ name) {
        return name + "_" + this.num++;
    }
}
export var unfold = new UnfoldComposite()

/**
 * @description 对于composite节点内的operatorNode进行流替换
 * 只替换第一个和最后一个oper 的原因是: 对第一个修改 IN, 对最后一个修改 Out, 对简单串行的 comp 是没问题的
 * @param {compositeNode} comp
 * @param {void|string[]} inputs
 * @param {void|string[]} outputs
 * @param { bool } flag - flag 为1则同时替换内部的 work 和 win 的 stream 变量名, 为0则说明之前已调用过 modifyStreamName
 * @example
 * 例如对于 
 * composite SecondSource(input Source,output S0){
 *    Out = AssignmentX(In){ }
 * }
 * 将其替换为
 * composite SecondSource(input Source,output S0){
 *    S0 = AssignmentX(Source){ }
 * }
 */
UnfoldComposite.prototype.streamReplace = function (comp,inputs, outputs, flag) {
    let stmt_list = comp.body.stmt_list
    inputs.length && operatorStreamReplace(stmt_list[0], inputs, 'inputs')
    outputs.length && operatorStreamReplace(stmt_list[stmt_list.length - 1], outputs, 'outputs')
    return comp

    function operatorStreamReplace(stmt, streamNames, tag) {
        let oper = stmt instanceof binopNode ? stmt.right : stmt
        if (oper instanceof operatorNode) {
            if (flag) {
                UnfoldComposite.prototype.modifyStreamName(oper, streamNames, tag=="inputs")
            }
            oper[tag] = streamNames
        } else if (oper instanceof splitjoinNode || oper instanceof pipelineNode) {
            oper[tag] = streamNames
        }
    }
}

/**
 * 用于splitjoin或者pipeline中展开流的替换，这些compositeCall可以指向相同的init，work
 * FIXME: 这个函数假设被 add 的 composite 中的第一个 binop operator 为有效 operator, 实际上这种假设并不严谨,容易被测试出BUG
 */
UnfoldComposite.prototype.compositeCallStreamReplace = function (/*compositeNode **/ comp, inputs, outputs) {
    let copy
    let inout = new ComInOutNode(null, inputs, outputs)
    let head = new compHeadNode(null, comp.compName, inout)

    for (let it of comp.body.stmt_list) {
        if (it instanceof binopNode) {
            let exp = it.right
            if (exp instanceof operatorNode) {
                let oper = getCopyOperInStreamReplace(exp, inputs, outputs)
                let comp_body = new compBodyNode(null, null, [oper])
                copy = new compositeNode(null, head, comp_body)
            } else if (exp instanceof pipelineNode || exp instanceof splitjoinNode) {
                copy = comp
            }
        } else {
            throw new Error("未定义的分支. 前面假设 pipeline 中 add call()的 call 只有 binop 节点是否太片面了")
        }
    }
    this.streamReplace(copy, inputs, outputs, 0)
    return copy


    function getCopyOperInStreamReplace(exp, inputs, outputs) {
        /* 除了window都可以指向一块内存 对于window动态分配一块内存，替换window中的名字，再函数的结尾将流进行替换*/
        let work = deepCloneWithoutCircle(exp.operBody.work);
        /*动态分配生成新的windowNode*/
        let win = []
        for (let win_stmt of exp.operBody.win) {
            let stmt = new winStmtNode(null, win_stmt.winName, {
                type: win_stmt.type,
                arg_list: win_stmt.arg_list
            })
            win.push(stmt)
        }
        let body = new operBodyNode(null, exp.operBody.stmt_list, exp.operBody.init, work, win)
        let oper = new operatorNode(null, exp.operName, exp.inputs, body)
        oper.outputs = exp.outputs
        UnfoldComposite.prototype.modifyStreamName(oper, inputs, true);
        UnfoldComposite.prototype.modifyStreamName(oper, outputs, false);
        return oper
    }
}

/**
 * 对oper进行修改: 用输入的 stream 流名来替换 work 和 win 中对应的流名
 * @param {boolean} style -标识输入流还是输出流,true: 输入流, false: 输出流
 * @description FIXME 与杨飞的 modifyStreamName 不一致: 因为这里的 work 简化为了字符串, 所以直接进行了字符串替换. win 的处理基本一致
 */
UnfoldComposite.prototype.modifyStreamName = function (/*operatorNode **/ oper, stream, style) {
    var newName = stream[0]
    var oldName = style ? oper.inputs[0] : oper.outputs[0]
    let reg = new RegExp(oldName, 'g')
    oper.operBody.work = (oper.operBody.work + '').replace(reg, newName)
    oper.operBody.win.forEach(winStmt => {
        if (winStmt.winName == oldName) {
            winStmt.winName = newName
        }
    })
}


UnfoldComposite.prototype.UnfoldPipeline = function (/* pipelineNode */ node) {
    compositeCallFlow(node.body_stmts)
    let compName = this.MakeCompositeName("pipeline")
    let inout = new ComInOutNode(null, node.inputs, node.outputs)
    let head = new compHeadNode(null, compName, inout)
    let stmt_list = generateBodyStmts()
    let body = new compBodyNode(null, null, stmt_list)
    let pipeline = new compositeNode(null, head, body)
    compositeCall_list.length = 0 //清空该数组
    return pipeline

    /**
     * 对于如下形式的 pipeline
     * out = pipeline(in) { 
     *   add A(); 
     *   add B(); 
     *   add C();
     * } 
     * 我们要生成的 stmt_list 的格式为{
     *   //stream<type x>S0_0,S0_1; 理想状态这里应该生成一个 strdcl 语句, 但实际上并没生成
     *   S0_0 = A(in);
     *   S0_1 = B(S0_0);
     *   out= C(S0_1);
     * }
     */
    function generateBodyStmts() {
        let result = []
        for (let i = 0; i < compositeCall_list.length; i++) {
            let inputs = i == 0 ? node.inputs : [compName + '_' + (i - 1)]
            let outputs = i != compositeCall_list.length - 1 ? [compName + '_' + i] : node.outputs

            let compCall = compositeCall_list[i]
            let call = new compositeCallNode(null, compCall.compName, inputs)
            call.outputs = outputs
            //TODO: 符号表修改后要修改对应的这个地方
            let comp = COStreamJS.S.LookUpCompositeSymbol(compCall.compName);
            comp = deepCloneWithoutCircle(comp) //对 compositeNode 执行一次 copy 来避免静态流变量名替换时的重复写入
            call.actual_composite = UnfoldComposite.prototype.compositeCallStreamReplace(comp, inputs, outputs)

            let binop = new binopNode(null, outputs, '=', call)
            result.push(binop)
        }
        return result
    }

}

/**
 *  遍历splitjoin/pipeline结构中的statement，将compositecallNode加入到compositeCall_list中
 */
function compositeCallFlow(/*list<Node *> */ stmts) {
    if (!stmts || stmts.length == 0) throw new Error("compositeCallFlow Error")
    stmts.forEach(stmt => {
        stmt instanceof addNode ? handlerAdd(stmt) : '';
        stmt instanceof forNode ? handlerFor(stmt) : '';
    })
    return

    function handlerAdd(add) {
        if (add.content instanceof compositeCallNode) {
            compositeCall_list.push(add.content)

        } else if (add.content instanceof splitjoinNode || add.content instanceof pipelineNode) {
            let copy = deepCloneWithoutCircle(add.content)
            compositeCall_list.push(copy)
        }
    }
    /**
     * 对一个静态 for 循环做循环展开, 目前没有符号表, 所以只考虑如下简单例子
     * for(j= 1;j<10;i+=2) //对该例子会将其内部语句展开5次
     * @warning 得益于 js 的字符串转函数能力, 我们能以一种 hacker 的方式来获取循环次数. 而 C++ 中的做法并非如此
     */
    function handlerFor(for_stmt) {
        /*获得for循环中的init，cond和next值 目前只处理for循环中数据是整型的情况 */
        let forStr = for_stmt.toString()
        forStr.match(/([^\{]*)\{/)
        forStr = RegExp.$1
        let evalStr = `
            var count = 0;
            ${forStr}{
                count++
            }
            return count` ;
        let count = (new Function(evalStr))()  //得到了 for 循环的实际执行次数
        //现在需要展开循环的次数 count 和展开循环的循环体都已准备好, 则递归调用.
        for (let i = 0; i < count; i++) {
            compositeCallFlow(for_stmt.statement.stmt_list)
        }
    }
}

/**
 * @param {splitjoinNode} node - 待展开的 splitjoinNode
 * @returns {compositeNode} 展开完成的 actual_composite
 */
UnfoldComposite.prototype.UnfoldSplitJoin = function (node) {
    let compName = this.MakeCompositeName("splitjoin");
    compositeCallFlow(node.body_stmts);
    let inout = new ComInOutNode(null, node.inputs, node.outputs)
    let head = new compHeadNode(null, compName, inout)

    var stmt_list = this.generateDuplicateOrRoundrobinBodyStmts(compName, node, node.split.type);

    let body = new compBodyNode(null, null, stmt_list)
    let actual_composite = new compositeNode(null, head, body)
    compositeCall_list.length = 0;
    return actual_composite
}

/**
 * 对于如下形式的 split duplicateOrRoundrobin
 * split duplicateOrRoundrobin();
 *   add A();
 *   add B();
 *   add pipeline();
 * join  roundrobin();
 * 我们要生成的 stmt_list 的格式为{
 *   (dup_0,dup_1,dup_2) = duplicateOrRoundrobinOper(In)
 *   S0_0 = A(dup_0)
 *   S0_1 = B(dup_1)
 *   S0_2 = pipeline(dup_2)
 *   Out = join(S0_0, S0_1, S0_2)
 * }
 * @param {splitjoinNode} node
 * @returns {statement[]}
 */
UnfoldComposite.prototype.generateDuplicateOrRoundrobinBodyStmts = function (compName, node, type = "duplicate") {
    let result = []

    //0.先提前设置好流变量名
    let splitStreams = Array.from({ length: compositeCall_list.length }).map((_, idx) => compName + "_split_" + idx)
    let joinStreams = Array.from({ length: compositeCall_list.length }).map((_, idx) => compName + "_join_" + idx)

    //1.构建 duplicateOrRoundrobin  节点
    let duplicateOrRoundrobinOper = type === "duplicate"
        ? this.MakeDuplicateOperator(node.inputs, node.split.arg_list, splitStreams)
        : this.MakeRoundrobinOperator(node.inputs, node.split.arg_list, splitStreams)
    result.push(duplicateOrRoundrobinOper)

    //2.构建 body 中的对输入流的处理
    for (let i = 0; i < compositeCall_list.length; i++) {
        let it = compositeCall_list[i]

        if (it instanceof compositeCallNode) {
            let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName)
            comp = deepCloneWithoutCircle(comp) //对 compositeNode 执行一次 copy 来避免静态流变量名替换时的重复写入
            let call = new compositeCallNode(null, it.compName, [splitStreams[i]], null)
            call.outputs = joinStreams[i]
            call.actual_composite = this.compositeCallStreamReplace(comp, [splitStreams[i]], [joinStreams[i]])
            result.push(call)

        } else if (it instanceof splitjoinNode || it instanceof pipelineNode) {
            /* 若为splitjoin或者pipeline结构，赋予其输入和输出流 */
            /* NOTE: 这里的it 可能都为 splitjoinNode, 但是它们在 handlerAdd 中被 clone 过,所以不会有 重赋值 的问题 */
            it.inputs = [splitStreams[i]]
            it.outputs = [joinStreams[i]]
            result.push(it)
        }
    }
    //3.构建 join 节点
    result.push(this.MakeJoinOperator(joinStreams, node.split.arg_list, node.outputs))
    return result
}


/**
 * 构建出一个真实的 roundrobin 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
 * 例如
 * roundrobin(In) {
 *   work{
 *       int i=0,j=0;
 *		 for(i=0;i<1;++i)		round2_0[i]=dup0_1[j++];
 *		 for(i=0;i<1;++i)		round2_1[i]=dup0_1[j++];
 *   }
 *   window{
 *       dup0_1 sliding(2,2);
 *       round2_0 tumbling(1);
 *       round2_1 tumbling(1);
 *   }
 * }
 * @returns {operatorNode}
 */
UnfoldComposite.prototype.MakeRoundrobinOperator = function (inputs, args, outputs) {
    /* duplicate  的参数被文法手册规定为全为1
     * Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
     * 如果不指定参数, 则默认都为1 */
    args = args || Array.from({ length: outputs.length }).fill(1)

    let work = MakeRoundrobinWork(inputs, args, outputs);
    let window = MakeRoundrobinWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, "roundrobin", inputs, body)
    res.outputs = outputs
    return res

    /**
     * 构建 Roundrobin 的 work 部分
     */
    function MakeRoundrobinWork(inputs, args, outputs) {
        const decl_i = new declarator(null,new idNode(null,'i'),'0')
        const decl_j = new declarator(null,new idNode(null,'j'),'0')
        const dNode =  new declareNode(null, 'int',[decl_i,decl_j])
        const stmts = [dNode]; // let stmts = ["int i=0,j=0;"]
        outputs.forEach((name, idx) => {
            // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[j++];`)
            const init = new binopNode(null,'i','=','0')
            const cond = new binopNode(null, 'i','<',args[idx])
            const next = new unaryNode(null, '++', 'i')
            const binop_left = new matrix_section(null, name, [new matrix_slice_pair(null,'i')])
            const binop_righ = new matrix_section(null, inputs[0], [new matrix_slice_pair(null,'j++')])
            const statement = new binopNode(null, binop_left, '=', binop_righ)
            stmts.push(new forNode(null, init, cond, next, statement))
        })
        let work = new blockNode(null, '{', stmts, '}')
        return work
    }
    function MakeRoundrobinWindow(inputs, args, outputs) {
        //1. 构建 In sliding(2,2);
        let sum = args.reduce((a, b) => a + b)
        let arg_list = [sum, sum].map(num => new constantNode(null, num)) //Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
        let winStmts = [new winStmtNode(null, inputs[0], { type: 'sliding', arg_list })]

        //2. 循环构建 Out tumbling(1);
        outputs.forEach((name, idx) => {
            let arg_list = [new constantNode(null, args[idx])]
            winStmts.push(new winStmtNode(null, name, { type: 'tumbling', arg_list }))
        })
        return winStmts
    }
}


/**
 * 构建出一个真实的 duplicate 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
 * 例如
 * duplicate(In) {
 *   work{
 *       int i=0;
 *		 for(i=0;i<1;++i)		Out1[i]=In[i];
 *		 for(i=0;i<1;++i)		Out2[i]=In[i];
 *		 for(i=0;i<1;++i)		Out3[i]=In[i];
 *   }
 *   window{
 *       In sliding(1,1);
 *       Out1 tumbling(1);
 *       Out2 tumbling(1);
 *       Out3 tumbling(1);
 *   }
 * }
 * @returns {operatorNode}
 */
UnfoldComposite.prototype.MakeDuplicateOperator = function (inputs, args, outputs) {
    args = args || Array.from({ length: outputs.length }).fill(1) //使用默认全都是1 , 实际上split duplicate()在小括号中不允许输入参数
    let work = MakeDuplicateWork(inputs, args, outputs);
    let window = MakeDuplicateWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, "duplicate", inputs, body)
    res.outputs = outputs
    return res

    /**
     * 构建 duplicate 的 work 部分
     */
    function MakeDuplicateWork(inputs, args, outputs) {
        const decl = new declarator(null,new idNode(null,'i'),'0')
        const dNode =  new declareNode(null, 'int',[decl])
        const stmts = [dNode]; // let stmts = ["int i=0;"]
        outputs.forEach((name, idx) => {
            // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[i];`)
            const init = new binopNode(null,'i','=','0')
            const cond = new binopNode(null, 'i','<',args[idx])
            const next = new unaryNode(null, '++', 'i')
            const binop_left = new matrix_section(null, name, [new matrix_slice_pair(null,'i')])
            const binop_righ = new matrix_section(null, inputs[0], [new matrix_slice_pair(null,'i')])
            const statement = new binopNode(null, binop_left, '=', binop_righ)
            stmts.push(new forNode(null, init, cond, next, statement))
        })
        let work = new blockNode(null, '{', stmts, '}')
        return work
    }
    function MakeDuplicateWindow(inputs, args, outputs) {
        //1. 构建 In sliding(1,1);
        let arg_list = [1, 1].map(num => new constantNode(null, num)) //duplicate 的参数被文法手册规定为1
        let winStmts = [new winStmtNode(null, inputs[0], { type: 'sliding', arg_list })]

        //2. 循环构建 Out1 tumbling(1);
        outputs.forEach(name => {
            winStmts.push(new winStmtNode(null, name, { type: 'tumbling', arg_list: arg_list.slice(1) }))
        })
        return winStmts
    }
}


/**
 * 构建出一个真实的 join 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
 * 例如
 * join(In1,In2) {
 *   work{
 *       int i=0;
 *		 int j=0;
 *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_0[i];
 *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_1[i];
 *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_2[i];
 *   }
 *   window{
 *       Dstream0_0 sliding(1,1);
 *       Dstream0_1 sliding(1,1);
 *       Dstream0_2 sliding(1,1);
 *       Out tumbling(3);
 *   }
 * }
 * @returns {operatorNode} 
 */
UnfoldComposite.prototype.MakeJoinOperator = function (inputs, args, outputs) {
    args = args || Array.from({ length: inputs.length }).fill(1) //join roundrobin()在小括号中不输入参数的话默认全都是1

    let work = MakeJoinWork(inputs, args, outputs);
    let window = MakeJoinWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, "join", inputs, body)
    res.outputs = outputs
    return res

    /**
     * 构建 join 的 work 部分
     */
    function MakeJoinWork(inputs, args, outputs) {
        // 下面代码等价于 let stmts = ["int i=0,j=0;"]
        const decl_i = new declarator(null,new idNode(null,'i'),'0')
        const decl_j = new declarator(null,new idNode(null,'j'),'0')
        const dNode =  new declareNode(null, 'int',[decl_i,decl_j])
        const stmts = [dNode]; // let stmts = ["int i=0,j=0;"]
        inputs.forEach((name, idx) => {
            // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${outputs[0]}[j++] = ${name}[i];`)
            const init = new binopNode(null,'i','=','0')
            const cond = new binopNode(null, 'i','<',args[idx])
            const next = new unaryNode(null, '++', 'i')
            const binop_left = new matrix_section(null, outputs[0], [new matrix_slice_pair(null,'j++')])
            const binop_righ = new matrix_section(null, name, [new matrix_slice_pair(null,'i')])
            const statement = new binopNode(null, binop_left, '=', binop_righ)
            stmts.push(new forNode(null, init, cond, next, statement))
        })
        let work = new blockNode(null, '{', stmts, '}')
        return work
    }
    function MakeJoinWindow(inputs, args, outputs) {
        //每行一个形如 In sliding(1,1) 的 winStmt
        let winStmts = inputs.map((name, idx) => {
            let arg_list = [args[idx], args[idx]].map(num => new constantNode(null, num)) //一般情况下为 sliding(1,1), 也兼容其它 arg. 转为 constantNode 为后续SetFlatNodesWeights做准备
            return new winStmtNode(null, name, { type: 'sliding', arg_list })
        })
        //加入末尾的输出, 形如 Out tumbling(3) 其中的数字是 args 的总和
        let sum = args.reduce((a, b) => a + b)
        winStmts.push(new winStmtNode(
            null,
            outputs[0],
            { type: 'tumbling', arg_list: [new constantNode(null, sum)] })
        )
        return winStmts
    }
}
