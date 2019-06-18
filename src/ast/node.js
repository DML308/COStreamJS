import { definePrivate } from "./js-hacker.js"
import { error } from "../utils";

export class Node {
    constructor(loc) {
        this._loc = loc;
        ['_loc'].forEach(key => {
            definePrivate(this, key)
        })
    }
}
/********************************************************/
/*              1.1 declaration                         */
/********************************************************/
export class declareNode extends Node {
    constructor(loc, type, init_declarator_list) {
        super(loc)
        this.type = type
        this.init_declarator_list = [].concat(init_declarator_list)
    }
}
export class idNode extends Node{
    constructor(loc, name, arg){
        super(loc)
        this.name = name
        this.arg_list = []
        if(arg){
            this.isArray = true
            this.arg_list.push(arg)
        } 
    }
}
export class declarator extends Node {
    constructor(loc, identifier, initializer) {
        super(loc)
        this.identifier = identifier
        initializer && (this.op = '=')
        this.initializer = initializer
        definePrivate(this, 'type')
    }
}
/********************************************************/
/*              1.2 function.definition 函数声明          */
/********************************************************/
export class function_definition extends Node {
    constructor(loc, type, declarator,param_list, compound) {
        super(loc)
        this.type = type
        this.name = declarator.name
        this.op1 = '('
        this.param_list = param_list
        this.op2 = ')'
        this.funcBody = compound
    }
}
export class parameter_declaration extends Node {
    constructor(loc, type, declarator) {
        super(loc)
        this.type = type
        this.declarator = declarator
    }
}
/********************************************************/
/*        2. composite                                  */
/********************************************************/
export class compositeNode extends Node {
    constructor(loc, head = {}, body = {}) {
        super(loc)
        Object.assign(this, {
            op: 'composite',
            compName: head.compName,
            inout: head.inout,
            body
        })
    }
}
export class compHeadNode extends Node {
    constructor(loc, compName, inout) {
        super(loc)
        Object.assign(this, { op: 'composite', compName, inout })
    }
}
export class ComInOutNode extends Node {
    constructor(loc, input_list, output_list) {
        super(loc)
        Object.assign(this, { op1: 'input', input_list, op2: 'output', output_list })
    }
}
export class inOutdeclNode extends Node {
    constructor(loc, strType, id) {
        super(loc)
        Object.assign(this, { strType, id })
    }
}
export class strdclNode extends Node {
    constructor(loc, type, identifier) {
        super(loc)
        this.op = 'stream<'
        this.id_list = [
            { type, identifier }
        ]
        this.op2 = '>'
    }
}
export class compBodyNode extends Node {
    constructor(loc, param, stmt_list) {
        super(loc)
        Object.assign(this, {
            op1: '{',
            param,
            stmt_list,
            op2: '}'
        })
    }
}
export class paramNode extends Node {
    constructor(loc, param_list) {
        super(loc)
        if (param_list) {
            this.op = 'param'
        }
        this.param_list = param_list
    }
}
export class operBodyNode extends Node {
    constructor(loc, stmt_list, init, work, win) {
        super(loc)
        Object.assign(this, {
            stmt_list,
            op1: 'init', init,
            op2: 'work', work,
            op3: 'window', win
        })
    }
}
export class winStmtNode extends Node {
    constructor(loc, winName, options ={}) {
        super(loc)
        Object.assign(this, {
            winName,
            type: options.type,
            arg_list: options.arg_list
        })
    }
}
/********************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement   */
/********************************************************/
export class blockNode extends Node {
    constructor(loc, op1, stmt_list, op2) {
        super(loc)
        Object.assign(this, { op1, stmt_list, op2 })
    }
}
export class jump_statement extends Node {
    constructor(loc, op1, op2) {
        super(loc)
        Object.assign(this, { op1, op2 })
    }
}
export class labeled_statement extends Node {
    constructor(loc, op1, op2, op3, statement) {
        super(loc)
        Object.assign(this, { op1, op2, op3, statement })
    }
}
export class selection_statement extends Node {
    constructor(loc, op1, op2, exp, op3, statement, op4, else_statement) {
        super(loc)
        Object.assign(this, {
            op1, op2, exp, op3,
            statement, op4, else_statement
        })
    }
}
export class whileNode extends Node {
    constructor(loc, exp, statement) {
        super(loc)
        Object.assign(this, {
            type: 'while',
            op1: '(',
            exp,
            op2: ')',
            statement
        })
    }
}
export class doNode extends Node {
    constructor(loc, exp, statement) {
        super(loc)
        Object.assign(this, {
            type: 'do',
            op1: '(',
            statement,
            op2: ')',
            op3: 'while',
            exp
        })
    }
}
export class forNode extends Node {
    constructor(loc, init, cond, next, statement) {
        super(loc)
        Object.assign(this, {
            type: 'for',
            op1: '(',
            init, cond, next,
            op2: ')',
            statement
        })
    }
}
/********************************************************/
/*        4. expression 计算表达式头节点                   */
/********************************************************/

