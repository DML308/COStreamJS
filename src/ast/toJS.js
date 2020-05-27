import { Node,blockNode, idNode, ternaryNode,forNode, declareNode, declarator, binopNode, unaryNode, callNode, selection_statement, castNode, parenNode, matrix_section, matrix_constant, lib_binopNode, whileNode, doNode,matrix_slice_pair} from "./node.js"
import { BUILTIN_MATH } from "../FrontEnd/built-in-function"
import { COStreamJS, top} from "../FrontEnd/global"
import { error } from "../utils"

//对于未实现toJS函数的节点, 降级执行toString
Node.prototype.toJS = function(){
    return this.toString()
}
Number.prototype.toJS = function(){ return this.toString() }
String.prototype.toJS = function(){ return this.toString() }

/**
 * 输入一个 list 返回它转化后的 string, 可以配置分隔符 split 例如','
 * 也可以配置 start 和 end 例如'{' '}'
 */
function list2String(list, split, start, end) {
    if (!list || list.length == 0) return ''
    var str = start ? start : ''
    list.forEach((x, idx) => {
        str += x.toJS()
        str += split && idx < list.length - 1 ? split : ''
    })
    return end ? str + end : str
}

matrix_constant.prototype.toJS = function(){
    if(this.shape[1] === 1){
        return `nj.array([${this.rawData.join(',')}])`
    }else {
        return `nj.array([${this.rawData.map(arr => '['+arr.join(',')+']').join(',')}])`
    }
}
declarator.prototype.toJS = function () {
    var str = this.identifier.name
    str += this.op ? this.op : ''
    if(this.identifier.arg_list.length && !this.initializer){
        str += `= getNDArray(${this.identifier.arg_list.map(_=>_.toJS()).join(',')})`

    }else if (this.initializer instanceof Array) {
        str += list2String(this.initializer, ',', '[', ']')
    } else {
        str += this.initializer ? this.initializer.toJS() : ''
    }
    return str
}
declareNode.prototype.toJS = function () {
    if(this.type === 'Matrix'){
        var res = ''
        for(let decla of this.init_declarator_list){
            if(Array.isArray(decla.initializer)){
                const name = decla.identifier.name
                res += `let ${name} = [] \n`
                for(let i=0; i< decla.initializer.length;i++){
                    res += `${name}[${i}] = ${decla.initializer[i].toJS()} \n`
                }
            }else{
                res += `let ${decla.identifier.name} = ${decla.initializer.toJS()} \n`
            }
        }
        return res
    }else{
        return 'let ' + list2String(this.init_declarator_list, ', ')
    }
}
idNode.prototype.toJS = function(){
    return this.name.toJS() + (this.arg_list.length > 0? list2String(this.arg_list, '][','[',']') :'').replace(/\[0]/g,'[]')
}

//将每一行 statement 的';'上提至 blockNode 处理
blockNode.prototype.toJS = function () {
    if (!this.stmt_list || this.stmt_list.length == 0) return '{ }'
    var str = '{\n';
    this.stmt_list.forEach(x => {
        str += x.toJS() + '\n'
    })
    return str + '}\n'
}

function getNdConstantMatrix(shape, number){
    return `nj.zeros([${shape[0]},${shape[1]}]).assign(${number})`
}

function resolveNumber(node, shape, mainShape){
    if(shape.join() !== mainShape.join()){
        return getNdConstantMatrix(mainShape,node)
    }else{
        return node.toJS()
    }
}

//expNode 的子类
binopNode.prototype.toJS = function () {
    if(COStreamJS.plugins.matrix){
        if('=' === this.op && this.left instanceof matrix_section && this.left.slice_pair_list.length > 1){
            return matrixAssignmentToJS(this.left, this.right)
        }
        const lshape = top.shapeCache.get(this.left), rshape = top.shapeCache.get(this.right)
        if(lshape && lshape != "1,1" || rshape && rshape != "1,1"){
            if(['+','-','*','/'].includes(this.op)){
                const mainShape = lshape != "1,1" ? lshape : rshape
                const lString = resolveNumber(this.left,lshape,mainShape)
                const rString = resolveNumber(this.right, rshape, mainShape)
                const handlers = {
                    '+': 'add',
                    '-': 'substract',
                    '*': 'dot',
                    '/': 'divide'
                }
                return lString + `.` + handlers[this.op] + `(${rString})`

            }else if(['+=','-=','*=','/='].includes(this.op)){
                const rightNode = new binopNode(null,this.left,this.op[0],this.right)
                const assignNode = new binopNode(null, this.left,'=', rightNode)
                return assignNode.toJS()
            }
        }
    }
    if(this.op === '.'){
        return this.left.toJS() + this.op + this.right.toString() // 点操作符的右侧不需要加this
    }
    return this.left.toJS() + this.op + this.right.toJS()
}

function matrixAssignmentToJS(/** @type {matrix_section}*/left, right){
    if(left.slice_pair_list.some(x => x.op)){
        throw new Error(error(left._loc,"WEB端代码生成左侧暂不支持使用冒号:"))
    }
    const list = left.slice_pair_list.map(s => s.start)
    return `${left.exp.toJS()}.set(${list[0]},${list[1]}, ${right.toJS()})`
}

