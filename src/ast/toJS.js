import { declareNode,Node } from "./node"
import { matrix_constant } from "./node"
import { blockNode } from "./node"
import { binopNode } from "./node"
import { COStreamJS, top} from "../FrontEnd/global"
import { matrix_section } from "./node"
import { callNode } from "./node"

//对于未实现toJS函数的节点, 降级执行toString
Node.prototype.toJS = function(){
    return this.toString()
}
Number.prototype.toJS = function(){ return this.toString() }

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

matrix_constant.prototype.toJS = function(){
    if(this.shape[1] === 1){
        return `nj.array([${this.rawData.join(',')}])`
    }else {
        return `nj.array([${this.rawData.map(arr => '['+arr.join(',')+']').join(',')}])`
    }
}

declareNode.prototype.toJS = function () {
    debugger;
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
        debugger // 这里必须是toString
        return node.toString()
    }
}

//expNode 的子类
binopNode.prototype.toJS = function () {
    if(COStreamJS.plugins.matrix){
        const lshape = top.shapeCache.get(this.left), rshape = top.shapeCache.get(this.right)
        debugger;
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
            }else if('=' === this.op){
                return matrixAssignmentToJS(this.left, this.right)
            }
        }
    }
    return this.left.toString() + this.op + this.right.toString()
}

function matrixAssignmentToJS(left, right){
    if(left instanceof matrix_section){

    }else {
        // 这里左侧节点直接对变量名进行赋值, 所以左侧是toString而非toJS
        return left.toString() + ' = ' + right.toJS()
    }
}