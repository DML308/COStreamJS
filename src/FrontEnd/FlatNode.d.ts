import { operatorNode } from "../ast/node"
import { SymbolTable } from "./symbol"

export class FlatNode {
    
    /** opeator名字 */
    name: string       
    /** 记录Operator被重命名前的名字 */
    PreName: string    
    /** 表示该结点是否已经被访问过,与dumpdot有关 */
    visitTimes: 0             

    /** 存储对应 operator 所在的 composite 的符号表. 主要目的是获取 paramNames*/
    _symbol_table: SymbolTable

    /** 指向operator(不同的 FlatNode 可能对应相同的 operator, 不同的是执行上下文带来的符号表不同) */
    contents: operatorNode

    params: number[]

    /** 输 出 边个数 */
    nOut: 0 
    /** 输 入 边个数 */
    nIn: 0  

    /** 两级划分算法中,actor所在的place号、thread号、thread中的序列号 */
    place_id: 0;
    thread_id: 0
    post_thread_id: 0;
    serial_id: 0;

    /** 节点work函数的静态工作量 */
    work_estimate: 0

    /** 输出边各operator */
    outFlatNodes: FlatNode[]  
    /** 输入边各operator */
    inFlatNodes: FlatNode[]  

    /** 输 出 边各权重 */
    outPushWeights: number[] 
    /** 输 入 边各权重 */
    inPopWeights: number[]   
    /** 输 入 边各权重 */
    inPeekWeights: number[]  

    /** init调度次数 */
    initCount: 0
    /** 稳态调度次数 */
    steadyCount: 0
    /** 阶段号 */
    stageNum: 0
    constructor(/** @type {operatorNode} */ node, params: []) 

}
