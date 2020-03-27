import { deepCloneWithoutCircle } from "../utils"
import { COStreamJS } from "./global"
import { addNode, parenNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode, compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode, declarator, idNode, inOutdeclNode, strdclNode, unaryNode, activationLayerNode } from "../ast/node";
import { matrix_section, matrix_slice_pair, layerNode } from "../ast/node";
import { top, setTop } from "./generateSymbolTables"
import { SymbolTable } from "./symbol";

export class UnfoldComposite {
    constructor() {
        /** @type {number} 用于对展开的 pipeline spitjoin 的 name 添加序号 */
        this.num = 0
        /** @type {Array<{ compName: string, content:string }>} 用于保存展开结果的记录, 避免重复展开 */
        this.cached = []
    }
    /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
    MakeCompositeName(/*string*/ name) {
        return name + "_" + this.num++;
    }
}

/**
 * 对于如下形式的 pipeline
 * out = pipeline(in) { 
 *   add A(1); 
 *   add B(2); 
 *   add C(3);
 * } 
 * 我们要生成的 composite 的样式为{
 *   composite pipeline_0( input stream<int x>S0, output stream<int x>S3){
 *      stream<int y>S1;
 *      S1 = A(S0)(1);
 *      stream<double z>S2; // 注: 不同的 composite 节点的输入输出流类型确实可能不一样
 *      S2 = B(S1)(2);
 *      S3 = C(S2)(3);
 *   }
 * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
 * 然后我们要返回的 compositeCallNode 的样式为
 *   out = pipeline_0(in);
 */
UnfoldComposite.prototype.UnfoldPipeline = function (/** @type {pipelineNode} */ node) {
    let call_list = compositeCallFlow(node.body_stmts, node)    
    let compName = this.MakeCompositeName("pipeline")
    const inStrType = top.streamTable[ node.inputs[0] ].strType, outStrType = top.streamTable[ node.outputs[0] ].strType
    const input_list = [new inOutdeclNode(null,inStrType, 'S0')]
    const output_list = [new inOutdeclNode(null,outStrType, 'S'+call_list.length)]
    const inout = new ComInOutNode(null, input_list, output_list)
    const head = new compHeadNode(null, compName, inout)
    let stmt_list = generateBodyStmts()
    const body = new compBodyNode(null, null, stmt_list)
    const pipeline = new compositeNode(null, head, body)
    
    COStreamJS.ast.push(pipeline)
    COStreamJS.S.compTable[compName] = { composite: pipeline };
    
    // 构造 compositeCallNode
    const compositeCall = new compositeCallNode(null,compName, node.inputs)
    compositeCall.outputs = node.outputs 
    return compositeCall

    
    function generateBodyStmts() {
        let result = []
        for (let i = 0; i < call_list.length; i++) {
            let compCall = call_list[i]
            const inputNames = ['S'+i], outputNames = ['S'+(i+1)]
            const comp = COStreamJS.S.compTable[compCall.compName].composite

            // 先检查要不要生成 stream<int y>S1; 这个语句. 只要不是最后一个 add 则都要生成
            if(i < call_list.length - 1){
                const outStrType = comp.inout.output_list[0].strType
                result.push(new declareNode(null, outStrType, outputNames))  // stream<int x>S1;
            }
            // 接着生成 S1 = A(S0)(param1); 这个语句
            const params = compCall.params.map(exp => exp.value)
            let call = new compositeCallNode(null, compCall.compName,inputNames, params)
            call.outputs = outputNames
            const binop = new binopNode(null, 'S'+(i+1), '=', call)
            result.push(binop)
        }
        return result
    }

}

/**
 *  遍历splitjoin/pipeline结构中的statement，将compositecallNode加入到compositeCall_list中
 */
