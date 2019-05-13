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
/*************************************************************************/
/*              1.1 declaration                                         */
/*************************************************************************/
export class declareNode extends Node{
    constructor(type, init_declarator_list,loc){
        super(loc)
        this.type = type
        this.init_declarator_list = init_declarator_list || []
    }
}

export class declarator extends Node{
    constructor(identifier,loc,op1,op2,parameter){
        super(loc)
        if(identifier instanceof declarator) error("暂时不支持 declarator 的嵌套")
        this.identifier = identifier
        this.op1 = op1
        this.parameter = parameter
        this.op2 = op2
        this.op = undefined
        this.initializer = undefined
    }
}
/*************************************************************************/
/*        4. expression 计算表达式头节点                                    */
/*************************************************************************/

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
    constructor(first, second, loc) {
        super(loc)
        Object.assign(this, { first, second })
    }

};

export class binopNode extends expNode {
    constructor(left, op, right, loc) {
        super(loc)
        Object.assign(this, { left, op, right })
    }
}

export class ternaryNode extends expNode {
    constructor(first, second, third, loc) {
        super(loc)
        Object.assign(this, { first, second, third })
    }
}

export class parenNode extends expNode {
    constructor(exp, loc) {
        super(loc)
        this.exp = exp
    }
}

// export class idNode extends expNode {
//     constructor(name, loc) {
//         super(loc)
//         this.name = name
//     }
// }

export class constantNode extends expNode {
    constructor(sourceStr, loc) {
        super(loc)
        //判断这个常量是数字还是字符串
        this.source = sourceStr
        if(!Number.isNaN(Number(sourceStr))){
            this._value = Number(sourceStr)
        }
        this._value = sourceStr
    }
}