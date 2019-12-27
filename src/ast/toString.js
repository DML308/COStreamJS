import { jump_statement, blockNode, idNode, expNode, labeled_statement, forNode, declareNode, declarator, compositeNode, ComInOutNode, compBodyNode, inOutdeclNode, strdclNode, paramNode, binopNode, operatorNode, operBodyNode, arrayNode, constantNode, unaryNode, winStmtNode, callNode, compositeCallNode, selection_statement, castNode, parenNode, matrix_section, matrix_constant, matrix_slice_pair } from "./node.js"
import { COStreamJS } from "../FrontEnd/global"

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
* 执行下列代码后, statement 类型的节点可以执行 toString 用于代码生成或调试
*/

declarator.prototype.toString = function () {
    var str = this.identifier.toString() + ''
    str += this.op ? this.op : ''
    if (this.initializer instanceof Array) {
        str += list2String(this.initializer, ',', '{', '}')
    } else {
        str += this.initializer ? this.initializer.toString() : ''
    }
    return str
}
idNode.prototype.toString = function(){
    return this.name + (this.arg_list.length > 0? list2String(this.arg_list, '][','[',']') :'').replace(/\[0]/g,'[]')
}
declareNode.prototype.toString = function () {
    return this.type + ' ' + list2String(this.init_declarator_list, ', ')
}
compositeNode.prototype.toString = function () {
    var str = 'composite ' + this.compName + '('
    str += this.inout ? this.inout.toString() : ''
    str += ')' + this.body.toString()
    return str
}
ComInOutNode.prototype.toString = function () {
    return 'input ' + list2String(this.input_list) + ', output ' + list2String(this.output_list)
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
    str += list2String(this.stmt_list, ';\n') + ';\n}\n'
    return str
}
paramNode.prototype.toString = function () {
    return 'param\n  ' + this.param_list.map(x=>x.type+' '+x.identifier) + ';\n'
}

const isNoSemi = node => ['blockNode', 'forNode', 'selection_statement'].includes(node.constructor.name)

//将每一行 statement 的';'上提至 blockNode 处理
blockNode.prototype.toString = function () {
    if (!this.stmt_list || this.stmt_list == 0) return '{ }'
    var str = '{\n';
    this.stmt_list.forEach(x => {
        str += x.toString()
        str += isNoSemi(x) ? '\n' :';\n'
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
//expNode 的子类
binopNode.prototype.toString = function () {
    return this.left + this.op + this.right
}
arrayNode.prototype.toString = function () {
    return '' + this.exp + list2String(this.arg_list, '][', '[', ']')
}
constantNode.prototype.toString = function () {
    let value = this.value
    return Number.isNaN(value) ? this.source : value
}
castNode.prototype.toString = function () {
    return '(' + this.type + ')' + this.exp
}
parenNode.prototype.toString = function () {
    return '(' + this.exp + ')'
}
unaryNode.prototype.toString = function () {
    return '' + this.first + this.second
}
operatorNode.prototype.toString = function () {
    var str = this.operName + '('
    str += this.inputs ? this.inputs : ''
    return str + ')' + this.operBody
}
operBodyNode.prototype.toString = function () {
    var str = '{\n'
    str += this.stmt_list ? list2String(this.stmt_list, ';\n') + ';\n' : ''
    str += this.init ? 'init' + this.init : ''
    str += this.work ? 'work' + this.work : ''
    str += this.win ? 'window{' + list2String(this.win, ';\n') + ';\n' + '}' : ''
    return str + '\n}\n'
}
winStmtNode.prototype.toString = function () {
    return this.winName + ' ' + this.type + '(' + list2String(this.arg_list, ',') + ')'
}
forNode.prototype.toString = function () {
    var str = 'for('
    str += this.init ? this.init.toString() + ';' : ';'
    str += this.cond ? this.cond.toString() + ';' : ';'
    str += this.next ? this.next.toString() : ''
    str += ')' + this.statement.toString()
    return str
}
selection_statement.prototype.toString = function () {
    if (this.op1 === 'if') {
        var str = 'if(' + this.exp + ')' + this.statement
        str += this.op4 === 'else' ? ('else' + this.else_statement) : ''
        return str
    } else if (this.op1 == 'switch') {

    }
}

const differentPlatformPrint = {
    'X86': args => 'cout<<' + list2String(args, '<<'),
    'WEB': args => 'console.log(' + list2String(args, '<<') + ')',
    'default': args => 'print(' + list2String(args, ',') + ')'
}
const differentPlatformPrintln = {
    'X86': args => 'cout<<' + list2String(args, '<<') + '<<endl',
    'WEB': args => 'console.log(' + list2String(args, '<<') + `);console.log('\n')`,
    'default': args => 'println(' + list2String(args, ',') + ')'
}
callNode.prototype.toString = function () {
    const platform = COStreamJS.options.platform

    if (this.name === "print") {
        return differentPlatformPrint[platform](this.arg_list)
    } else if (this.name === "println") {
        return differentPlatformPrintln[platform](this.arg_list)
    }
    else{
        return this.name + '(' + list2String(this.arg_list, ',') + ')'
    }
}
compositeCallNode.prototype.toString = function () {
    var str = this.compName + '('
    str += this.inputs ? list2String(this.inputs, ',') : ''
    str += ')('
    str += this.params ? list2String(this.params, ',') : ''
    return str + ')'
}
matrix_slice_pair.prototype.toString = function (){
    if(!this.op)    return this.start
    return (this.start || '')+':'+(this.end||'')
}
matrix_section.prototype.toString = function (){
    return this.exp + '[' + list2String(this.slice_pair_list,',') + ']'
}
matrix_constant.prototype.toString = function (){
    let rows = this.rawData.map(x => '[' + x.join(',') + ']')
    return list2String(rows, ',', '[', ']')
}