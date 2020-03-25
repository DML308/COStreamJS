import { runningStack, SymbolTable, Constant, ArrayConstant, Variable, symbolTableList} from "./symbol";
import { declareNode, compositeNode, function_definition, expNode, blockNode, whileNode, forNode, unaryNode, ternaryNode, parenNode, castNode, constantNode, doNode, splitjoinNode, pipelineNode, compositeCallNode, strdclNode, binopNode,operatorNode, inOutdeclNode, callNode, selection_statement,addNode,operNode, sequentialNode, layerNode} from "../ast/node";
import { deepCloneWithoutCircle, error } from "../utils";
import { matrix_section } from "../ast/node";
import { BUILTIN_FUNCTIONS } from "./built-in-function";

/** @type {SymbolTable} */
export let top;
export function setTop(newTop){ top = newTop; }

let saved = [];

function EnterScopeFn(/** @type {YYLTYPE}*/loc){ 
    saved.push(top);
    top = new SymbolTable(top,loc);
}

function ExitScopeFn(){
    top = saved.pop();
}

/**
 * 生成符号表
 */
export function generateSymbolTables(program){
    let S = new SymbolTable();
    S.loc = {first_line:0,last_line:Infinity};
    symbolTableList.length = 0; // 清空旧的符号表(当程序重复执行时可能会遇到符号表 List 不为空的情况)
    symbolTableList.push(S) 
    top = S;
    
    program.forEach(node => {
        if(node instanceof declareNode){
            generateDeclareNode(node);
        }
        else if(node instanceof compositeNode){
            top.InsertCompositeSymbol(node);
            EnterScopeFn(node._loc);/* 进入 composite 块级作用域 */ 
            generateComposite(node);
            ExitScopeFn(); /* 退出 composite 块级作用域 */ 
        } 
        else if(node instanceof function_definition){
            console.warn("目前未支持函数符号表")
        }       
    });
    return symbolTableList;
}

function generateDeclareNode(/** @type{declareNode} */node){
    node.init_declarator_list.forEach(init_node=>{
        if(Array.isArray(init_node.initializer)){ //是数组
            let array = new ArrayConstant(node.type);
            array.values = (init_node.initializer||[]).map(init => new Constant(node.type, init.value))
            const variable = new Variable("array",init_node.identifier.name,array);
            top.InsertIdentifySymbol(variable);

        }else{
            // 不是数组的情况
            const constant = new Constant(node.type, (init_node.initializer || {}).value)
            top.InsertIdentifySymbol(init_node,constant);
        }
    })
}

// 解析 Composite 节点 
function generateComposite(/** @type{compositeNode} */composite) {
    composite._symbol_table = top;
    let inout = composite.inout || {}; //输入输出参数
    let body = composite.body; //body
    // 第一步, 解析输入输出流 inout
    (inout.input_list || []).forEach(input => {
        const copy = deepCloneWithoutCircle(input)
        top.InsertStreamSymbol(copy)
    });
    (inout.output_list || []).forEach(output => {
        const copy = deepCloneWithoutCircle(output)
        top.InsertStreamSymbol(copy)
    });
    // 第二步 解析 param
    if(body.param && body.param.param_list){
        (body.param.param_list|| []).forEach(decl => { 
            top.InsertIdentifySymbol(decl)
            top.paramNames.push(decl.identifier.name)
        })
    }
    // 第三步 解析 body
    body.stmt_list.forEach(stmt => generateStmt(stmt))
}