export function compositeCallFlow(/*list<Node *> */ stmts) {
    let compositeCall_list = []; // 记录了 add composite(); 的列表
    if (!stmts || stmts.length == 0) throw new Error("compositeCallFlow Error")
    stmts.forEach(stmt => {
        stmt instanceof addNode ? handlerAdd(stmt) : '';
        stmt instanceof forNode ? handlerFor(stmt) : '';
    })
    return compositeCall_list

    function handlerAdd(add) {
        if (add.content instanceof compositeCallNode) {
            let copy = deepCloneWithoutCircle(add.content)
            copy.params = copy.params.map(exp => exp.value)
            compositeCall_list.push(copy)

        }else if(add.content instanceof layerNode){
            let copy = deepCloneWithoutCircle(add.content)
            if(!(copy instanceof activationLayerNode)) copy.arg_list = copy.arg_list.map(exp => exp.value)
            compositeCall_list.push(copy)

        }else if (add.content instanceof splitjoinNode || add.content instanceof pipelineNode) {
            let copy = deepCloneWithoutCircle(add.content)
            compositeCall_list.push(copy)
        }
    }
    /**
     * 对一个静态 for 循环做循环展开, 目前没有符号表, 所以只考虑如下简单例子
     * for(j= 1;j<10;i+=2) //对该例子会将其内部语句展开5次
     */
    function handlerFor(/** @type {forNode}*/ for_stmt) {
        /*获得for循环中的init，cond和next值 目前只处理for循环中数据是整型的情况 */
        let itorName = for_stmt.init.left // 获取 for 循环迭代器的 iterator 的名字/初始值
        top.setVariableValue(itorName, for_stmt.init.right.value)
        while(for_stmt.cond.value){
            const innerCall_list = compositeCallFlow(for_stmt.statement.stmt_list)
            compositeCall_list = compositeCall_list.concat(innerCall_list)
            for_stmt.next.value; // 一般是执行 i++
        }
    }
}

/**
 * 对于如下形式的 splitjoin
 * out = splitjoin(in) { 
 *   split duplicate(args); // 也可以是 roundrobin;
 *   add A(1); 
 *   add B(2); 
 *   add pipeline();
 *   join roundrobin();
 * } 
 * 我们要生成的 composite 的样式为{
 *   composite duplicate_0( input stream<int x>In, output stream<int x>Out){
 *      stream<int y>S0,S1,S2,J0,J1,J2;
 *      (S0,S1,S2) = duplicate(In){ ... }; // operator 内容参见 MakeDuplicateOperator
 *      J0 = A(S0)(1);
 *      J1 = B(S1)(2);
 *      J2 = pipeline(S2);
 *      Out = join(J0,J1,J2){ ... }; // operator 内容参见 MakeJoinOperator
 *   }
 * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
 * 然后我们要返回的 compositeCallNode 的样式为
 *   out = duplicate_0(in);
 *
 * @param {splitjoinNode} node - 待展开的 splitjoinNode
 * @returns {compositeCallNode} 展开完成的 
 */
UnfoldComposite.prototype.UnfoldSplitJoin = function (node) {
    setTop(new SymbolTable(top, null)) // 对生成的新 composite 构建新的符号表
    let compName = this.MakeCompositeName("splitjoin");
    let call_list = compositeCallFlow(node.body_stmts);

    const strType = top.prev.streamTable[node.inputs[0]].strType // 这里也简单默认输入输出数据流类型一致, 若有不一致的需求, 应修改此处代码
    const head_input = new inOutdeclNode(null, strType, "In")
    const head_output = new inOutdeclNode(null, strType, "Out")
    let inout = new ComInOutNode(null, [head_input], [head_output])
    let head = new compHeadNode(null, compName, inout) // 构建头部完成

    var stmt_list = this.generateDuplicateOrRoundrobinBodyStmts(node, node.split.type, call_list);

    let body = new compBodyNode(null, null, stmt_list)
    let splitjoin = new compositeNode(null, head, body) // 已生成该新的 compositeNode

    // 将新生成的 compositeNode 插回到语法树和符号表中
    COStreamJS.ast.push(splitjoin)
    COStreamJS.S.compTable[compName] = { composite: splitjoin };
    
    // 构造 compositeCallNode
    const compositeCall = new compositeCallNode(null,compName, node.inputs)
    compositeCall.outputs = node.outputs 

    setTop(top.prev) // 还原至上层符号表
    return compositeCall
}

/**
 * 目标生成的结构:
 *      stream<int y>S0,S1,S2,J0,J1,J2;
 *      (S0,S1,S2) = duplicate(In){ ... }; // operator 内容参见 MakeDuplicateOperator
 *      J0 = A(S0)(1);
 *      J1 = B(S1)(2);
 *      J2 = pipeline(S2);
 *      Out = join(J0,J1,J2){ ... }; // operator 内容参见 MakeJoinOperator
 * @param {splitjoinNode} node
 * @param {Array<compositeCallNode|splitjoinNode|pipelineNode>} call_list
 * @returns {statement[]}
 */
