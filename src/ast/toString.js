import { jump_statement, blockNode, expNode, labeled_statement, forNode, declareNode, declarator, compositeNode, ComInOutNode, compBodyNode, inOutdeclNode, strdclNode, paramNode, parameter_declaration, binopNode, operatorNode, operBodyNode, arrayNode, constantNode, unaryNode, winStmtNode } from "./node.js"

export function ast2String(root) {
    var result = ''
    root.forEach((x, idx) => {
        result += x.toString() + (x instanceof declareNode ? ';' : '') + '\n'
    })
    return result.replace(/ {2,}/g, ' ').beautify()
}
/**
 * 输入一个 list 返回它转化后的 string, 可以配置分隔符 split 例如','
 * 也可以配置 start 和 end 例如'{' '}'
 */
function list2String(list, split, start, end) {
    if (!list || list.length == 0) return ''
    var str = start ? start : ''
    list.forEach((x, idx) => {
        str += x.toString()
        str += split && idx < list.length - 1 ? split : ''
    })
    return end ? str + end : str
}

/**
* 加载toString插件,加载该插件后, statement 类型的节点可以执行 toString 用于代码生成或调试
*/
export function loadToStringPlugin() {
    declarator.prototype.toString = function () {
        var str = this.identifier.toString() + ' '
        str += this.op1 ? this.op1 : ''
        str += this.parameter ? this.parameter.toString() : ''
        str += this.op2 ? this.op2 : ''
        if (this.initializer instanceof Array) {
            str += list2String(this.initializer, ',', '{', '}')
        } else {
            str += this.initializer ? this.initializer.toString() : ''
        }
        return str
    }
    declareNode.prototype.toString = function () {
        return this.type + ' ' + list2String(this.init_declarator_list, ',')
    }
    compositeNode.prototype.toString = function () {
        var str = 'composite ' + this.compName + '('
        str += this.inout ? this.inout.toString() : ''
        str += ')' + this.body.toString()
        return str
    }
    ComInOutNode.prototype.toString = function () {
        return 'input ' + list2String(this.input_list) + ', ouput ' + list2String(this.output_list)
    }
    inOutdeclNode.prototype.toString = function () {
        return this.strType.toString() + this.id
    }
    strdclNode.prototype.toString = function () {
        var str = 'stream<'
        this.id_list.forEach(({ type, identifier }) => {
            str += type + ' ' + identifier + ','
        })
        return str.slice(0, -1) + '>'
    }
    compBodyNode.prototype.toString = function () {
        var str = '{\n'
        str += this.param ? this.param.toString() : ''
        str += list2String(this.stmt_list, ';\n') + '\n}\n'
        return str
    }
    paramNode.prototype.toString = function () {
        return 'param\n  ' + list2String(this.param_list, ',')+';\n'
    }
    parameter_declaration.prototype.toString = function () {
        return this.type + ' ' + this.declarator.toString()
    }
    //将每一行 statement 的';'上提至 blockNode 处理
    blockNode.prototype.toString = function () {
        var str = '{\n';
        str += list2String(this.stmt_list, ';\n')
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
    //expNode 的子类
    binopNode.prototype.toString = function () {
        return this.left + this.op + this.right
    }
    arrayNode.prototype.toString = function () {
        return '' + this.exp + list2String(this.arg_list, '][', '[', ']')
    }
    constantNode.prototype.toString = function () {
        return this.value
    }
    unaryNode.prototype.toString = function () {
        return '' + this.first + this.second
    }
    operatorNode.prototype.toString = function () {
        var str =  this.operName + '(' 
        str+= this.inputs ? this.inputs :''
        return str + ')' + this.operBody 
    }
    operBodyNode.prototype.toString = function () {
        var str = '{\n' 
        str += this.stmt_list ? list2String(this.stmt_list, ';\n')+';\n' :''
        str += this.init ? 'init' + this.init : ''
        str += this.work ? 'work' + this.work : ''
        str += this.win ? 'window{' + list2String(this.win,';\n')+';\n'+'}' : ''
        return str + '\n}\n'
    }
    winStmtNode.prototype.toString = function(){
        return this.winName+' '+this.type+'('+list2String(this.arg_list,',')+')'
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