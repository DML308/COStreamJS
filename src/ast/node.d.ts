import { SymbolTable } from "../FrontEnd/symbol"

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
    identifier: idNode
    op?:'='
    initializer: any
    type:string
    constructor(loc: YYLTYPE, identifier: idNode, initializer: any)

}
export class idNode extends Node{
    name:string //例如处理 int foo[10]={1,2,3} 时, name 存储的是 foo
    isArray: Boolean
    /* 对于 a[1][2],arg_list 的值为[1,2]
     * 对于 a[], arg_list 值为 [0] //如果做了语义检查后还存在数组的长度为0,则抛出错误
     * 对于 a[][5],arg_list 的值为[0,5]
     * 对于 a[x] , 则在常量传播的步骤中为 x 确定具体值
     * 对于 a[] = {0,1,2}, 则在语义检查的步骤中动态计算出长度3,然后设置 arg_list=[3]
     */
    arg_list: Array<number|string> 

    constructor(loc:YYLTYPE,name:string,arg?:number|string)
}
export class declareNode extends Node {
    type: string | strdclNode
    init_declarator_list: declarator[] | string[]

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
/********************************************************/
/*        2. composite                                  */
/********************************************************/
export class compositeNode extends Node {
    compName: string
    inout: ComInOutNode
    body: compBodyNode
    _symbol_table: SymbolTable
    constructor(loc: YYLTYPE, head: compHeadNode, body: compBodyNode)
}
export class compHeadNode extends Node {
    compName: string
    inout: ComInOutNode
    constructor(loc, compName: string, inout: ComInOutNode)
}
export class ComInOutNode extends Node {
    input_list: inOutdeclNode[]
    output_list: inOutdeclNode[]
    constructor(loc, input_list?: inOutdeclNode[], output_list?:inOutdeclNode[])
}
export class inOutdeclNode extends Node {
    strType: strdclNode
    id: string
    constructor(loc, strType: strdclNode, id: string)
}
export class strdclNode extends Node {
    id_list: Array<{type:string, identifier:string}>
    constructor(loc, type:string, identifier: string)
}
export class compBodyNode extends Node {
    param: paramNode 
    stmt_list: Node[]
    constructor(loc: YYLTYPE, param: paramNode, stmt_list: Node[])
}
export class paramNode extends Node {
    op?:'param'
    param_list?:declarator[]
    
    constructor(loc:YYLTYPE, param_list?:declarator[]) 
}
export class operBodyNode extends Node{
    stmt_list: Node[]
    op1: 'init'
    init: blockNode
    op2: 'work'
    work: blockNode
    op3: 'win'
    win: winStmtNode[]

    constructor(loc: YYLTYPE, stmt_list: Node[], init:blockNode, work: blockNode, window: winStmtNode[]) 
}

export class winStmtNode extends Node {
    winName: string
    type: 'sliding' | 'tumbling'
    arg_list: number[]
    constructor(loc, winName:string, { type:string, arg_list })
}
/********************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement   */
/********************************************************/
export type statement = blockNode | binopNode | forNode | operatorNode | splitjoinNode | pipelineNode

export class blockNode extends Node {
    op1: '{'
    stmt_list: Node[]
    op2: '}'
    _symbol_table: SymbolTable
    constructor(loc: YYLTYPE, op1: '{', stmt_list: Node[], op2: '}')
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
    exp: expNode
    statement: Node
    constructor(loc, exp:expNode, statement: Node)
}
export class doNode extends Node {
    type: 'do'
    statement: Node | blockNode
    exp: Node 
    constructor(loc, exp: Node, statement: Node)
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
    left: exp | string
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
    name: expNode | string
    arg_list: expNode[]
    constructor(loc, name: expNode|string, arg_list: expNode[])
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
    inputs?: string[]
}
export class compositeCallNode extends operNode {
    compName: string
    inputs?: string[]
    params: expNode[]
    _symbol_table: SymbolTable

    constructor(loc: YYLTYPE, compName: string, inputs?: string[], params?: expNode[])
}
export class operatorNode extends operNode {
    operName: string
    inputs: string[]
    operBody: operBodyNode
    _symbol_table: SymbolTable
    constructor(loc: YYLTYPE, operName: string, inputs: string[], operBody: operBodyNode)
}
export class splitjoinNode extends operNode {
    compName: string
    inputs?: string[]
    stmt_list: statement[]
    split: splitNode
    body_stmts: statement[]
    join: joinNode
    replace_composite: compositeNode

    constructor(loc: YYLTYPE, options: object)
}
export class pipelineNode extends operNode {
    compName: "pipeline"
    inputs?: string[]
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

/********************************************************/
/* 矩阵相关 node                       */
/********************************************************/

export class matrix_constant extends Node {
    /** rawData 是存储矩阵原始数据的多维数组. 维数不确定, 1/2/3维分别可表示 向量/矩阵/矩阵数组 */
    rawData: [exp] | [[exp]] | [[[exp]]]
    /** shape 表示矩阵相关数据的维度, 例如一维向量shape为[5], 二维矩阵为[5,5], 图像 RGB 矩阵为[3,28,28]*/
    shape: number[]
    constructor(loc: YYLTYPE, rawData: Array<exp, matrix_constant>)
}

/* 存放矩阵切片的下标, 例如 vector[0:5] 表示 下标[0,5) 即0~5不含5 
   兼容多重格式(_表示 undefined), 例如
   * [1:5] --- { start: 1, op:':', end: 5 }
   * [1:]  --- { start: 1, op:':', end: _ }
   * [:5]  --- { start: _, op:':', end: 5 }
   * [:]   --- { start: _, op:':', end: _ }
   * [0]   --- { start: 0, op: _ , end: _ }   */
export class matrix_slice_pair extends Node {
    start?: number 
    op?: ':'
    end?: number
    constructor(loc, start, op, end)
}

/** 存放 name[1:4, 2:5] 的结构, 寓意为矩阵切片结果, 也可存储 Out[0]等流变量寻址 */
export class matrix_section extends expNode{
    exp:string
    slice_pair_list: matrix_slice_pair[]
    constructor(loc, exp, slice_pair_list)
}