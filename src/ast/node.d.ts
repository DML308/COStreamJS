export interface YYLTYPE {
    first_line: number
    last_line: number
    first_column: number
    last_column: number
}

export class Node {
    _loc?: YYLTYPE

    constructor(loc: YYLTYPE)
}
/********************************************************/
/*              1.1 declaration                         */
/********************************************************/
export class declarator extends Node {
    identifier: string | declarator
    op1: string
    parameter: any
    op2?: string
    initializer: null

    constructor(loc: YYLTYPE, identifier: string, op1: string, parameter: any, op2: string, initializer: any)

}
export class declareNode extends Node {
    type: string
    init_declarator_list: declarator[]

    constructor(loc: YYLTYPE, type: string, init_declarator_list: declarator[])
}
/********************************************************/
/*              1.2 function.definition 函数声明          */
/********************************************************/
export class function_definition extends Node {
    constructor(loc, type, declarator, compound) {
        super(loc)
        this.type = type
        this.name = declarator.identifier
        this.op1 = '('
        this.param_list = declarator.parameter
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
    constructor(loc, head, body) {
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
    constructor(loc, winName, { type, arg_list }) {
        super(loc)
        Object.assign(this, {
            winName,
            type,
            arg_list
        })
    }
}
/********************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement   */
/********************************************************/
export type statement = blockNode | binopNode | forNode | operatorNode | splitjoinNode | pipelineNode

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
    init: binopNode
    cond: binopNode
    next: unaryNode | binopNode
    statement: blockNode | statement

    constructor(loc: YYLTYPE, init: binopNode, cond: binopNode, next: unaryNode | binopNode, statement: blockNode | statement)
}
/********************************************************/
/*        4. expression 计算表达式头节点                   */
/********************************************************/

export class expNode extends Node {
    _value: number
    getValue(): number
}

type exp = expNode
type primary_expression = string | expNode
type argument_expression_list = exp[]
type operator_arguments = void | argument_expression_list
type postfix_expression = primary_expression | arrayNode | compositeCallNode | callNode | binopNode | unaryNode | operatorNode | splitjoinNode | pipelineNode;
type unary_expression = postfix_expression | unaryNode | castNode
type basic_type_name = string
type type_specifier = string
type expression = expNode | expNode[]

export class unaryNode extends expNode {
    first: string | unary_expression
    second: unary_expression | string

    constructor(loc: YYLTYPE, first: string | unary_expression, second: primary_expression | string)
};

export class castNode extends expNode {
    op1: '('
    type: basic_type_name
    op2: ')'
    exp: unary_expression

    constructor(loc: YYLTYPE, type: basic_type_name, exp: unary_expression)
}

export class binopNode extends expNode {
    left: exp
    op: string
    right: exp
    constructor(loc: YYLTYPE, left: exp, op: string, right: exp)
}

export class ternaryNode extends expNode {
    first: exp
    second: exp
    third: exp

    constructor(loc: YYLTYPE, first: exp, second: exp, third: exp)
}

export class parenNode extends expNode {
    op1: '('
    exp: exp
    op2: ')'

    constructor(loc: YYLTYPE, exp: exp)
}
export class arrayNode extends expNode {
    exp: string | arrayNode
    arg_list: expression[]
    //TODO: index: string | constantNode | binopNode
    constructor(loc: YYLTYPE, exp: exp | arrayNode, arg: expression)
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
    /** 表示常量的原字符串,例如0x10是数字16的原字符串 */
    source: string
    constructor(loc: YYLTYPE, sourceStr: string)
}
/********************************************************/
/* operNode in expression's right                       */
/********************************************************/
export class operNode extends Node {
    outputs?: string[]
}
export class compositeCallNode extends operNode {
    compName: string
    inputs?: string[]
    params?: expNode[]

    constructor(loc: YYLTYPE, compName: string, inputs?: string[], params?: expNode[])
}
export class operatorNode extends operNode {
    operName: string
    inputs: string[]
    operBody: operBodyNode
    constructor(loc: YYLTYPE, operName: string, inputs: string[], operBody: operBodyNode)
}
export class splitjoinNode extends operNode {
    compName: string
    inputs: string[]
    stmt_list: statement[]
    split: splitNode
    body_stmts: statement[]
    join: joinNode
    replace_composite: compositeNode

    constructor(loc: YYLTYPE, options: object)
}
export class pipelineNode extends operNode {
    compName: "pipeline"
    inputs: string[]
    body_stmts: statement[]
}

export class splitNode extends Node {
    name: "split"
    type: "duplicate" | "roundrobin"
    arg_list?: constantNode[]
    constructor(loc: YYLTYPE, node: duplicateNode | roundrobinNode)
}
export class joinNode extends Node {
    name: "join"
    type: "duplicate" | "roundrobin"
    arg_list?: constantNode[]
    constructor(loc: YYLTYPE, node: duplicateNode | roundrobinNode)
}

export class duplicateNode extends Node {
    arg_list: constantNode[]
}
export class roundrobinNode extends Node {
    arg_list: constantNode[]
}
export class addNode extends Node {
    name: "add"
    content: pipelineNode | splitjoinNode
    constructor(loc: YYLTYPE, content: pipelineNode | splitjoinNode)
}