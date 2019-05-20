import { compositeCall_list, COStreamJS } from "./global"
import { addNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode,compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode } from "../ast/node";
export class UnfoldComposite {
    constructor() {
        this.num = 0
    }

    /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
    MakeCompositeName(/*string*/ name) {
        return name + "_" + this.num;
    }
    //compositeNode *
    UnfoldRoundrobin(/*string*/ comName,/* splitjoinNode **/ node) { }
    //compositeNode *
    UnfoldDuplicate(/*string*/ comName,/* splitjoinNode **/ node) { }
    //compositeNode *
    UnfoldSplitJoin(/* splitjoinNode */ node) { }
    //Node *
    MakeRoundrobinWork(/*list < Node *> **/ input,/* list < Node *> */ args,/* list < Node *> */ outputs) { }
    //Node *
    MakeJoinWork(/*list < Node *> **/ input,/* list < Node *> */ args,/* list < Node *> */ outputs) { }
    //operatorNode *
    MakeSplitOperator(/*Node **/ input,/* list < Node *> */ args,/* int */ style) { }
    //operatorNode *
    MakeJoinOperator(/*Node **/ output,/* list < Node *> */ inputs,/* list < Node *> */ args) { }

    modifyWorkName(/*Node **/ u,/* string */ replaceName, /* string */ name) { }
}
export var unfold = new UnfoldComposite()


UnfoldComposite.prototype.streamReplace = function (/*compositeNode **/ composite,/* list < Node *> */ inputs,/* list < Node *> */ outputs,/* int*/ flag) {
    throw new Error("not defined")
}

/**
 * 用于splitjoin或者pipeline中展开流的替换，这些compositeCall可以指向相同的init，work
 * FIXME: 这个函数假设被 add 的 composite 中的第一个 binop operator 为有效 operator, 实际上这种假设并不严谨,容易被测试出BUG
 */
UnfoldComposite.prototype.compositeCallStreamReplace = function (/*compositeNode **/ comp,inputs,outputs) { 
    let copy 
    let inout = new ComInOutNode(null,inputs,outputs)
    let head = new compHeadNode(null,comp.compName, inout)

    for(let it of comp.body.stmt_list){
        if(it instanceof binopNode){
            let exp  = it.right
            if(exp instanceof operatorNode){
                copy = getCopyInStreamReplace(exp,inputs,outputs)
            }else if(exp instanceof pipelineNode || exp instanceof splitjoinNode){
                copy = comp
            }
        }else{
            throw new Error("未定义的分支. 前面假设 pipeline 中 add call()的 call 只有 binop 节点是否太片面了")
        }
    }
    this.streamReplace(copy,inputs,outpus,0)
    return copy


    function getCopyInStreamReplace(exp,inputs,outputs){
        /* 除了window都可以指向一块内存 对于window动态分配一块内存，替换window中的名字，再函数的结尾将流进行替换*/
        let work = UnfoldComposite.prototype.workNodeCopy(exp.operBody.work);
        /*动态分配生成新的windowNode*/
        let win = []
        for(let win_stmt of exp.operBody.win){
            let stmt = new winStmtNode(null,win_stmt.winName,{
                type: win_stmt.type,
                arg_list : win_stmt.arg_list
            })
            win.push(stmt)
        }
        let body = new operBodyNode(null,exp.operBody.stmt_list, exp.operBody.init, work, win)
        let oper = new operatorNode(null,exp.operName, exp.inputs, body)
        oper.outputs = exp.outputs 
        debugger
        UnfoldComposite.prototype.modifyStreamName(oper, inputs, true);
        UnfoldComposite.prototype.modifyStreamName(oper, outputs, false);
    }
}

//FIXME 与杨飞的 workNodeCopy 不一致
UnfoldComposite.prototype.workNodeCopy = function(/* Node */ u){
    return u.toString()

    if(u instanceof declareNode){

    }else if( u instanceof blockNode){
        let stmt_list = u.stmt_list.map(node=> workNodeCopy(node))
        return new blockNode(null,'{',stmt_list,'}')
    }else{
        throw new Error("work中怎么会出现这种节点?! "+u.constructor.name)
    }
}

/* style标识输入流还是输出流,true: 输入流, false: 输出流*/
//important!: 杨飞的版本中, 虽然 work 和 win 都修改为了新的streamName, 但是 inputs 和 outputs 还是未变, 不知道这样好不好
//FIXME 与杨飞的 modifyStreamName 不一致
UnfoldComposite.prototype.modifyStreamName = function (/*operatorNode **/ oper, stream,style) { 
    var newName = stream[0]
    var oldName = style ? oper.inputs[0] : oper.outputs[0]
    let reg = new RegExp(oldName,'g')
    oper.operBody.work = oper.operBody.work.replace(reg,newName)
    oper.operBody.win.forEach(winStmt=>{
        if(winStmt.winName == oldName){
            winStmt.winName = newName
        }
    })
}


UnfoldComposite.prototype.UnfoldPipeline = function (/* pipelineNode */ node) {
    compositeCallFlow(node.body_stmts)
    let compName = this.MakeCompositeName("pipeline")
    let inout = new ComInOutNode(null,node.inputs,node.outputs)
    let head = new compHeadNode(null,compName,inout)
    let stmt_list = generateBodyStmts()
    let body = new compBodyNode(null,null,stmt_list)
    let pipeline = new compositeNode(null,head,body)
    return pipeline 

    /**
     * 对于如下形式的 pipeline
     * out = pipeline(in) { 
     *   add A(); 
     *   add B(); 
     *   add C();
     * } 
     * 我们要生成的 stmt_list 的格式为{
     *   //stream<type x>S0,S1; 理想状态这里应该生成一个 strdcl 语句, 但实际上并没生成
     *   S0 = A(in);
     *   S1 = B(S0);
     *   out= C(S1);
     * }
     */
    function generateBodyStmts(){
        let result = []
        for (let i = 0; i < compositeCall_list.length ;i ++){
            let inputs = i == 0 ? node.inputs : ['S'+(i-1)]
            let outputs = i != compositeCall_list.length -1 ? ['S'+i] : node.outputs

            let compCall = compositeCall_list[i]
            let call = new compositeCallNode(null, compCall.compName,inputs)
            call.outputs = outputs
            //TODO: 符号表修改后要修改对应的这个地方
            debugger;
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
    if(!stmts || stmts.length == 0) throw new Error("compositeCallFlow Error")
    stmts.forEach(stmt=>{
        stmt instanceof addNode ? handlerAdd(stmt) : '' ;
        stmt instanceof forNode ? handlerFor(stmt) : '' ;
    })

    function handlerAdd(add){
        if(add.content instanceof compositeCallNode){
            compositeCall_list.push(add.content)

        } else if (add.content instanceof splitjoinNode || add.content instanceof pipelineNode){
            let copy = unfold.workNodeCopy(add.content)
            compositeCall_list.push(copy)
        }
    }
    function handlerFor(){
        throw new Error("handleFor not completed")
    }
}
