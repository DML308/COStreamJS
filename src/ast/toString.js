import { jump_statement, blockNode, idNode, expNode, labeled_statement, forNode, declareNode, declarator, compositeNode, ComInOutNode, compBodyNode, inOutdeclNode, strdclNode, paramNode, binopNode, operatorNode, operBodyNode, constantNode, unaryNode, winStmtNode, callNode, compositeCallNode, selection_statement, castNode, parenNode, matrix_section, matrix_constant, matrix_slice_pair, lib_binopNode, whileNode, doNode, splitjoinNode, addNode, splitNode, joinNode } from "./node.js"
import { COStreamJS } from "../FrontEnd/global"
import { error } from "../utils/color.js";
import { BUILTIN_MATH } from "../FrontEnd/built-in-function.js";

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
    switch(COStreamJS.options.platform){
        case 'default':
        case 'X86':
            var str = this.identifier.toString() + ''
            str += this.op ? this.op : ''
            if (this.initializer instanceof Array) {
                str += list2String(this.initializer, ',', '{', '}')
            } else {
                str += this.initializer ? this.initializer.toString() : ''
            }
            return str
            break;
        case 'WEB':
            var str = this.identifier.name
            str += this.op ? this.op : ''
            if(this.identifier.arg_list.length && !this.initializer){
                str += `= getNDArray(${this.identifier.arg_list.map(_=>_.toString()).join(',')})`

            }else if (this.initializer instanceof Array) {
                str += list2String(this.initializer, ',', '[', ']')
            } else {
                str += this.initializer ? this.initializer.toString() : ''
            }
            return str
            break
        default: return '';
    }
    
}
idNode.prototype.toString = function(){
    return this.name.toString() + (this.arg_list.length > 0? list2String(this.arg_list, '][','[',']') :'').replace(/\[0]/g,'[]')
}
declareNode.prototype.toString = function () {
    let type = COStreamJS.options.platform === 'WEB' ? 'let' : this.type
    return type + ' ' + list2String(this.init_declarator_list, ', ')
}
compositeNode.prototype.toString = function () {
    var str = 'composite ' + this.compName + '('
    str += this.inout ? this.inout.toString() : ''
    str += ')' + this.body.toString()
    return str
}
ComInOutNode.prototype.toString = function () {
    return 'input ' + list2String(this.input_list,',') + ', output ' + list2String(this.output_list,',')
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
    if (!this.stmt_list || this.stmt_list.length == 0) return '{ }'
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
    // 强制执行 toString 来实现对 N 等标识符在符号表中的查询
    if(this.op !== '.'){
        return this.left.toString() + this.op + this.right.toString()
    }
    return this.left.toString() + this.op + this.right // 例如 In[0].i = i 时, 对左边的.i 不检查符号表, 而对右侧的 i 检查是否是上层符号表的成员 
}
arrayNode.prototype.toString = function () {
    return '' + this.exp + list2String(this.arg_list, '][', '[', ']')
}
constantNode.prototype.toString = function () {
    let value = this.value
    let escaped = this.source.replace(/\n|↵/g, "\\n")
    return Number.isNaN(value) ? escaped : value.toString()
}
castNode.prototype.toString = function () {
    if(COStreamJS.options.platform === "WEB"){
        if(this.type === 'int') return `Math.floor(${this.exp})`
        else return this.exp.toString()
    }
    return '(' + this.type + ')' + this.exp
}
parenNode.prototype.toString = function () {
    return '(' + this.exp + ')'
}
unaryNode.prototype.toString = function () {
    return '' + this.first.toString() + this.second.toString()
}
operatorNode.prototype.toString = function () {
    var str = this.operName + '('
    str += this.inputs ? this.inputs : ''
    return str + ')' + this.operBody
}
operBodyNode.prototype.toString = function () {
    var str = '{\n'
    str += this.stmt_list ? list2String(this.stmt_list, ';\n','',';\n') : ''
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
    str += this.statement instanceof blockNode ? '' : ';' // 若该 for 只有一条语句, 则补充一个分号
    return str
}
whileNode.prototype.toString = function (){
    return 'while(' + this.exp + ')' + this.statement;
}
doNode.prototype.toString = function (){
    return 'do' + this.statement + 'while(' + this.exp + ')'
}
selection_statement.prototype.toString = function () {
    if (this.op1 === 'if') {
        var str = 'if(' + this.exp + ')' + this.statement
        str += this.op4 === 'else' ? ('else ' + this.else_statement) : ''
        return str
    } else if (this.op1 == 'switch') {

    }
}
splitNode.prototype.toString = function (){
    return this.name + ' ' + this.type + '(' + list2String(this.arg_list,',') + ');';
}
joinNode.prototype.toString = function (){
    return this.name + ' ' + this.type + '(' + list2String(this.arg_list,',') + ');';
}
splitjoinNode.prototype.toString = function (){
    var str =  this.compName + '(' + list2String(this.inputs,',') + ')' + '{\n' 
    str += this.split + '\n'
    str += list2String(this.body_stmts,'\n')
    str += this.join + '\n}'
    return str
}
addNode.prototype.toString = function (){
    if(this.content instanceof compositeCallNode){
        return this.name + ' ' + this.content.compName + '(' + list2String(this.content.params,',') + ')' 
    }
    return this.name + ' ' + this.content.toString()
}

