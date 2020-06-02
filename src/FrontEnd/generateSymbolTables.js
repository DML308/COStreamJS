import { SymbolTable, Variable, symbolTableList} from "./symbol";
import { declareNode, compositeNode, function_definition, expNode, blockNode, whileNode, forNode, unaryNode, ternaryNode, parenNode, castNode, constantNode, doNode, splitjoinNode, pipelineNode, compositeCallNode, strdclNode, binopNode,operatorNode, inOutdeclNode, callNode, selection_statement,addNode,operNode, sequentialNode, layerNode, fileReaderNode, matrix_constant} from "../ast/node";
import { deepCloneWithoutCircle, error } from "../utils";
import { matrix_section } from "../ast/node";
import { BUILTIN_FUNCTIONS, BUILTIN_MATRIX_FUNCTIONS, BUILTIN_FUNCTIONS_ARG, getMostNearName } from "./built-in-function";
import { fileWriterNode } from "../ast/node";
import { checkShape } from "./checkShape"
import { top,setTop, COStreamJS } from './global'

let saved = [];
let isInOperator = false; // 判断当前处理的二元节点是否正处于operator体内的上下文中, 若处于, 则检查shape且不修改符号表中的值. 若不处于, 则允许修改符号表中的值

function EnterScopeFn(/** @type {YYLTYPE}*/loc){ 
    saved.push(top);
    setTop(new SymbolTable(top,loc));
}

function ExitScopeFn(){
    setTop(saved.pop());
}

/**
 * 生成全局根符号表, 包括全局变量/composite表/函数表, 不深入composite内部(深入composite内部的符号表构建放在ast2ssg中完成)
 */
export function generateSymbolTables(program){
    let S = new SymbolTable();
    S.loc = {first_line:0,last_line:Infinity};
    symbolTableList.length = 0; // 清空旧的符号表(当程序重复执行时可能会遇到符号表 List 不为空的情况)
    symbolTableList.push(S) 
    setTop(S);
    
    program.forEach(node => {
        if(node instanceof declareNode){
            generateDeclareNode(node);
        }
        else if(node instanceof compositeNode){
            top.InsertCompositeSymbol(node);
        } 
        else if(node instanceof function_definition){
            console.warn("目前未支持函数符号表")
        }       
    });
    return symbolTableList;
}

function generateDeclareNode(/** @type{declareNode} */node){
    node.init_declarator_list.forEach(init_node=>{
        const name = init_node.identifier.name
        generateStmt(init_node.initializer)
        const variable = new Variable(node.type,name,init_node.initializer,node._loc);
        if(node.type === "Matrix"){
            variable.shape = checkShape(init_node.initializer, init_node._loc).map(x=>x.value)
        }
        top.InsertIdentifySymbol(variable);
    })
}

