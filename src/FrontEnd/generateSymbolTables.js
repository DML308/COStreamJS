import { SymbolTable, symbol_tables } from "./symbol";
import * as Node from "../ast/node";

let top;
let saved = [];

function EnterScope(loc){ 
    saved.push(top);
    top = new SymbolTable(top,loc);
}

function ExitScope(){
    top = saved.pop();
}

/**
 * 生成符号表
 */
export function generateSymbolTables(program){
    symbol_tables.length = 0;
    let S = new SymbolTable();
    S.pre = null;
    S.loc = {first_line:0};
    symbol_tables.push(S);
    top = S;
    
    program.forEach(node => {
        if(node instanceof Node.declareNode){
            generateDeclareNode(node);
        }
        else if(node instanceof Node.compositeNode){
            top.InsertCompositeSymbol(node);
            EnterScope(node._loc);
            generateComposite(node);
            ExitScope();
        } 
        else if(node instanceof Node.function_definition){
            top.InsertFunctionSymbol(node);
        }       
    });
    symbol_tables.sort((a,b)=>a.loc.first_line - b.loc.first_line)
    return S;
}

function generateDeclareNode(node){
    node.init_declarator_list.forEach(init_node=>top.InsertIdSymbol(init_node,init_node.identifier.name))
    //todo: check node.initializer 
}
function generateStrDlc(node){
    node.init_declarator_list.forEach(id_node=>top.InsertIdSymbol(node.type,id_node));
    
}
function generateComposite(node){
    let inout = node.inout;
    let body = node.body;

    // 参数列表 加入到符号表中
    let input_list = inout && inout.input_list;
    let output_list = inout && inout.output_list;

    if(input_list){
        input_list.forEach(node=>top.InsertIdSymbol(node.strType,node.id))
    }
    if(output_list){
        output_list.forEach(node=>top.InsertIdSymbol(node.strType,node.id))
    }

    //解析body
    let param = body && body.param;
    let body_stmt = body && body.stmt_list;
    
    if(param){
        param.param_list.forEach(node=>top.InsertIdSymbol(node,node.identifier.name))
    }

    if(body_stmt){
        body_stmt.forEach(node=>generateStmt(node))
    }

}

function generateBlock(node){
    node.stmt_list.forEach(stmt=>generateStmt(stmt))
}

function generateWindow(node){
    node.forEach(win_node=>{
        //todo check
        checkId(win_node.winName);
        if(win_node.arg_list){
            win_node.arg_list.forEach(arg_node=>generateStmt(arg_node))
        }
    })
}

function generateOperator(node){
    let inputs = node.inputs;
    let outputs = node.outputs;
    let body = node.operBody
    if(inputs){
        //todo check
        inputs.forEach(input=>checkId(input))
    }
    if(outputs){
        //todo check
        outputs.forEach(output=>checkId(output))
    }
    if(body){
        if(body.stmt_list){
            body.stmt_list.forEach(stmt=>generateStmt(stmt))
        }
        if(body.init){
            generateStmt(body.init);
        }
        if(body.work){
            EnterScope(body.work._loc);
            generateStmt(body.work);
            ExitScope();
        }
        //check
        if(body.win){
            generateWindow(body.win);
        }
    }
}

function generateSplitjoin(node){
    //check
    if(node.inputs){
        node.inputs.forEach(input=>generateStmt(input))
    }
    //check
    if(node.outputs){
        node.outputs.forEach(output=>generateStmt(output))
    }
    if(node.stmt_list){
        node.stmt_list.forEach(stmt=>generateStmt(stmt))
    }
    //check
    if(node.split.arg_list){
        node.split.arg_list.forEach(arg_ndoe=>generateStmt(arg_list))
    }
    if(node.body_stmts){
        node.body_stmts.forEach(stmt=>generateStmt(stmt))
    }
    //check
    if(node.join.arg_list){
        node.join.arg_list.forEach(arg_ndoe=>generateStmt(arg_list))
    }
}

function generatePipeline(node){
    //check
    if(node.inputs){
        node.inputs.forEach(input=>generateStmt(input))
    }
    //check
    if(node.outputs){
        node.outputs.forEach(output=>generateStmt(output))
    }
    if(node.body_stmts){
        node.body_stmts.forEach(stmt=>generateStmt(stmt))
    }
}

function generateExp(node){

}

function generateStmt(node){
    // todo check
    if(node instanceof Node.binopNode){
        if(node.op === '.'){
            //读取 stream 中的变量
            return ;
        }
        generateStmt(node.left);
        generateStmt(node.right);
    }
    else if(node instanceof Node.declareNode){
        if(node.type instanceof Node.strdclNode){
            generateStrDlc(node);
        }
        else{
            generateDeclareNode(node);
        }
        
    }
    // todo check
    else if(node instanceof Node.unaryNode){
        generateStmt(node.second);
    }
    // todo check
    else if(node instanceof Node.parenNode){
        generateStmt(node.exp)
    }
    // todo check
    else if(node instanceof Node.arrayNode){
        checkId(node.exp);
        node.arg_list.forEach(arg_node=>{
            // arg_node:string constant exp
            generateStmt(arg_node)
        })
        generateStmt(node.exp)
    }
    //todo check
    else if(typeof node === 'string'){
        checkId(node);
    }
    //todo check
    else if(node instanceof Node.compositeCallNode){
        checkComposite(node.compName);
        if(node.inputs){
            node.inputs.forEach(input_node=>{
                generateStmt(input_node);
            })
        }
        node.params&& generateStmt(node.params);
        
    }
    //todo check
    else if(node instanceof callNode){
        checkFunction(node.name);
        node.arg_list.forEach(arg_node=>{
            //arg_ndoe : exp
            generateStmt(arg_node);
        })
    }
    else if(node instanceof Node.operatorNode){
        EnterScope(node._loc);
        generateOperator(node);
        ExitScope();
    }
    else if(node instanceof Node.splitjoinNode){
        generateSplitjoin(node);
    }
    else if(node instanceof Node.pipelineNode){
        generatePipeline(node);
    }
    else if(node instanceof Node.whileNode){
        EnterScope(node._loc);
        generateStmt(node.exp);
        generateStmt(node.statement);
        ExitScope();
    }
    else if(node instanceof Node.doNode){
        EnterScope(node._loc);
        generateStmt(node.exp);
        generateStmt(node.statement);
        ExitScope();
    }
    else if(node instanceof Node.forNode){
        EnterScope(node._loc);
        generateStmt(node.init);
        generateStmt(node.cond);
        generateStmt(node.next);
        generateStmt(node.statement);
        ExitScope();
    }
    else if(node instanceof Node.blockNode){
        generateBlock(node);
    }
    
}

function checkId(){

}

function checkComposite(){

}

function checkFunction(){

}