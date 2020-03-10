import { compositeNode, inOutdeclNode, declareNode, declarator } from "../ast/node.js"

const MAX_SCOPE_DEPTH = 10 //定义最大嵌套深度为100
/*level表示当前嵌套深度，version表示嵌套域计数器 */

export const current_version = Array.from({length:MAX_SCOPE_DEPTH}).fill(0);
export const symbolTableList = /** @type{SymbolTable[]}*/[];
let isSorted = false;

export const symbolTableMap = Array.from({length:MAX_SCOPE_DEPTH}).map(_ => []); // 二维数组


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
    constructor(valType, name, i) {
        this.type = valType
        this.name = name
        this.level = undefined
        this.version = undefined
        this._loc = undefined
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
        this.loc = loc;
        this.prev = prev
        symbolTableList.push(this)
        let Level = SymbolTable.Level
        symbolTableMap[Level][current_version[Level]] = this

        this.funcTable = {};
        /** @type {Dict<inOutdeclNode>} */
        this.streamTable = {};  
        // this.identifyTable = undefined; // 没发现这个的用处
        /** @type {Dict<Variable>} */
        this.memberTable = {} // 专门用来存储一个operator的成员变量字段
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
        : this.streamTable[name]= inOutNode;
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
                var variable = new Variable(de.type,name,array_c)
            }else{
                var variable = new Variable(de.type,name,initializer)
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
// 将 Level 挂载为该类的静态变量 
SymbolTable.Level = 0;

SymbolTable.prototype.InsertIdentifySymbol = function InsertIdentifySymbol(node, /** @type {Constant} */ constant){
    const Level = SymbolTable.Level
    if(node instanceof Node){
        if(node instanceof declarator){
            let name = node.identifier.name;
            let variable = new Variable(node.type, name, constant); // 无论传入的是常量还是变量, 归一为 Variable 结构
            node.level = Level;
            node.version = current_version[Level];
            variable.level = Level;
            variable.version = current_version[Level];

            this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= variable;
        }else if(node instanceof inOutdeclNode){
            let name = node.id // 是否需要设置 level version ?
            this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= null;
        }
    }else if(node instanceof Variable){
        let name = node.name;
        node.level = Level
        node.version = current_version[Level]
        this.variableTable[name] ? console.log(`${name} had been declared`)
                                 : this.variableTable[name]= node;
    }else{
        throw new Error("插入 IndetifySymbol 时出错, node 类型错误")
    }
}