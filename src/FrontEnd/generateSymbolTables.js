import { SymbolTable, symbolTableMap, Constant, ArrayConstant, Variable, current_version} from "./symbol";
import { declareNode, compositeNode, function_definition, expNode, blockNode, whileNode, forNode, unaryNode, ternaryNode, parenNode, castNode, constantNode, doNode, splitjoinNode, pipelineNode, compositeCallNode, strdclNode, binopNode,operatorNode, inOutdeclNode, callNode, selection_statement,addNode} from "../ast/node";
import { deepCloneWithoutCircle, error } from "../utils";
import { matrix_section } from "../ast/node";

/** @type{SymbolTable} */
export let top;
let saved = [];

function EnterScopeFn(/** @type {YYLTYPE}*/loc){ 
    SymbolTable.Level++
    saved.push(top);
    top = new SymbolTable(top,loc);
}

function ExitScopeFn(){
    current_version[SymbolTable.Level]++; //创建了新的符号表,当前层的 version + 1 
    SymbolTable.Level--;
    top = saved.pop();
}

/**
 * 生成符号表
 */
export function generateSymbolTables(program){
    let S = new SymbolTable();
    S.loc = {first_line:0,last_line:Infinity};
    symbolTableMap[0][0] = S;
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
    return symbolTableMap;
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
        (body.param.param_list|| []).forEach(decl => top.InsertIdentifySymbol(decl))
    }
    // 第三步 解析 body
    body.stmt_list.forEach(stmt => generateStmt(stmt))
}

// 解析 语句
const ignoreTypes = [unaryNode, ternaryNode, parenNode, castNode, constantNode, matrix_section]
function generateStmt(/** @type {Node} */stmt) {
    switch (stmt.constructor) {
        case String: {
            if (!top.searchName(stmt)) throw new Error(`在当前符号表链中未找到${stmt}的定义`, top)
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
            const BUILTIN_FUNCTIONS = ['print','println', 'pow', 'sin','cos','tan','floor','ceil','abs'];
            if(BUILTIN_FUNCTIONS.includes(stmt.name)) return 

            let func = top.LookupFunctionSymbol(stmt.name);
            stmt.actual_callnode = func;
            // 检查传入的参数是否存在
            break;
        }
        case splitjoinNode: generateSplitjoin(stmt); break;
        case pipelineNode: generatePipeline(stmt); break;
        case addNode: {
            generateStmt(stmt.content)
            break
        }
        case compositeCallNode: {
            /** 不确定是否要在这里做 actual_composite 这个操作 ?
            let actual_comp = S.LookupCompositeSymbol(stmt.compName)->composite;
            stmt.actual_composite = actual_comp;
            // 检查传入的参数是否存在 以及 获得参数值 FIXME */
            if(! symbolTableMap[0][0].compTable[stmt.compName]){
                error(stmt._loc, `此处调用的 composite 未定义:${stmt.compName}`)
            }
            break
        }
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
            generateStmt(body.init);
        }
        if(body.work){
            EnterScopeFn(body.work._loc);
            generateStmt(body.work);
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
    ;(splitjoin.body_stmts||[]).forEach(generateStmt)
    ;(splitjoin.stmt_list||[]).forEach(generateStmt)

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