// 解析 语句
const ignoreTypes = [unaryNode, ternaryNode, parenNode, castNode, constantNode, matrix_section]
function generateStmt(/** @type {Node} */stmt) {
    switch (stmt.constructor) {
        case Number: break;
        case String: {
            if (!top.searchName(stmt)) error(stmt._loc,`在当前符号表链中未找到${stmt}的定义`, top)
            break;
        }
        case declareNode: {
            if (stmt.type instanceof strdclNode) {
                generateStrDlcNode(stmt);
            } else {
                generateDeclareNode(stmt);
            }
            break;
        }
        case binopNode: {
            /** 常见的 binop 节点有2种情况, 
             * 1. Out = Method(In){ ... } 这样右边是 operator 的, 则分别左右两边 generatStmt 即可进入流程
             * 2. c = a+b+c 对于这种尝试进行常量传播
             * 3. Out[0].x = In[0].x 对这种情况要校验流变量类型成员中是否有 x 字段 */
            if(stmt.op === '.'){
                if(stmt.left instanceof matrix_section){
                    let streamName = stmt.left.exp
                    let memberName = stmt.right
                    const current = top.searchName(streamName).origin
                    const type_list = current.streamTable[streamName].strType.id_list
                    if(type_list.every(obj=> obj.identifier!=memberName)){
                        error(stmt._loc, `流 ${streamName} 上不存在成员 ${memberName}`)
                    }
                    
                }
            }else{
                if (stmt.op === '=' && stmt.left instanceof String && stmt.right instanceof expNode) {
                    let variable = top.LookupIdentifySymbol(stmt.left);
                    variable.value = right.value;
                }
                generateStmt(stmt.left);
                generateStmt(stmt.right);
            }
            break;
        }
        case operatorNode: {
            top.InsertOperatorSymbol(stmt.operName, stmt);
            EnterScopeFn(stmt._loc);
            generateOperatorNode(stmt);  //解析 operator 节点
            ExitScopeFn();
            break;
        }
        case blockNode: {
            stmt.stmt_list.forEach(st => generateStmt(st)) // 深入 { 代码块 } 内部进行遍历
            break;
        }
        case whileNode: {
            EnterScopeFn(stmt._loc);
            generateStmt(stmt.exp);
            generateStmt(stmt.statement);
            ExitScopeFn();
            break;
        }
        case forNode: {
            EnterScopeFn(stmt._loc);
            const { init, cond, next, statement } = stmt;
            [init, cond, next, statement].forEach(generateStmt)
            ExitScopeFn();
            break;
        }
        case doNode: {
            EnterScopeFn(stmt);
            generateStmt(stmt.exp);
            generateStmt(stmt.statement);
            ExitScopeFn();
            break;
        }
        case selection_statement: {
            /** FIXME 暂未处理分支预测 */
            break;
        }
        case callNode: {
            /** FIXME: 函数调用这一块不够完美 */
            if(BUILTIN_FUNCTIONS.includes(stmt.name)) return 

            let func = top.LookupFunctionSymbol(stmt.name);
            stmt.actual_callnode = func;
            // 检查传入的参数是否存在
            break;
        }
        case splitjoinNode: generateSplitjoin(stmt); break;
        case pipelineNode: generatePipeline(stmt); break;
        case sequentialNode: generateSequential(stmt); break;
        case addNode: generateStmt(stmt.content); break
        case compositeCallNode: {
            /** 检查传入的参数是否存在 以及 获得参数值 FIXME */
            if(! symbolTableList[0].compTable[stmt.compName]){
                error(stmt._loc, `此处调用的 composite 未定义:${stmt.compName}`)
            }
            break
        }
        case Array: stmt.forEach(stmt => generateStmt(stmt)); break;
        default: {
            if (ignoreTypes.some(ignoreType => stmt instanceof ignoreType)) {
                /** 这些类型不需要在生成符号表这一步进行处理,可暂时跳过 */
            } else {
                console.warn("[generateStmt] FIXME: 暂未识别的 stmt 类型")
            }
        }
    }
}

// 处理 stream 声明变量的语句
function generateStrDlcNode(/** @type {declareNode}*/ decl){  //stream "<int x,int y>" 这部分
    decl.init_declarator_list.forEach( identifier_name => {
        let stream_dlc = new inOutdeclNode();
        stream_dlc.strType = decl.type
        stream_dlc.id = identifier_name
        top.InsertStreamSymbol(stream_dlc)
    })
}
function generateOperatorNode(/** @type {operatorNode}*/oper){
    oper._symbol_table = top
    let inputs = oper.inputs;
    let outputs = oper.outputs;
    let body = oper.operBody
    
    const checkStreamId = name => {
        if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
            throw new Error(`当前 operator: ${oper.operName} 相关的流 ${name} 在作用域中未声明`)
        }
    }

    inputs && inputs.forEach(checkStreamId);
    outputs && outputs.forEach(checkStreamId);

    if(body){
        if(body.stmt_list){
            body.stmt_list.forEach(decl=>{
                decl instanceof declareNode ? top.InsertMemberSymbol(decl)
                    :console.warn("[generateOperatorNode] 目前 operator 内部仅支持声明成员变量")
            })
        }
        if(body.init){
            EnterScopeFn(body.init._loc);
            generateStmt(body.init)
            body.init._symbol_table = top
            ExitScopeFn();
        }
        if(body.work){
            EnterScopeFn(body.work._loc);
            generateStmt(body.work)
            body.work._symbol_table = top
            ExitScopeFn();
        }
        if(body.window){
            body.window.forEach(winStmt =>checkStreamId(winStmt.winName))
        }
    }
}

