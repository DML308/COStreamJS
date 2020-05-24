import { expNode, unaryNode, binopNode, ternaryNode, parenNode, callNode, constantNode, castNode } from "./node.js"
import { error } from "../utils"
import { top } from "../FrontEnd/global"
import { matrix_section } from "./node.js"
import { matrix_constant } from "./node.js"

/**
 * 加载常量传播插件后,表达式 node 可以计算数值
 */

expNode.prototype.getValue = function () {
    //异步计算 value 值, 为了常量传播保留这个接口
    Object.defineProperty(this, 'value', {
        enumerable: false,
        get: function () {
            return this.getValue()
        },
        set: function () {
            error("请不要手动给 value 赋值.", this)
        }
    })
}
ternaryNode.prototype.getValue = function () {
    return this.first.value ? this.second.value : this.third.value
}
parenNode.prototype.getValue = function () {
    return this.exp.value
}
/**
* 目前只是简单计算值,后续常量传播时要修改此函数
*/
unaryNode.prototype.getValue = function () {
    if (this.first == "+") return this.second.value
    if (this.first == "-") return -this.second.value
    if (this.first == "~") return ~this.second.value
    if (this.first == "!") return !this.second.value
    if(this.first == "++"){ // ++i 的情况
        if(typeof this.second !== 'string') error(this._loc, `++ 运算符的操作对象必须是变量`)
        let oldVal = top.getVariableValue(this.second)
        top.setVariableValue(this.first, oldVal+1)
        return oldVal+1

    }else if(this.second == "++"){ // i++ 的情况
        if(typeof this.first !== 'string') error(this._loc, `++ 运算符的操作对象必须是变量`)
        let oldVal = top.getVariableValue(this.first)
        top.setVariableValue(this.first, oldVal+1)
        return oldVal
    } 
    return NaN
}

castNode.prototype.getValue = function (){
    return this.type == 'int' ? Math.floor(this.exp.value) : this.exp.value
}

Object.defineProperty(String.prototype,'value',{
    get(){
        if(!Number.isNaN(parseFloat(this))){
            return parseFloat(this); // 如果这个字符串本身就是一个数字, 则直接返回, 例如'0;
        }
        return top.LookupIdentifySymbol(this).value; 
    }
})
Object.defineProperty(Number.prototype,'value',{
    get(){
        return this
    }
})

binopNode.prototype.getValue = function () {
    var handlers = {
        '+': (a, b) => a.value + b.value,
        '-': (a, b) => a.value - b.value,
        '*': (a, b) => a.value * b.value,
        '/': (a, b) => a.value / b.value,
        '%': (a, b) => a.value % b.value,
        '|': (a, b) => a.value | b.value,
        '&': (a, b) => a.value & b.value,
        '^': (a, b) => a.value ^ b.value,
        '<': (a, b) => a.value < b.value,
        '>': (a, b) => a.value > b.value,
        '==': (a, b) => a.value == b.value,
        '!=': (a, b) => a.value != b.value,
        '<=': (a, b) => a.value <= b.value,
        '>=': (a, b) => a.value >= b.value,
        '>>': (a, b) => a.value >> b.value,
        '<<': (a, b) => a.value << b.value,
        //c++ 与 js 不同, c++的条件表达式返回 bool 值,而 js 是动态值
        '||': (a, b) => !!(a.value || b.value),
        '&&': (a, b) => !!(a.value && b.value),
        '=' : (a, b) => top.setVariableValue(a, b.value),
        '+=': (a, b) => top.setVariableValue(a, a.value + b.value),
        '-=': (a, b) => top.setVariableValue(a, a.value - b.value),
        '*=': (a, b) => top.setVariableValue(a, a.value * b.value),
        '/=': (a, b) => top.setVariableValue(a, a.value / b.value),
    }
    if (this.op in handlers) {
        return this._value = handlers[this.op](this.left, this.right)
    }
    else {
        return NaN
    }
}

callNode.prototype.getValue = function () {
    return NaN
}

constantNode.prototype.getValue = function(){
    return Number(this.source)
}

matrix_section.prototype.getValue = function(){
    let values = top.LookupIdentifySymbol(this.exp).array.values
    debugger;
    if(this.slice_pair_list.length == 1){
        let index = this.slice_pair_list[0].start
        return values[index].val
    }else{
        throw new Error("FIXME 目前只处理了数组取地址, 未处理矩阵取址")
    }
}
matrix_constant.prototype.getValue = function(){
    return this
}