export class expNode extends Node {
    constructor(loc) {
        super(loc)
        //检查是否有常量传播插件提供的 getValue 函数
        if (expNode.prototype.getValue) {
            expNode.prototype.getValue.call(this)
        }
    }
}

export class unaryNode extends expNode {
    constructor(loc, first, second) {
        super(loc)
        Object.assign(this, { first, second })
    }

};
export class castNode extends expNode {
    constructor(loc, type, exp) {
        super(loc)
        Object.assign(this, { op1: '(', type, op2: ')', exp })
    }
}

export class binopNode extends expNode {
    constructor(loc, left, op, right) {
        super(loc)
        Object.assign(this, { left, op, right })
    }
}

export class ternaryNode extends expNode {
    constructor(loc, first, second, third) {
        super(loc)
        Object.assign(this, { first, op1: '?', second, op2: ':', third })
    }
}

export class parenNode extends expNode {
    constructor(loc, exp) {
        super(loc)
        Object.assign(this, { op1: '(', exp, op2: ')' })
    }
}
export class arrayNode extends expNode {
    constructor(loc, exp, arg) {
        super(loc)
        if (exp instanceof arrayNode) {
            this.exp = exp.exp
            this.arg_list = exp.arg_list.slice().concat(arg)
        } else {
            this.exp = exp
            this.arg_list = [arg]
        }
    }
}
export class callNode extends expNode {
    constructor(loc, name, arg_list) {
        super(loc)
        this.name = name
        this.op1 = '('
        this.arg_list = arg_list
        this.op2 = ')'
    }
}
export class constantNode extends expNode {
    constructor(loc, sourceStr='') {
        super(loc)
        // 转义字符串中的 \n 等特殊字符
        this.source = (sourceStr+'').replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
    }
}
/********************************************************/
/* operNode in expression's right                       */
/********************************************************/
export class operNode extends Node {
    constructor(loc) {
        super(loc)
        this.outputs = []
    }
}
export class compositeCallNode extends operNode {
    constructor(loc, compName, inputs, params) {
        super(loc)
        Object.assign(this, {
            compName,
            op1: '(',
            inputs,
            op2: ')'
        })
        if (params) {
            Object.assign(this, {
                op3: '(',
                params,
                op4: ')'
            })
        }
        definePrivate(this, 'actual_composite')
    }
}
export class operatorNode extends operNode {
    constructor(loc, operName, inputs, operBody) {
        super(loc)
        Object.assign(this, { operName, inputs, operBody })
    }
}
export class splitjoinNode extends operNode {
    constructor(loc, options = {}) {
        super(loc)
        this.compName = options.compName
        this.inputs = options.inputs
        this.stmt_list = options.stmt_list
        this.split = options.split
        this.body_stmts = options.body_stmts
        this.join = options.join
        definePrivate(this, 'replace_composite')
    }
}
export class pipelineNode extends operNode {
    constructor(loc, options = {}) {
        super(loc)
        this.compName = options.compName
        this.inputs = options.inputs
        this.body_stmts = options.body_stmts
        definePrivate(this, 'replace_composite')
    }
}
export class splitNode extends Node {
    constructor(loc, node = {}) {
        super(loc)
        this.name = "split"
        this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin"
        if (node.arg_list) {
            Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' })
        }
    }
}
export class joinNode extends Node {
    constructor(loc, node = {}) {
        super(loc)
        this.name = "join"
        this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin"
        if (node.arg_list) {
            Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' })
        }
    }
}
export class duplicateNode extends Node {
    constructor(loc, arg_list) {
        super(loc)
        this.arg_list = arg_list
    }
}
export class roundrobinNode extends Node {
    constructor(loc, arg_list) {
        super(loc)
        this.arg_list = arg_list
    }
}
export class addNode extends Node {
    constructor(loc, content) {
        super(loc)
        this.name = "add"
        this.content = content
    }
}