// 解析 splitjoin
function generateSplitjoin(/** @type {splitjoinNode} */ splitjoin){
    const checkStreamId = name => {
        if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
            throw new Error(`当前 operator: ${splitjoin.compName} 相关的流 ${name} 在作用域中未声明`)
        }
    }

    ;(splitjoin.inputs||[]).forEach(checkStreamId)
    ;(splitjoin.outputs||[]).forEach(checkStreamId)
    ;(splitjoin.stmt_list||[]).forEach(generateStmt)
    ;(splitjoin.body_stmts||[]).forEach(generateStmt)

    if(splitjoin.split){
        // 保证参数列表中不出现未声明的字符
        (splitjoin.split.arg_list||[]).forEach(generateStmt)
    }
 
    if(splitjoin.join){
        (splitjoin.join.arg_list||[]).forEach(generateStmt)
    }
}

// 解析 pipeline 节点 
function generatePipeline(/** @type {pipelineNode} */pipe){
    const checkStreamId = name => {
        if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
            throw new Error(`当前 operator: ${pipe.compName} 相关的流 ${name} 在作用域中未声明`)
        }
    }

    ;(pipe.inputs||[]).forEach(checkStreamId)
    ;(pipe.outputs||[]).forEach(checkStreamId)
    ;(pipe.body_stmts||[]).forEach(generateStmt)
}

// 解析 sequential
function generateSequential(/** @type {sequentialNode} */ sequential){
    const checkStreamId = name => {
        if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
            throw new Error(`当前 operator: ${splitjoin.compName} 相关的流 ${name} 在作用域中未声明`)
        }
    }

    ;(sequential.inputs||[]).forEach(checkStreamId)
    ;(sequential.outputs||[]).forEach(checkStreamId)
    ;(sequential.body_stmts||[]).forEach(add =>{
        if(add instanceof addNode && add.content instanceof layerNode){
            return // 正确的情况
        }else{
            error(add._loc, "sequential 结构内部仅能添加以下几种 layerNode之一: Dense Conv2D MaxPooling2D AveragePooling2D")
        }
    })
    if(sequential.body_stmts && sequential.body_stmts.length < 2){
        error(sequential._loc, "sequential 结构中必须至少有 2 个 layer")
    }
}

/**
 * 
 * @param {operNode} call 
 * @param {compositeNode} composite 
 * @param {number[]} params
 */
export function generateCompositeRunningContext(call,composite,params=[]){
    top = new SymbolTable(top, composite._loc)

    generateComposite(composite)

    if(!composite.body) return top
    // 处理 param
    if(composite.body.param){
        composite.body.param.param_list.forEach((decla, index)=>{
            const variable = top.variableTable[decla.identifier.name]
            variable.value = new Constant(decla.type, params[index])
        })
    }

    // 处理 inputs 和 outputs
    // 例子 composite Test(input stream<int x>In1, output stream<int x>Out1, stream<int x>Out2)
    if(composite.inout){
        composite.inout.input_list.forEach((inDecl, inIndex) => {
            let prevStream = top.prev.streamTable[call.inputs[inIndex]]
            let currentStream = top.streamTable[inDecl.id]
            const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(currentStream.strType);
            isTypeOK ? top.streamTable[inDecl.id] = prevStream
                     : error(call._loc, `调用${composite.compName}时输入流类型与定义不吻合`)
        })
        composite.inout.output_list.forEach((outDecl, outIndex) => {
            let prevStream = top.prev.streamTable[call.outputs[outIndex]]
            let currentStream = top.streamTable[outDecl.id]
            const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(currentStream.strType);
            isTypeOK ? top.streamTable[outDecl.id] = prevStream
                     : error(call._loc, `调用${composite.compName}时输出流类型与定义不吻合`)
        })
    }

    return top
}