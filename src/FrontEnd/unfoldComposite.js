import { compositeCall_list, COStreamJS } from "./global"
import { addNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode, compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode } from "../ast/node";
export class UnfoldComposite {
    constructor() {
        this.num = 0
    }

    /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
    MakeCompositeName(/*string*/ name) {
        return name + "_" + this.num++;
    }

    modifyWorkName(/*Node **/ u,/* string */ replaceName, /* string */ name) { }
}
export var unfold = new UnfoldComposite()


/**
 * @description 对于composite节点内的operatorNode进行流替换
 * 只替换第一个和最后一个oper 的原因是: 对第一个修改 IN, 对最后一个修改 Out, 对简单串行的 comp 是没问题的
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
UnfoldComposite.prototype.streamReplace = function (/*compositeNode **/ comp,/* String[] */ inputs, outputs,/* int*/ flag) {
    let stmt_list = comp.body.stmt_list
    operaterStreamReplace(stmt_list[0], inputs, 'inputs')
    operaterStreamReplace(stmt_list[stmt_list.length - 1], outputs, 'outputs')
    return comp

    function operaterStreamReplace(stmt, streamNames, tag) {
        let oper = stmt instanceof binopNode ? stmt.right : stmt
        if (oper instanceof operatorNode) {
            if (flag) {
                UnfoldComposite.prototype.modifyStreamName(oper, streamNames, true)
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
        let work = UnfoldComposite.prototype.workNodeCopy(exp.operBody.work);
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

//FIXME 与杨飞的 workNodeCopy 不一致
UnfoldComposite.prototype.workNodeCopy = function (/* Node */ u) {
    return u.toString()

    if (u instanceof declareNode) {

    } else if (u instanceof blockNode) {
        let stmt_list = u.stmt_list.map(node => workNodeCopy(node))
        return new blockNode(null, '{', stmt_list, '}')
    } else {
        throw new Error("work中怎么会出现这种节点?! " + u.constructor.name)
    }
}

/* style标识输入流还是输出流,true: 输入流, false: 输出流*/
//important!: 杨飞的版本中, 虽然 work 和 win 都修改为了新的streamName, 但是 inputs 和 outputs 还是未变, 不知道这样好不好
//FIXME 与杨飞的 modifyStreamName 不一致
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
            let copy = unfold.workNodeCopy(add.content)
            compositeCall_list.push(copy)
        }
    }

    /**
     * 对一个静态 for 循环做循环展开, 目前没有符号表, 所以只考虑如下简单例子
     * for(j= 1;j<10;i+=2) //对该例子会将其内部语句展开5次
     * 
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
        let adds
        if (for_stmt.statement instanceof blockNode) {
            adds = for_stmt.statement.stmt_list.filter(n => n instanceof addNode)
        } else {
            adds = [for_stmt.statement]
        }
        //现在需要展开循环的次数 count 和展开循环的内部语句 adds 都已准备好, 那么开始将其按顺序放入目标中
        for (let i = 0; i < count; i++) {
            adds.forEach(add => {
                compositeCall_list.push(add.content)
            })
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
    var stmt_list = node.split.type === 'roundrobin'
        ? this.generateRoundrobinBodyStmts(compName, node)
        : this.generateDuplicateBodyStmts(compName, node);

    let body = new compBodyNode(null, null, stmt_list)
    let actual_composite = new compositeNode(null, head, body)
    compositeCall_list.length = 0;
    return actual_composite
}

/**
 * 对于如下形式的 split roundrobin
 * split roundrobin(1,1);
 *   add A();
 *   add B();
 * join  roundrobin(1,1);
 * 我们要生成的 stmt_list 的格式为{
 *   [S1,S2] = MakeSplitOperator(In)
 *   S3 = A(S1)
 *   S4 = B(S2)
 *   Out = MakeJoinOperator(S3,S4)
 * }
 */
UnfoldComposite.prototype.generateRoundrobinBodyStmts = function (compName, node) {
    //1.构建 split 来切分输入流
    let result = []
    result.push(this.MakeSplitOperator(node.inputs , node.split.arg_list))
    //2.构建 body 中的对输入流的处理
    for (let i = 0; i < compositeCall_list.length; i++) {
        let it = compositeCall_list[i]
        let innerStreams = [compName + "_" + i] //该数组只有一个元素, 存放临时流名,例如[S0_1]

        if (it instanceof compositeCallNode) {
            let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName)
            let call = new compositeCallNode(null, it.compName, node.inputs, null)
            call.outputs = innerStreams
            call.actual_composite = this.compositeCallStreamReplace(comp, node.inputs, innerStreams)
            result.push(call)

        } else {
            /* FIXME: 对于有限的测试用例, 这里做了理想的假设: 即 roundrobin 节点里只有简单的 compositeCall */
            throw new Error('Unfold 暂不支持 roundrobin 中嵌套复杂类型')
        }
    }
    //3.构建 join 节点
    let join = UnfoldComposite.prototype.MakeJoinOperator()
    result.push(join)
    return result
}


/**
 * 对于如下形式的 split duplicate
 * split duplicate();
 *   add A();
 *   add B();
 *   add pipeline();
 * join  roundrobin();
 * 我们要生成的 stmt_list 的格式为{
 *   S0_0 = A(In)
 *   S0_1 = B(In)
 *   S0_2 = pipeline(In)
 *   Out = join(S0_0, S0_1, S0_2)
 * }
 */
UnfoldComposite.prototype.generateDuplicateBodyStmts = function (compName, node) {
    let result = []
    //1.构建 body 中的对输入流的处理
    for (let i = 0; i < compositeCall_list.length; i++) {
        let it = compositeCall_list[i]
        let innerStreams = [compName + "_" + i] //该数组只有一个元素, 存放临时流名,例如[S0_1]

        if (it instanceof compositeCallNode) {
            let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName)
            let call = new compositeCallNode(null, it.compName, node.inputs, null)
            call.outputs = innerStreams
            call.actual_composite = this.compositeCallStreamReplace(comp, node.inputs, innerStreams)
            result.push(call)

        } else if (it instanceof splitjoinNode || it instanceof pipelineNode) {
            /* 若为splitjoin或者pipeline结构，赋予其输入和输出流 */
            /* FIXME: 这里会有一个 BUG, 因为这里是对右边的 call 进行了复用, 
             * 所以会导致最后一个赋值的流名覆盖了之前的流名 , 
             * 例如我们本意是 join(S0,S1,S2)
             * 实际情况会得到结果 join(S2,S2,S2)
             * 但好像该BUG对代码生成影响不大, 所以先留在这里.
             */
            it.inputs = node.inputs
            it.outputs = innerStreams
            result.push(it)
        }
    }
    //2.构建 join 节点
    let join = UnfoldComposite.prototype.MakeJoinOperator(node.inputs,node.outputs)
    result.push(join)
    return result
}


