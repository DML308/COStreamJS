import { compositeNode, inOutdeclNode, declareNode, declarator, strdclNode, Node } from "../ast/node.js"
import { FlatNode } from "./FlatNode"

const MAX_SCOPE_DEPTH = 100 //定义最大嵌套深度为100

/** @type {SymbolTable[]} */
export let runningStack = [];
export const current_version = Array.from({length:MAX_SCOPE_DEPTH}).fill(0);
export const symbolTableList = /** @type{SymbolTable[]}*/[];

export class Variable {
    constructor(valType, name, i, _loc) {
        this.type = valType
        if(valType !== 'Matrix'){
            if(Array.isArray(i)){
                this.shape = [i.length,1]
            }else{
                this.shape = [1,1]
            }
        }
        this.name = name
        this._loc = _loc
        /** @type {Node} */
        this.value = i
    }
}

class CompositeSymbol {
    constructor(/** @type {compositeNode} */ comp) {
        this.composite = comp;
        this.count = 0; // 用于区分多次调用同一 composite
    }
};

export class SymbolTable {
    constructor(prev, loc) {
        this.count = 0; // FIXME: 不确定有什么用
        this.root = prev ? prev.root : this // 标记全局最根部的符号表
        
        this.loc = loc;
        /** @type {SymbolTable} */
        this.prev = prev
        symbolTableList.push(this)
        this.sid = SymbolTable.sid++

        this.funcTable = {};
        /** @type {Dict<{strType: strdclNode, fromIndex: number, fromFlatNode:FlatNode, toIndex: number, toFlatNode: FlatNode}>} */
        this.streamTable = {};  
        
        /** @type {Dict<Variable>} */
        this.memberTable = {} // 专门用来存储一个operator的成员变量字段
        this.paramNames = prev && prev.paramNames.length > 0 ? prev.paramNames : [] // 子符号表继承父符号表的paramNames
        /** @type {Dict<Variable>} */
        this.variableTable = {}; //变量
        this.compTable = {}; // composite
        this.optTable = {}; //operator
        this.shapeCache = new Map();
    };
    getPrev() {
        return this.prev;
    }
    /** @returns { {type: 'variable'|'stream' |'func'|'oper'|'member', origin: SymbolTable}}  */
    searchName(name){
        if(this.variableTable.hasOwnProperty(name)) return { type: 'variable', origin: this}
        if(this.streamTable.hasOwnProperty(name))   return { type: 'stream', origin: this}
        if(this.funcTable.hasOwnProperty(name))     return { type: 'func', origin: this}
        if(this.optTable.hasOwnProperty(name))      return { type: 'oper', origin: this}
        if(this.memberTable.hasOwnProperty(name))   return { type: 'member', origin: this}
        if(this.prev)                return this.prev.searchName(name)
        return undefined;
    }
    getVariableValue(name){
        return this.LookupIdentifySymbol(name).value;
    }
    setVariableValue(name,val){
        return this.LookupIdentifySymbol(name).value = val
    }
    getExactSymbolTable(name){
        if(this.variableTable[name]) return this
        return this.prev && this.prev.getExactSymbolTable(name)
    }
    /** @returns{Variable} */
    LookupIdentifySymbol(name){
        if(this.variableTable[name]) return this.variableTable[name]
        if(this.prev){
            return this.prev.LookupIdentifySymbol(name)
        }else{
            console.warn(`在符号表中查找不到该变量的值: ${name}`)
        }
    }
    InsertCompositeSymbol(/** @type {compositeNode} */comp){
        this.compTable[comp.compName] = new CompositeSymbol(comp);
    }
    InsertStreamSymbol(/** @type {inOutdeclNode} */ inOutNode){
        const name = inOutNode.id
        if(this.streamTable[name]){
            throw new Error(error(inOutNode._loc,`stream ${name} has been declared`))
        }else{
            this.streamTable[name]= { strType: inOutNode.strType.copy() };
        }
    }
    InsertOperatorSymbol(name, operatorNode){
        this.optTable[name] = operatorNode
    }
    InsertMemberSymbol(/** @type {declareNode} */ decl){
        decl.init_declarator_list.forEach((/** @type {declarator} */de) =>{
            let name = de.identifier.name
            let { initializer, arg_list } = de.identifier
            if(de.identifier.arg_list.length){
                var variable = new Variable(de.type,name,undefined, de._loc)
                variable.shape = arg_list.map(_=>_.value)
            }else{
                var variable = new Variable(de.type,name,initializer, de._loc)
            }
            this.memberTable[name] = variable
        })
    }
    LookupFunctionSymbol(name){
        if(this.funcTable[name]) return this.funcTable[name]
        if(this.prev){
            return this.prev.LookupFunctionSymbol(name)
        }else{
            console.warn(`在符号表中查找不到该函数: ${name}`)
        }
    }
}
SymbolTable.sid = 0; // 类的静态类型, 类似 vue 的 cid, 用来区分生成的符号表的顺序

SymbolTable.prototype.InsertIdentifySymbol = function InsertIdentifySymbol(/** @type {Variable} */ node){
    if(node instanceof Variable){
        let name = node.name;
        if(this.variableTable[name]) {
            throw new Error(error(node._loc,`${name} 重复定义`))
        }else{
            this.variableTable[name]= node;
        }
    }else{
        throw new Error("插入 IndetifySymbol 时出错, node 类型错误")
    }
}