import { definePrivate } from "./js-hacker.js"
import { error } from "../utils";

export class Node {
    constructor(loc) {
        this._loc = loc;
        ['_loc'].forEach(key => {
            definePrivate(this, key)
        })
    }
}
/********************************************************/
/*              1.1 declaration                         */
/********************************************************/
export class declareNode extends Node {
    constructor(loc, type, init_declarator_list) {
        super(loc)
        this.type = type
        this.init_declarator_list = [].concat(init_declarator_list)
    }
}
export class idNode extends Node{
    constructor(loc, name, arg){
        super(loc)
        this.name = name
        this.arg_list = []
        if(arg){
            this.isArray = true
            this.arg_list.push(arg)
        } 
    }
}
export class declarator extends Node {
    constructor(loc, identifier, initializer) {
        super(loc)
        this.identifier = identifier
        initializer && (this.op = '=')
        this.initializer = initializer
        definePrivate(this, 'type')
    }
}
/********************************************************/
/*              1.2 function.definition 函数声明          */
/********************************************************/
export class function_definition extends Node {
    constructor(loc, type, declarator,param_list, compound) {
        super(loc)
        this.type = type
        this.name = declarator.name
        this.op1 = '('
        this.param_list = param_list
        this.op2 = ')'
        this.funcBody = compound
    }
}
/********************************************************/
/*        2. composite                                  */
/********************************************************/
export class compositeNode extends Node {
    constructor(loc, head = {}, body = {}) {
        super(loc)
        Object.assign(this, {
            op: 'composite',
            compName: head.compName,
            inout: head.inout,
            body
        })
    }
}
export class compHeadNode extends Node {
    constructor(loc, compName, inout) {
        super(loc)
        Object.assign(this, { op: 'composite', compName, inout })
    }
}
export class ComInOutNode extends Node {
    constructor(loc, input_list = [], output_list = []) {
        super(loc)
        Object.assign(this, { op1: 'input', input_list, op2: 'output', output_list })
    }
}
export class inOutdeclNode extends Node {
    constructor(loc, strType, id) {
        super(loc)
        Object.assign(this, { strType, id })
    }
}
export class strdclNode extends Node {
    constructor(loc, type, identifier) {
        super(loc)
        this.op = 'stream<'
        this.id_list = [
            { type, identifier }
        ]
        this.op2 = '>'
    }
}
export class compBodyNode extends Node {
    constructor(loc, param, stmt_list) {
        super(loc)
        Object.assign(this, {
            op1: '{',
            param,
            stmt_list,
            op2: '}'
        })
    }
}
export class paramNode extends Node {
    constructor(loc, param_list) {
        super(loc)
        if (param_list) {
            this.op = 'param'
        }
        this.param_list = param_list
    }
}
export class operBodyNode extends Node {
    constructor(loc, stmt_list, init, work, win) {
        super(loc)
        Object.assign(this, {
            stmt_list: stmt_list || [] ,
            op1: 'init', init,
            op2: 'work', work,
            op3: 'window', win
        })
    }
}
export class winStmtNode extends Node {
    constructor(loc, winName, options = {}) {
        super(loc)
        Object.assign(this, {
            winName,
            type: options.type,
            arg_list: options.arg_list || []
        })
    }
}
/********************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement   */
/********************************************************/
export class blockNode extends Node {
    constructor(loc, op1, stmt_list, op2) {
        super(loc)
        Object.assign(this, { op1, stmt_list, op2 })
    }
}
export class jump_statement extends Node {
    constructor(loc, op1, op2) {
        super(loc)
        Object.assign(this, { op1, op2 })
    }
}
export class labeled_statement extends Node {
    constructor(loc, op1, op2, op3, statement) {
        super(loc)
        Object.assign(this, { op1, op2, op3, statement })
    }
}
export class selection_statement extends Node {
    constructor(loc, op1, op2, exp, op3, statement, op4, else_statement) {
        super(loc)
        Object.assign(this, {
            op1, op2, exp, op3,
            statement, op4, else_statement
        })
    }
}
export class whileNode extends Node {
    constructor(loc, exp, statement) {
        super(loc)
        Object.assign(this, {
            type: 'while',
            op1: '(',
            exp,
            op2: ')',
            statement
        })
    }
}
export class doNode extends Node {
    constructor(loc, exp, statement) {
        super(loc)
        Object.assign(this, {
            type: 'do',
            op1: '(',
            statement,
            op2: ')',
            op3: 'while',
            exp
        })
    }
}
export class forNode extends Node {
    constructor(loc, init, cond, next, statement) {
        super(loc)
        Object.assign(this, {
            type: 'for',
            op1: '(',
            init, cond, next,
            op2: ')',
            statement
        })
    }
}
/********************************************************/
/*        4. expression 计算表达式头节点                   */
/********************************************************/

