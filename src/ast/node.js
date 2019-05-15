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
    constructor(loc,type, init_declarator_list) {
        super(loc)
        this.type = type
        this.init_declarator_list = init_declarator_list || []
    }
}

export class declarator extends Node {
    constructor(loc,identifier, op1, parameter, op2,initializer) {
        super(loc)
        if (identifier instanceof declarator) error("暂时不支持 declarator 的嵌套")
        Object.assign(this,{
            identifier,
            op1,parameter,
            op2,
            initializer
        })
    }
}
/********************************************************/
/*              1.2 function.definition 函数声明          */
/********************************************************/
export class function_definition extends Node {
    constructor(loc,type, declarator, compound) {
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
    constructor(loc,type, declarator) {
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
        Object.assign(this,{ head,body })
    }
}
export class compHeadNode extends Node {
    constructor(loc, compName, inout) {
        super(loc)
        Object.assign(this, { op:'composite',compName, inout })
    }
}
export class ComInOutNode extends Node {
    constructor(loc, input_list, output_list) {
        super(loc)
        Object.assign(this, { op1: 'input', input_list, op2: 'output', output_list })
    }
}
export class inOutdeclNode extends Node {
    constructor(loc, strType,id) {
        super(loc)
        Object.assign(this, {strType,id})
    }
}
export class strdclNode extends Node {
    constructor(loc, type, identifier) {
        super(loc)
        this.id_list = [
            { type, identifier}
        ]
    }
}
/********************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement   */
/********************************************************/
export class blockNode extends Node {
    constructor(loc,op1, stmt_list, op2) {
        super(loc)
        Object.assign(this, { op1, stmt_list, op2 })
    }
}
export class jump_statement extends Node{
    constructor(loc,op1,op2){
        super(loc)
        Object.assign(this, { op1, op2 })
    }
}
export class labeled_statement extends Node {
    constructor(loc,op1,op2,op3,statement) {
        super(loc)
        Object.assign(this, { op1, op2,op3,statement })
    }
}
export class selection_statement extends Node{
    constructor(loc,op1,op2,exp,op3,statement,op4,else_statement){
        super(loc)
        Object.assign(this,{
            op1,op2,exp,op3,
            statement, op4, else_statement
        })
    }
}
export class whileNode extends Node{
    constructor(loc,exp,statement){
        super(loc)
        Object.assign(this,{
            type:'while',
            op1:'(',
            exp,
            op2:')',
            statement
        })
    }
}
export class doNode extends Node {
    constructor(loc, exp,statement) {
        super(loc)
        Object.assign(this, {
            type:'do',
            op1:'(',
            statement,
            op2:')',
            op3:'while',
            exp
        })
    }
}
export class forNode extends Node {
    constructor(loc,init,cond,next,statement) {
        super(loc)
        Object.assign(this,{
            type:'for',
            op1:'(',
            init,cond,next,
            op2:')',
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
        this._value = NaN
        definePrivate(this, '_value')
        //检查是否有常量传播插件提供的 getValue 函数
        if (expNode.prototype.getValue) {
            expNode.prototype.getValue.call(this)
        }
    }
}

export class unaryNode extends expNode {
    constructor(loc,first, second) {
        super(loc)
        Object.assign(this, { first, second })
    }

};

export class binopNode extends expNode {
    constructor(loc,left, op, right) {
        super(loc)
        Object.assign(this, { left, op, right })
    }
}

export class ternaryNode extends expNode {
    constructor(loc,first, second, third) {
        super(loc)
        Object.assign(this, { first, op1: '?', second, op2: ':', third })
    }
}

export class parenNode extends expNode {
    constructor(loc,exp) {
        super(loc)
        Object.assign(this, { op1: '(', exp, op2: ')' })
    }
}
export class arrayNode extends expNode{
    constructor(loc,exp,arg){
        super(loc)
        if(exp instanceof arrayNode){
            this.exp = exp.exp
            this.arg_list = exp.arg_list.slice().concat(arg)
        }else{
            this.exp = exp
            this.arg_list = [arg]
        }
    }
}
export class callNode extends expNode{
    constructor(loc,name,arg_list){
        super(loc)
        this.name = name
        this.op1 = '('
        this.arg_list = arg_list
        this.op2 = ')'
    }
}
export class constantNode extends expNode {
    constructor(loc,sourceStr) {
        super(loc)
        //判断这个常量是数字还是字符串
        this.source = sourceStr
        if (!Number.isNaN(Number(sourceStr))) {
            this._value = Number(sourceStr)
        }
        this._value = sourceStr
    }
}