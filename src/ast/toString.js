import { jump_statement, blockNode, expNode, labeled_statement, forNode } from "./node.js"
import { error } from "../utils"

/**
* 加载toString插件,加载该插件后, statement 类型的节点可以执行 toString 用于代码生成
*/
export function loadToStringPlugin() {
    //将每一行 statement 的';'上提至 blockNode 处理
    blockNode.prototype.toString = function () {
        var str = '{';
        this.stmt_list && this.stmt_list.forEach((node) => {
            str += node.toString()
            if ([expNode].some(x => node instanceof x)) {
                str += ';'
            }
            str += '\n'
        })
        return str + '}\n'
    }
    jump_statement.prototype.toString = function () {
        var str = this.op1 + ' '
        str += this.op2 ? this.op2 + ' ' : ''
        return str
    }
    labeled_statement.prototype.toString = function () {
        var str = this.op1 + ' '
        str += this.op2 ? this.op2 : ''
        return str + ' ' + this.op3 + this.statement.toString()
    }
    //TODO:未完成,待填充
    expNode.prototype.toString = function () {
        return this.value
    }
    forNode.prototype.toString = function () {
        var str = 'for('
        str += this.init ? this.init.toString() + ';' : ';'
        str += this.cond ? this.cond.toString() + ';' : ';'
        str += this.next ? this.next.toString() : ''
        str += ')' + this.statement.toString()
        return str
    }
}