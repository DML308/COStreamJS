import { expNode, unaryNode, binopNode, ternaryNode, parenNode, callNode, arrayNode, constantNode } from "./node.js"
import { error } from "../utils"

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
    return NaN
}

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
        '==': (a, b) => a.value == b.value,
        '!=': (a, b) => a.value != b.value,
        '<=': (a, b) => a.value <= b.value,
        '>=': (a, b) => a.value >= b.value,
        '>>': (a, b) => a.value >> b.value,
        '<<': (a, b) => a.value << b.value,
        //c++ 与 js 不同, c++的条件表达式返回 bool 值,而 js 是动态值
        '||': (a, b) => !!(a.value || b.value),
        '&&': (a, b) => !!(a.value && b.value),
    }
    if (this.op in handlers) {
        return this._value = handlers[this.op](this.left, this.right)
    }
    else {
        return NaN
    }
}

arrayNode.prototype.getValue = function () {
    return NaN
}
callNode.prototype.getValue = function () {
    return NaN
}

constantNode.prototype.getValue = function(){
    return Number(this.source)
}