export class expNode extends Node {
    constructor(loc) {
        super(loc)
        //检查是否有常量传播插件提供的 getValue 函数
        if (expNode.prototype.getValue) {
            expNode.prototype.getValue.call(this)
        }
    }
}

export class unaryNode extends expNode {
    constructor(loc, first, second) {
        super(loc)
        Object.assign(this, { first, second })
    }

};
export class castNode extends expNode {
    constructor(loc, type, exp) {
        super(loc)
        Object.assign(this, { op1: '(', type, op2: ')', exp })
    }
}

export class binopNode extends expNode {
    constructor(loc, left, op, right) {
        super(loc)
        Object.assign(this, { left, op, right })
    }
}

export class ternaryNode extends expNode {
    constructor(loc, first, second, third) {
        super(loc)
        Object.assign(this, { first, op1: '?', second, op2: ':', third })
    }
}

export class parenNode extends expNode {
    constructor(loc, exp) {
        super(loc)
        Object.assign(this, { op1: '(', exp, op2: ')' })
    }
}
export class callNode extends expNode {
    constructor(loc, name, arg_list) {
        super(loc)
        this.name = name
        this.op1 = '('
        this.arg_list = arg_list
        this.op2 = ')'
    }
}
export class constantNode extends expNode {
    constructor(loc, sourceStr='') {
        super(loc)
        this.source = sourceStr.toString()
    }
}
/********************************************************/
/* operNode in expression's right                       */
/********************************************************/
export class operNode extends Node {
    constructor(loc) {
        super(loc)
        this.outputs = []
    }
}
export class fileReaderNode extends operNode{
    constructor(loc,fileName,dataLength){
        super(loc)
        this.fileName = fileName
        this.dataLength = dataLength - 0; // 字符串转数字
    }
}
export class compositeCallNode extends operNode {
    constructor(loc, compName, inputs, params = []) {
        super(loc)
        Object.assign(this, {
            compName,
            op1: '(',
            inputs,
            op2: ')',
            op3: '(',
            params,
            op4: ')'
        })
    }
}
export class operatorNode extends operNode {
    constructor(loc, operName, inputs, operBody) {
        super(loc)
        Object.assign(this, { operName, inputs: inputs ||[], operBody })
    }
}
export class splitjoinNode extends operNode {
    constructor(loc, options = {}) {
        super(loc)
        this.compName = options.compName
        this.inputs = options.inputs
        this.stmt_list = options.stmt_list
        this.split = options.split
        this.body_stmts = options.body_stmts
        this.join = options.join
    }
}
export class pipelineNode extends operNode {
    constructor(loc, options = {}) {
        super(loc)
        this.compName = options.compName
        this.inputs = options.inputs
        this.body_stmts = options.body_stmts
    }
}
export class splitNode extends Node {
    constructor(loc, node = {}) {
        super(loc)
        this.name = "split"
        this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin"
        if (node.arg_list) {
            Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' })
        }
    }
}
export class joinNode extends Node {
    constructor(loc, node = {}) {
        super(loc)
        this.name = "join"
        this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin"
        if (node.arg_list) {
            Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' })
        }
    }
}
export class duplicateNode extends Node {
    constructor(loc, arg_list) {
        super(loc)
        this.arg_list = arg_list
    }
}
export class roundrobinNode extends Node {
    constructor(loc, arg_list) {
        super(loc)
        this.arg_list = arg_list
    }
}
export class addNode extends Node {
    constructor(loc, content) {
        super(loc)
        this.name = "add"
        this.content = content
    }
}

