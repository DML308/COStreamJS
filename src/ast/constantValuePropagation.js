import { expNode,unaryNode, binopNode, ternaryNode, parenNode, idNode } from "./node.js"
import { error } from "../utils/color.js"

/**
 * 加载常量传播插件,加载该插件后,表达式 node 可以计算数值
 */
export function loadCVPPlugin() {

    expNode.prototype.getValue = function(){
        //异步计算 value 值, 为了常量传播保留这个接口
        Object.defineProperty(this, 'value', {
            enumerable: false,
            get: function () {
                if (!Number.isNaN(this._value)) return this._value
                else {
                    return (this.getValue && (this._value = this.getValue())) || NaN
                }
            },
            set: function () {
                error("请不要手动给 value 赋值. 请给 _value 赋值,然后 value 会基于 _value 计算而来", this)
            }
        })
    }
    ternaryNode.prototype.getValue = function (){
        return this.first.value ? this.second.value : this.third.value
    }
    parenNode.prototype.getValue = function(){
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
            '^': (a, b) => a.value ^ b.value,
            '==': (a, b) => a.value == b.value,
            '!=': (a, b) => a.value != b.value,
            '<=': (a, b) => a.value <= b.value,
            '>=': (a, b) => a.value >= b.value,
        }
        if (this.op in handlers) {
            return this._value = handlers[this.op](this.left, this.right)
        }
        else {
            return NaN
        }
    }
    
    /**
     * 获得 idNode 的值, 完善符号表后即可求得该值
     */
    idNode.prototype.getValue = function(){
        return NaN
    }
}