/**
 * @returns {Node} 
 */
UnfoldComposite.prototype.MakeRoundrobinWork = function (/*list < Node *> **/ input,/* list < Node *> */ args,/* list < Node *> */ outputs) {

}

/**
 * @returns {operatorNode} 
 */
UnfoldComposite.prototype.MakeSplitOperator = function (/*Node **/ input,/* list < Node *> */ args,/* int */ style) {
    return 'split'
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
UnfoldComposite.prototype.MakeJoinOperator = function (inputs,outputs,args) {
    args = args || Array.from({ length: inputs.length }).fill(1) //join roundrobin()在小括号中不输入参数的话默认全都是1

    let work = MakeJoinWork(inputs, args, outputs);
    let window = MakeJoinWindow(inputs, args, outputs);
    let body = new operBodyNode(null,null,null,work,window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, "join", inputs, body)
    res.outputs = outputs
    return res

    /**
     * 构建 join 的 work 部分
     * FIXME:此处实现和杨飞不同, 仅仅是为了简单而对 work 使用字符串
     */
    function MakeJoinWork(inputs,args,outputs){
        let stmts = ["int i=0,j=0;"]
        inputs.forEach((name,idx)=>{
            stmts.push(`for(i=0;i<${args[idx]};++i)  ${outputs[0]}[j++] = ${name}[i]; \n`)
        })
        let work = '{\n' + stmts.join('\n') + '\n}\n'
        return work
    }
    function MakeJoinWindow(inputs, args, outputs) {
        //每行一个形如 In sliding(1,1) 的 winStmt
        let winStmts = inputs.map((name,idx)=>{
            let arg_list = [ args[idx], args[idx] ] //一般情况下为 sliding(1,1), 也兼容其它 arg
            return new winStmtNode(null, name, { type: 'sliding', arg_list })
        })
        //加入末尾的输出, 形如 Out tumbling(3) 其中的数字是 args 的总和
        let sum = args.reduce((a,b)=>a+b)
        winStmts.push(new winStmtNode(null, outputs[0], { type: 'tumbling', arg_list:[sum] }) )
        return winStmts
    }
}