/********************************************************/
/* 矩阵相关 node                       */
/********************************************************/
export class matrix_constant extends Node{
    constructor(loc, rawData){
        super(loc)
        this.rawData = rawData.map(x => (
            x instanceof matrix_constant ? x.rawData : x
        ))
        if(this.rawData[0] instanceof Array){
            if(Array.isArray(this.rawData[0][0])){
                error(loc,"暂不支持超过2维的数据, 只能是1维向量或2维矩阵")
                return
            }
            this.shape = [this.rawData.length, this.rawData[0].length]
        }else{
            // 向量型的矩阵, 行数为1
            const cols = this.rawData.length
            this.shape = [1, cols]
        }
    }
}

/* 存放矩阵切片的下标, 例如 vector[0:5] 表示 下标[0,5) 即0~5不含5 
   兼容多重格式(_表示 undefined), 例如
   * [1:5] --- { start: 1, op:':', end: 5 }
   * [1:]  --- { start: 1, op:':', end: _ }
   * [:5]  --- { start: _, op:':', end: 5 }
   * [:]   --- { start: _, op:':', end: _ }
   * [0]   --- { start: 0, op: _ , end: _ }   */
export class matrix_slice_pair extends Node {
    constructor(loc, start, op, end) {
        super(loc)
        this.start = start
        this.op = op
        this.end = end
    }
}

/** 存放 name[1:4, 2:5] 的结构, 寓意为矩阵切片结果 */
export class matrix_section extends expNode{
    constructor(loc, exp, slice_pair_list){
        super(loc)
        this.exp = exp
        this.slice_pair_list = slice_pair_list
    }
}

export class lib_binopNode extends Node{
    constructor(loc, lib_name,function_name){
        super(loc)
        this.lib_name = lib_name;
        this.function_name = function_name;
    }
}