let lastLoc = null
const ignoreTypes = [ternaryNode, parenNode, castNode, constantNode, fileReaderNode, fileWriterNode, matrix_constant]
// 解析 语句
function generateStmt(/** @type {Node} */stmt) {
    lastLoc = stmt instanceof Node ? stmt._loc : lastLoc //记录最近一次处理的节点的loc信息
    switch (stmt.constructor) {
        case Number: break;
        case String: {
            if (!top.searchName(stmt)){ throw new Error(error(lastLoc,`在当前符号表链中未找到${stmt}的定义`, top))}
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
        case matrix_section: if(isInOperator && COStreamJS.plugins.matrix) checkShape(stmt); break
        case unaryNode: if(isInOperator && COStreamJS.plugins.matrix) checkShape(stmt); break
        case binopNode: {
            /**
             * 对赋值语句有两种上下文需要处理
             * 1. operator内,此时数据的变化发生在运行时, 因此只做shape检查和变量名是否存在的校验
             * 2. composite内operator外, 此时变量名N的变化可能会影响到param数值,因此需要修改符号表内的数 */
            if(isInOperator){
                if(COStreamJS.plugins.matrix){
                    checkShape(stmt)
                }else{

                }
            }else{
                if (stmt.op === '=' && stmt.left instanceof String && stmt.right instanceof expNode) {
                    let variable = top.LookupIdentifySymbol(stmt.left);
                    variable.value = right.value;
                }
                generateStmt(stmt.left)
                generateStmt(stmt.right)
            }
            break;
        }
        case operatorNode: {
            top.InsertOperatorSymbol(stmt.operName, stmt);
            EnterScopeFn(stmt._loc);
            isInOperator = true
            generateOperatorNode(stmt);  //解析 operator 节点
            isInOperator = false;
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
            if(isInOperator && COStreamJS.plugins.matrix){
                checkShape(stmt);
                return
            }
            if(typeof stmt.name === "string"){
                if(BUILTIN_FUNCTIONS.includes(stmt.name)){
                    const wanted_args = BUILTIN_FUNCTIONS_ARG[stmt.name].length
                    if(wanted_args !== 'any' && wanted_args !== stmt.arg_list.length){
                        const hint = BUILTIN_FUNCTIONS_ARG[stmt.name].hint
                        throw new Error(error(stmt._loc, `调用函数${stmt.name}传参数量错误,当前传参为${stmt.arg_list},期待传参为${hint}`)) 
                    }
                }
                else{
                    const msg = `你是否想使用函数 ${getMostNearName(BUILTIN_FUNCTIONS,stmt.name)} ?`
                    throw new Error(error(stmt._loc, `不支持的函数调用 ${stmt.name},${msg} `))
                }
            }
            /**
             * 暂未支持用户自定义函数
             */
            break;
        }
        case splitjoinNode: generateSplitjoin(stmt); break;
        case pipelineNode: generatePipeline(stmt); break;
        case sequentialNode: generateSequential(stmt); break;
        case addNode: generateStmt(stmt.content); break
        case compositeCallNode: {
            /** 检查传入的参数是否存在 以及 获得参数值 FIXME */
            if(! symbolTableList[0].compTable[stmt.compName]){
                throw new Error(error(stmt._loc, `此处调用的 composite 未定义:${stmt.compName}`))
            }
            break
        }
        case Array: stmt.forEach(stmt => generateStmt(stmt)); break;
        default: {
            if (ignoreTypes.some(ignoreType => stmt instanceof ignoreType)) {
                /** 这些类型不需要在生成符号表这一步进行处理,可暂时跳过 */
            } else {
                console.warn(`[generateStmt] FIXME: 暂未识别的 stmt 类型 ${stmt.constructor.name}`)
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
        stream_dlc._loc = decl._loc
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
    setTop(new SymbolTable(top, composite._loc))

    if(!composite.body) throw new Error(error(call._loc, `调用的${composite.compName}没有body,编译中止`))

    composite._symbol_table = top;
    isInOperator = false;

    // 第一步 解析 param
    let param = composite.body.param;
    const paramNames = []
    if(param && param.param_list){
        (param.param_list|| []).forEach((decl,index) => { 
            const name = decl.identifier.name
            const variable = new Variable(decl.type,name,params[index],decl._loc);
            top.InsertIdentifySymbol(variable)
            paramNames.push(decl.identifier.name)
        })
    }
    top.paramNames = paramNames

    // 第二步, 处理 inputs 和 outputs
    // 例子 composite Test(input stream<int x>In1, output stream<int x>Out1, stream<int x>Out2)
    if(composite.inout){
        composite.inout.input_list.forEach((inDecl, inIndex) => {
            let prevStream = top.prev.streamTable[call.inputs[inIndex]]
            const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(inDecl.strType);
            if(isTypeOK){
                top.streamTable[inDecl.id] = prevStream
            }else{
                throw new Error(error(call._loc, `调用${composite.compName}时输入流类型与定义不吻合`))
            }
        })
        composite.inout.output_list.forEach((outDecl, outIndex) => {
            let prevStream = top.prev.streamTable[call.outputs[outIndex]]
            const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(outDecl.strType);
            if(isTypeOK){
                top.streamTable[outDecl.id] = prevStream
            }else{
                throw new Error(error(call._loc, `调用${composite.compName}时输出流类型与定义不吻合`))
            }
        })
    }

    // 第三步, 确认该composite的param和输入输出流都没问题后, 开始解析其body
    composite.body.stmt_list.forEach(stmt => generateStmt(stmt))

    return top
}