import { compositeNode, inOutdeclNode, declareNode, declarator, strdclNode } from "../ast/node.js"
import { FlatNode } from "./FlatNode"

const MAX_SCOPE_DEPTH = 10 //定义最大嵌套深度为100

/** @type {SymbolTable[]} */
export let runningStack = [];
export const current_version = Array.from({length:MAX_SCOPE_DEPTH}).fill(0);
export const symbolTableList = /** @type{SymbolTable[]}*/[];


export class Constant {
    constructor(/* string */ type, val) {
        this.type = type
        /** @type{number} */
        this.val = val
    }
    print(/* boolean */ isArray) {
        console.log(`[Constant] type: ${this.type} val: ${this.val}`)
    }

};

export class ArrayConstant {
    constructor(type /* string */, values, arg_list) {
        this.type = type
        /** @type {Array<Constant>} */
        this.values = values
        /** @type {number[]} */
        this.arg_list = arg_list || []
    }
    print() { };
};

export class Variable {
    constructor(valType, name, i, _loc) {
        this.type = valType
        this.name = name
        this._loc = _loc
        if (i instanceof Constant) {
            this.value = i;
        }
        else if (i instanceof ArrayConstant) {
            this.array = i
        }
        else {
            this.value = new Constant(valType, i);
        }
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
        this.paramNames = []
        this.variableTable = {}; //变量
        this.compTable = {}; // composite
        this.optTable = {}; //operator
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
        this.streamTable[name] ? console.log(`stream ${name} has been declared`)
        : this.streamTable[name]= { strType: inOutNode.strType };
    }
    InsertOperatorSymbol(name, operatorNode){
        this.optTable[name] = operatorNode
    }
    InsertMemberSymbol(/** @type {declareNode} */ decl){
        decl.init_declarator_list.forEach((/** @type {declarator} */de) =>{
            let name = de.identifier.name
            let { initializer, arg_list } = de.identifier
            if(de.identifier.arg_list.length){
                let array_c = new ArrayConstant(de.type,initializer, arg_list.map(_=>_.value))
                var variable = new Variable(de.type,name,array_c, de._loc)
            }else{
                var variable = new Variable(de.type,name,initializer, de._loc)
            }
            variable._loc = decl._loc
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

SymbolTable.prototype.InsertIdentifySymbol = function InsertIdentifySymbol(node, /** @type {Constant} */ constant){
    if(node instanceof Node){
        if(node instanceof declarator){
            let name = node.identifier.name;
            let variable = new Variable(node.type, name, constant, node._loc); // 无论传入的是常量还是变量, 归一为 Variable 结构

            this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= variable;
        }else if(node instanceof inOutdeclNode){
            let name = node.id
            this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= null;
        }
    }else if(node instanceof Variable){
        let name = node.name;
        this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= node;
    }else{
        throw new Error("插入 IndetifySymbol 时出错, node 类型错误")
    }
}