UnfoldComposite.prototype.generateDuplicateOrRoundrobinBodyStmts = function (node, type = "duplicate", call_list) {
    let result = [], currentNum = this.num 
    /** 这里要把当前的序号保存下来 达到"成对"生成oper名字的目的
     *                                    duplicate_0
     *                                          roundrobin_1
     *                                          join_1
     *                                    join_0
     */

    //0.先提前设置好流变量名
    let splitStreams = Array.from({ length: call_list.length }).map((_, idx) =>  "S" + idx)
    let joinStreams = Array.from({ length: call_list.length }).map((_, idx) =>  "J" + idx)

    //1. 构建流变量声明节点 stream<int y>S0,S1,S2,J0,J1,J2;
    const strType = top.prev.streamTable[ node.inputs[0] ].strType; // 注: 这里默认过程中的数据流类型都相同, 若有不同可修改此处代码
    [...splitStreams, ...joinStreams,"In","Out"].forEach(strName => top.streamTable[strName] = { strType }) // 为新声明的几个数据流名在符号表中注册类型

    let declareStmt = new declareNode(null, strType, splitStreams.concat(joinStreams))
    result.push(declareStmt);

    //2.构建 duplicateOrRoundrobin  节点
    let duplicateOrRoundrobinOper = type === "duplicate"
        ? this.MakeDuplicateOperator(["In"], node.split.arg_list, splitStreams, currentNum)
        : this.MakeRoundrobinOperator(["In"], node.split.arg_list, splitStreams, currentNum)
    result.push(duplicateOrRoundrobinOper)

    //3.构建 body 中的对输入流的处理
    for (let i = 0; i < call_list.length; i++) {
        let it = call_list[i]

        if (it instanceof compositeCallNode) {
            let call = new compositeCallNode(null, it.compName, [splitStreams[i]], it.params)
            call.outputs = [joinStreams[i]]
            let binop = new binopNode(null,splitStreams[i], '=', call)
            result.push(binop)

        } else if (it instanceof splitjoinNode || it instanceof pipelineNode) {
            /** 若为splitjoin或者pipeline结构，赋予其输入和输出流 
             *  例如之前是 add pipeline { 
             *              add A(); 
             *              add B(); 
             *           } 
             *  将其转化为 Ji = pipeline_num(Si); // 这里额外执行一次 unfoldPipeline, 得到一个 compositeCallNode
             */
            
            // 先去缓存中查找该结构是否已展开过
            let hit = this.cached.find(record => record.content === it.toString())
            if(hit){
               var call = new compositeCallNode(null,hit.compName, [splitStreams[i]])
               call.outputs = [joinStreams[i]]
            }else{
               const needToCacheString = it.toString()
               it.inputs = [splitStreams[i]]
               it.outputs = [joinStreams[i]]
               var call = it instanceof splitjoinNode ? this.UnfoldSplitJoin(it) : this.UnfoldPipeline(it)
               this.cached.push({ compName: call.compName, content: needToCacheString })
            }
            
            let binop = new binopNode(null, joinStreams[i], '=', call)
            result.push(binop)
        }
    }
    //4.构建 join 节点
    result.push(this.MakeJoinOperator(joinStreams, node.split.arg_list, ["Out"],currentNum))
    return result
}


/**
 * 构建出一个真实的 roundrobin 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
 * 例如
 * (S0,S1) = roundrobin(In) {
 *   work{
 *       int i=0,j=0;
 *		 for(i=0;i<1;++i)		S0[i]=In[j++];
 *		 for(i=0;i<1;++i)		S1[i]=In[j++];
 *   }
 *   window{
 *       In sliding(2,2);
 *       S0 tumbling(1);
 *       S1 tumbling(1);
 *   }
 * }
 * @returns {operatorNode}
 */