/********************************************************/
/* 神经网络相关 node                                      */
/********************************************************/
export class sequentialNode extends operNode {
    constructor(loc, options = {}) {
      super(loc)
      this.compName = options.compName;
      this.inputs = options.inputs;
      this.arg_list = options.arg_list;
      this.body_stmts = options.body_stmts;
    }
};
export class layerNode extends Node {
    constructor(loc, layerName, arg_list) {
      super(loc);
      this.layerName = layerName
      this.arg_list = arg_list;
      this.prevLayer = null;
      this.nextLayer = null;
      this.inputSize = [];
      /** 神经网络层级 */
      this.level = 0;
    }
    /** @returns {number[]} */
    getInputSize(/** @type {sequentialNode} */ sequential){
        if(this.prevLayer){
            if(this.prevLayer instanceof denseLayerNode){
                return [1, this.prevLayer.cols, 1] // 设置本层的输入数据规模, 用一个三维向量描述: [rows, cols, depth]

            }else if(this.prevLayer instanceof conv2DLayerNode){
                return this.prevLayer.outputFeatureMapSize
            }else if(this.prevLayer instanceof maxPooling2DLayerNode){
                return this.prevLayer.outputPooledSize
            }else if(this.prevLayer instanceof averagePooling2DLayerNode){
                return this.prevLayer.outputPooledSize
            }else if(this.prevLayer instanceof activationLayerNode){
                return this.prevLayer.inputSize
            }else{
                error("未识别的 layer 类型:", this.prevLayer)
            }
        }else{
            if(sequential.arg_list[0] instanceof parenNode){
                return sequential.arg_list[0].exp.map(_=>_.value)
            }
            return [1, sequential.arg_list[0].value, 1] // [rows, cols, depth]
        }
    }
};
export class denseLayerNode extends layerNode {
    constructor(loc, layerName, arg_list = [0]) {
        super(loc, layerName, arg_list);
        /** 权值矩阵输入 */
        this.rows = 0
        /** 权值矩阵输出 */
        this.cols = arg_list[0].value // FIXME: 这里简单起见直接拿到数字. 应该放到 ast2ssg 中的
    }
    init(/** @type {sequentialNode} */ sequential){
        this.inputSize = this.getInputSize(sequential)
        this.rows = this.inputSize.reduce((a,b)=>a*b) // 求得所有维度的乘积, 例如[1,100,1] 返回 1*100*1 = 100
    }
}
export class conv2DLayerNode extends layerNode {
    //                                   filters, kernel_size, strides, padding
    constructor(loc, layerName, arg_list = [3, [2, 2], [1, 1], [0, 0]]) {
        super(loc, layerName, arg_list);
        try{
            this.filters = arg_list[0].value // filters
            // 以下三行的 '||' 操作符的意义: 当该参数是 parenNode 时, 取它的 exp. (而当 arg_list 取上方的默认值时,则不需取 exp)
            this.kernel_size = (arg_list[1].exp || arg_list[1]) .map(num => num.value) // kernel_size
            this.strides = (arg_list[2].exp || arg_list[2]) .map(num => num.value) // strides
            this.paddings = (arg_list[3].exp || arg_list[3]) .map(num => num.value) // paddings

        }catch(err){
            error(loc, "conv2DLayerNode 参数解析错误, 请检查")
        }
        // 以下三个成员在 init 中进行初始化
        this.inputSize = []
        this.outputFeatureMapSize = []
        this.inputErrorSize = []
    }
    /** 根据上一层初始化本层输出特征图的尺寸和输入空间的维度 */
    init(/** @type {sequentialNode} */ sequential){
        this.outputFeatureMapSize = [];
        // 本层反向传播过程中 传入误差的尺寸`
        this.inputErrorSize = [];
        // 按照arg_list爲傳入整個sequential結構的參數列表(rows, cols, depth)
        this.inputSize = this.getInputSize(sequential);
        this.outputFeatureMapSize = [
            (this.inputSize[0] + 2 * this.paddings[0] - this.kernel_size[0]) / this.strides[0] + 1, // rows
            (this.inputSize[1] + 2 * this.paddings[1] - this.kernel_size[1]) / this.strides[1] + 1, // cols
            this.filters  // depth
        ]
        for(let i = 0; i < 2; i++) {
            // 2 * (kernel_size - 1) + (outputFeaureMapSize - 1)* stride + 1
            this.inputErrorSize.push(2 * (this.kernel_size[i] - 1) + (this.outputFeatureMapSize[i] - 1) * this.strides[i] + 1);
        }
    }
}
export class maxPooling2DLayerNode extends layerNode {
    constructor(loc, layerName, arg_list = [0]){
        super(loc, layerName, arg_list)
        this.pool_size = arg_list[0].value
        this.depth = 0
        this.outputPooledSize = []
    }
    init(/** @type {sequentialNode} */ sequential){
        this.inputSize = this.getInputSize(sequential)
        this.outputPooledSize[0] = Math.floor(this.inputSize[0] / this.pool_size)
        this.outputPooledSize[1] = Math.floor(this.inputSize[1] / this.pool_size)
        this.outputPooledSize[2] = this.inputSize[2]
        this.depth = this.inputSize[2]
    }
}
export class averagePooling2DLayerNode extends layerNode {
    constructor(loc, layerName, arg_list = [0]){
        super(loc, layerName, arg_list)
        this.pool_size = arg_list[0].value
        this.depth = 0
    }
    init(/** @type {sequentialNode} */ sequential){
        this.inputSize = this.getInputSize(sequential)
        this.outputPooledSize[0] = this.inputSize[0] / this.pool_size
        this.outputPooledSize[1] = this.inputSize[1] / this.pool_size
        this.outputPooledSize[2] = this.inputSize[2]
        this.depth = this.inputSize[2]
    }
}
export class activationLayerNode extends layerNode {
    constructor(loc, layerName, arg_list){
        super(loc, layerName, arg_list)
        this.count = 1;
    }
    init(/** @type {sequentialNode} */ sequential){
        this.inputSize = this.getInputSize(sequential)
        this.inputSize.forEach(num => this.count*=num)
    }
}