const differentPlatformPrint = {
    'X86': args => 'cout<<' + list2String(args, '<<'),
    'WEB': args => 'console.log(' + list2String(args, ",") + ')',
    'default': args => 'print(' + list2String(args, ',') + ')'
}
const differentPlatformPrintln = {
    'X86': args => 'cout<<' + list2String(args, '<<') + '<<endl',
    'WEB': args => 'console.log(' + list2String(args, ',') + `,'\\n')`,
    'default': args => 'println(' + list2String(args, ',') + ')'
}
callNode.prototype.toString = function () {
    const platform = COStreamJS.options.platform

    if (this.name === "print") {
        return differentPlatformPrint[platform](this.arg_list)
    } else if (this.name === "println") {
        return differentPlatformPrintln[platform](this.arg_list)
    } else if (BUILTIN_MATH.includes(this.name) && platform === 'WEB'){
        return 'Math.'+this.name + '(' + list2String(this.arg_list, ',') + ')'
    } else if(this.name === "Native"){
        if(this.arg_list[1].source.slice(1,-1) !== platform){
            error(this._loc, `该 Native 函数与当前的执行平台不符`);
            return this.name;
        }
        return this.arg_list[0].source.slice(1,-1) //通过 slice 来移除左右两侧的引号
    } else if(this.name === "random" && platform === "X86"){
        return `rand()/(double)RAND_MAX`;
    } else{
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
    if(!this.op)    return this.start.toString()
    return (this.start || '')+':'+(this.end||'')
}
matrix_section.prototype.toString = function (){
    const platform = COStreamJS.options.platform
    // 如果是矩阵切片节点[0:5,0:5]而非数组取下标节点
    if (this.slice_pair_list[0].op === ':'){
        if (platform === 'X86') {
            //矩阵切片构建规则为 matrix[i:i+p, j:j+q] 转化为  matrix.block(i,j,p,q) , 参考http://eigen.tuxfamily.org/dox/group__TutorialBlockOperations.html
            let i = this.slice_pair_list[0].start
            let p = this.slice_pair_list[0].end + '-' + i
            let j = this.slice_pair_list[1].start
            let q = this.slice_pair_list[1].end + '-' + j
            return this.exp + `.block(${i},${j},${p},${q})`
        }
    }
    // 如果是矩阵切片节点(两个数字), 例如 data[i,j] 转义为 data(i,j)
    else if(this.slice_pair_list.length == 2){
        return this.exp.toString() + '(' + list2String(this.slice_pair_list, ',') + ')'
    }
    // 其他情况
    return this.exp.toString() + '[' + list2String(this.slice_pair_list, ',') + ']'
}
lib_binopNode.prototype.toString = function (){
    if(this.lib_name === 'Matrix'){
        let maps = {
            'zeros': 'Zero',
            'random': 'Random',
            'Constant': 'Constant'
        }
        return 'Matrix::' + maps[this.function_name]
    }else{
        error('暂不支持矩阵之外的库')
    }
}