UnfoldComposite.prototype.MakeRoundrobinOperator = function (inputs, args, outputs, num) {
    /* duplicate  的参数被文法手册规定为全为1
     * Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
     * 如果不指定参数, 则默认都为1 */
    args = args || Array.from({ length: outputs.length }).fill(1)

    let work = MakeRoundrobinWork(inputs, args, outputs);
    let window = MakeRoundrobinWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let oper = new operatorNode(null, `roundrobin_${num}`, inputs, body)
    oper.outputs = outputs
    let binop = new binopNode(null, new parenNode(null, outputs),'=',oper)
    return binop

    /**
     * 构建 Roundrobin 的 work 部分
     *       int i=0,j=0;
     *		 for(i=0;i<1;++i)		S0[i]=In[j++];
     *		 for(i=0;i<1;++i)		S1[i]=In[j++];
     */
    function MakeRoundrobinWork(inputs, args, outputs) {
        const decl_i = new declarator(null,new idNode(null,'i'),'0')
        const decl_j = new declarator(null,new idNode(null,'j'),'0')
        const dNode =  new declareNode(null, 'int',[decl_i,decl_j])
        const stmts = [dNode]; // stmts = ["int i=0,j=0;"]
        outputs.forEach((name, idx) => {
            // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[j++];`)
            const init = new binopNode(null,'i','=', new constantNode(null,'0'))
            const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]))
            const next = new unaryNode(null, '++', 'i')
            const binop_left = new matrix_section(null, name, [new matrix_slice_pair(null,'i')])
            const binop_righ = new matrix_section(null, inputs[0], [new matrix_slice_pair(null,'j++')])
            const statement = new binopNode(null, binop_left, '=', binop_righ)
            stmts.push(new forNode(null, init, cond, next, statement))
        })
        let work = new blockNode(null, '{', stmts, '}')
        return work
    }
    /**
     * 构建 Roundrobin 的 window 部分
     *       In sliding(2,2);
     *       S0 tumbling(1);
     *       S1 tumbling(1);
     */
    function MakeRoundrobinWindow(inputs, args, outputs) {
        //1. 构建 In sliding(2,2);
        let sum = args.map(arg=>parseInt(arg)).reduce((a, b) => a + b)
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
 * (Out1,Out2,Out3) = duplicate(In) {
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
UnfoldComposite.prototype.MakeDuplicateOperator = function (inputs, args, outputs, num) {
    args = args || Array.from({ length: outputs.length }).fill(1) //使用默认全都是1 , 实际上split duplicate()在小括号中不允许输入参数
    let work = MakeDuplicateWork(inputs, args, outputs);
    let window = MakeDuplicateWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, `duplicate_${num}`, inputs, body)
    res.outputs = outputs
    let binop = new binopNode(null, new parenNode(null,outputs), '=', res)
    return binop

    /**
     * 构建 duplicate 的 work 部分
     */
    function MakeDuplicateWork(inputs, args, outputs) {
        const decl = new declarator(null,new idNode(null,'i'),'0')
        const dNode =  new declareNode(null, 'int',[decl])
        const stmts = [dNode]; // let stmts = ["int i=0;"]
        outputs.forEach((name, idx) => {
            // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[i];`)
            const init = new binopNode(null,'i','=',new constantNode(null,'0'))
            const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]))
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
 * Out = join(In1,In2) {
 *   work{
 *       int i=0;
 *		 int j=0;
 *		 for(i=0;i<1;++i)		Out[j++]=In0[i];
 *		 for(i=0;i<1;++i)		Out[j++]=In1[i];
 *		 for(i=0;i<1;++i)		Out[j++]=In2[i];
 *   }
 *   window{
 *       In0 sliding(1,1);
 *       In1 sliding(1,1);
 *       In2 sliding(1,1);
 *       Out tumbling(3);
 *   }
 * }
 * @returns {binopNode} 
 */
UnfoldComposite.prototype.MakeJoinOperator = function (inputs, args, outputs, num) {
    args = args || Array.from({ length: inputs.length }).fill(1) //join roundrobin()在小括号中不输入参数的话默认全都是1

    let work = MakeJoinWork(inputs, args, outputs);
    let window = MakeJoinWindow(inputs, args, outputs);
    let body = new operBodyNode(null, null, null, work, window) //没有 stmt_list 和 init,只有 work,window
    let res = new operatorNode(null, `join_${num}`, inputs, body)
    res.outputs = outputs
    let binop = new binopNode(null, outputs[0],'=',res)
    return binop

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
            const init = new binopNode(null,'i','=',new constantNode(null,'0'))
            const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]))
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
        let sum = args.map(arg=>parseInt(arg)).reduce((a, b) => a + b)
        winStmts.push(new winStmtNode(
            null,
            outputs[0],
            { type: 'tumbling', arg_list: [new constantNode(null, sum)] })
        )
        return winStmts
    }
}