callNode.prototype.toJS = function(){
    if(this.name instanceof binopNode){
        if(this.name.right === 'cwiseProduct'){
            return this.name.left.toJS() + '.multiply(' + list2String(this.arg_list) + ')'
        }else{
            return this.name.left.toJS() + `.${this.name.right}(` + list2String(this.arg_list) + ')'
        }
    }else if(this.name instanceof lib_binopNode){
        if(this.name.function_name === 'constant'){
            return getNdConstantMatrix(this.arg_list, this.arg_list[2])
        }
        return `nj.${this.name.function_name}([${this.arg_list}])`
    }else{
        if (this.name === "print") {
            return 'console.log(' + list2String(this.arg_list, ",") + ')'
        }else if (this.name === "println") {
            return 'console.log(' + list2String(this.arg_list, ',') + `,'\\n')`
        }else if (BUILTIN_MATH.includes(this.name)){
            return 'Math.'+this.name + '(' + list2String(this.arg_list, ',') + ')'
        }else if(this.name === "Native"){
            if(this.arg_list[1].source.slice(1,-1) !== 'WEB'){
                throw new Error(error(this._loc, `该 Native 函数与当前的执行平台不符`))
            }
            return this.arg_list[0].source.slice(1,-1) //通过 slice 来移除左右两侧的引号
        }else{
            return this.name.toJS() + '(' + list2String(this.arg_list, ',') + ')'
        }
    }
}

forNode.prototype.toJS = function () {
    var str = 'for('
    str += this.init ? this.init.toJS() + ';' : ';'
    str += this.cond ? this.cond.toJS() + ';' : ';'
    str += this.next ? this.next.toJS() : ''
    str += ')' + this.statement.toJS()
    str += this.statement instanceof blockNode ? '' : ';' // 若该 for 只有一条语句, 则补充一个分号
    return str
}
matrix_section.prototype.toJS = function(){
    const shape = top.shapeCache.get(this.exp)
    if(shape && shape.join('') > '11'){
        // 若为S.x[i,j]获取指定位置元素
        if(this.slice_pair_list.every(p => p.op !== ':')){
            const indexs = this.slice_pair_list.map(p=>p.start)
            return `${this.exp.toJS()}.get(${indexs[0]},${indexs[1]})`
        }
        // 若为S.x[i:i+m,j:j+n]切片
        const args = this.slice_pair_list.map(getNumJSSliceString)
        return `${this.exp.toJS()}.slice(${args})`
    }else{
        // 不是矩阵的情况
        debugger;
        return this.exp.toJS() + '[' + list2String(this.slice_pair_list, ',') + ']'
    }
}

// 根据numjs库的复杂切片规则生成其切片字符串
function getNumJSSliceString(/** @type {{ start?: string, op?: ':', end?: string}} */ pair){
    const { start, op, end } = pair
    if(!op){
        return `[${start},${start}+1]`
    }else{
        if(!start && end){
            return `[${end}]`
        }else if(start && !end){
            return `${start}`
        }else if(start && end){
            return `[${start},${end}]`
        }else if(!start && !end){
            return `0`
        }
    }
} 

// 对string进行特殊处理, 必要时在前方添加this
String.prototype.toJS = function toJS(){
    // 对string进行特殊处理, 必要时在前方添加this
    if(!/[A-z_][A-z0-9_]*/.test(this)) return this // 若不是标识符则不处理
    let searchResult = top.searchName(this)
    if(top.paramNames.includes(this)){
            return 'this.'+this
    }else if(searchResult){
        // 替换符号表中的成员变量和流变量的访问 
        if(searchResult.type === 'stream' || searchResult.type === 'member'){
            return 'this.'+this
        }else if(searchResult.type === 'variable'){
            // 如果该变量是属于根符号表中的全局变量
            if(searchResult.origin === top.root){
                return this
            }
            // 如果该变量名是 composite 中定义的过程变量, 则替换 oper 对上层符号表的数据的访问
            else if(searchResult.origin !== top){
                return top.getVariableValue(this)
            }
        }
    }
    return this
}

ternaryNode.prototype.toJS = function (){
    return this.first.toJS() + '?' + this.second.toJS() + ':' + this.third.toJS();
}

castNode.prototype.toJS = function () {
    if(this.type === 'int') return `Math.floor(${this.exp.toJS()})`
    else return this.exp.toJS()
}

parenNode.prototype.toJS = function () {
    return '(' + this.exp.toJS() + ')'
}

unaryNode.prototype.toJS = function () {
    return '' + this.first.toJS() + this.second.toJS()
}
whileNode.prototype.toJS = function (){
    return 'while(' + this.exp.toJS() + ')' + this.statement.toJS();
}
doNode.prototype.toString = function (){
    return 'do' + this.statement.toJS() + 'while(' + this.exp.toJS() + ')'
}
selection_statement.prototype.toJS = function () {
    if (this.op1 === 'if') {
        var str = 'if(' + this.exp.toJS() + ')' + this.statement.toJS()
        str += this.op4 === 'else' ? ('else ' + this.else_statement.toJS()) : ''
        return str
    } else if (this.op1 == 'switch') {

    }
}
matrix_slice_pair.prototype.toJS = function (){
    if(!this.op)    return this.start.toJS()
    return (this.start || '').toJS()+':'+(this.end||'').toJS()
}