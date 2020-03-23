import { UnfoldComposite, compositeCallFlow } from "./unfoldComposite"

import { COStreamJS } from "./global"
import { addNode, parenNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode, compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode, declarator, idNode, inOutdeclNode, strdclNode, unaryNode } from "../ast/node";
import { top, setTop } from "./generateSymbolTables"
import { SymbolTable, Variable, ArrayConstant } from "./symbol";
import { sequentialNode, denseLayerNode, layerNode, averagePooling2DLayerNode } from "../ast/node";




/**
 * 对于如下形式的 squential 和 Dense 的例子
 * Out = squential (In, Y) (784) {
 *      add Dense(100);
 *      add Dense(10);
 * };
 * 我们要连接数据流节点的策略是: 以 loss 为中心, 前后对称地补上 dense 和 dDense , 最后在首部加一个 copy
 * 我们要生成的 composite 的样式为
 *   composite sequential_0(input stream<double x>In, stream<double x>Y, output stream<double x> Out){
 *          stream<double x>copy_1,copy_2;
 *          (copy_1,copy2) = copy(In);                     // 内容参见 MakeCopyOperator
 *          (dense_1_1,dense_1_2) = dense(copy1)
 *          D3 = dense(D2)
 *          L = loss(D3, Y)
 *          D6 = dDense(D1, L)
 *          Out = dDense(In1, D6)
 *   }
 * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
 * 然后我们要返回的 compositeCallNode 的样式为
 *   Out = sequential_0(In,Y);
 *
 * @param {sequentialNode} node
 * @returns {compositeCallNode}
 */
UnfoldComposite.prototype.UnfoldSequential = function (node) {
    setTop(new SymbolTable(top, null)) // 对生成的新 composite 构建新的符号表

    let compName = this.MakeCompositeName("squential");
    let call_list = compositeCallFlow(node.body_stmts);

    const strType = top.prev.streamTable[node.inputs[0]].strType // 这里也简单默认输入输出数据流类型一致, 若有不一致的需求, 应修改此处代码
    const head_inputs = [new inOutdeclNode(null, strType, "In"), new inOutdeclNode(null, strType, "Y")]
    const head_outputs = [new inOutdeclNode(null, strType, "Out")]
    let inout = new ComInOutNode(null, head_inputs, head_outputs)
    let head = new compHeadNode(null, compName, inout) // 构建头部完成

    let stmt_list = this.generateSequentialBodyStmts(compName, node, call_list);

    let body = new compBodyNode(null, null, stmt_list)
    let sequential = new compositeNode(null, head, body) // 已生成该新的 compositeNode

    // 将新生成的 compositeNode 插回到语法树和符号表中
    COStreamJS.ast.push(sequential)
    COStreamJS.S.compTable[compName] = { composite: sequential };

    // 构造 compositeCallNode
    const compositeCall = new compositeCallNode(null, compName, node.inputs)
    compositeCall.outputs = node.outputs

    setTop(top.prev) // 还原至上层符号表
    return compositeCall
}

/**
 * 对于如下形式的 squential 和 Dense 的例子
 * Out = squential (In, Y) (784) {
 *      add Dense(100);
        add Dense(10);
    };
 * 我们要生成的 stmt_list 的格式为{
 * @param {sequentialNode} sequential
 * @param {layerNode[]} layers
 * @returns {statement[]}
 */
UnfoldComposite.prototype.generateSequentialBodyStmts = function (compName, sequential, layers) {
    const result = []
    let currentLevel = 0 /** 当前层级计数器, 用于数据流名的构造 */

    // 0. 将层连接起来
    for (let i = 0; i < layers.length - 1; i++) {
        layers[i].level = ++currentLevel
        layers[i].nextLayer = layers[i + 1]
        layers[i + 1].prevLayer = layers[i]
    }
    layers[layers.length - 1].level = ++currentLevel

    // 1. 确定每一层的输入输出规模 执行完后, this.rows 有值了
    layers.forEach(layer => layer.init(sequential))

    // 2. 在语法树的头部插入权值矩阵 二维数组的声明 例如_weight_0[784][100], _weight_1[100][10]
    for (let layer of layers) {
        const weightName = '_weight_' + layer.level
        switch (layer.constructor) {
            case denseLayerNode: {
                // 全局声明 double _weight_[prevDim][dim];
                const declStr = `double ${weightName}[${layer.rows}][${layer.cols}];`
                const declare = COStreamJS.parser.parse(declStr) // 这里使用了parse字符串的方式来创建了语法树节点. 在 c++ 对应的地方要手动构建

                COStreamJS.ast.unshift(declare);
                COStreamJS.S.variableTable[weightName] = new Variable('double', weightName, new ArrayConstant('double'))
                break
            }
            default: break;
        }
    }

    // 3.
    // 声明stream stream<double x>...
    const strType = new strdclNode(null, 'double', 'x')
    const streamDecl = new declareNode(null, strType, ['copy_1', 'copy_2']) // stream<double x>copy_1,copy_2;
    result.push(streamDecl)
    result.push(this.MakeCopyOperator())


    // 用于存储前向传播给反向传播的数据流
    // 输入sequential的训练集在反向传播中仍然需要
    const temp_stream_list = [['copy_2']]
    let temp_stream = ['copy_1']
    debugger;
    // 展开前向传播composite
    for (let layer of layers) {
        let call_inputs = [], call_outputs = []
        if (layer !== layers[layers.length - 1]) { // 如果不是最后一个 layer
            const namePrefix = '_F' + layer.layerName + layer.level + '_' // 前缀, 例如 _FDENSE1_
            // 正向传递给下一层的stream名称, 例如 _FDENSE1_FDENSE2
            const tempName1 = namePrefix + 'F' + layer.nextLayer.layerName + layer.nextLayer.level
            // 将数据流声明加入
            streamDecl.init_declarator_list.push(tempName1)
            call_inputs = [temp_stream[0]]
            if (layer.nextLayer instanceof averagePooling2DLayerNode) {
                call_outputs = [tempName1]
            } else {
                // 传递给反向传播中本层的stream名称, 例如 _FDENSE1_BDENSE2
                const tempName2 = namePrefix + 'B' + layer.nextLayer.layerName + layer.nextLayer.level
                streamDecl.init_declarator_list.push(tempName2)
                call_outputs = [tempName1, tempName2]
                temp_stream_list.push([tempName2])
            }
            temp_stream.pop()
            temp_stream.push(call_outputs[0])

        } else { // 如果是最后一个 layer
            /* 
                * 训练过程
                正向传播的最后一层不同于其他层，只有一个输出流： call_inputs = new list<Node *>({temp_stream->front()});
                * 测试过程
                只有正向传播的时候, output为输出：call_outputs = new list<Node *>({outputs->front()});
            */
            const tempName = '_F' + layer.layerName + layer.level + '_loss'
            call_inputs = [temp_stream[0]]
            call_outputs = [tempName]
            temp_stream.pop()
            temp_stream.push(tempName)
            streamDecl.init_declarator_list.push(tempName)
        }
        // 构造实际的正向传播composite
        const comp = MakeForwardComposite(layer, call_outputs.length == 1)
        const call = new compositeCallNode(null, comp.compName, call_inputs)
        call.outputs = call_outputs
        result.push(new binopNode(null, call_outputs, '=', call))
    }
    // dl/dy的输入为y, y`
    // 展开反向传播composite, 最后一层的composite的输入为实际预测和期望预测的输入流 也即temp_stream和 与y_stream
    const call_inputs = [temp_stream[0], 'Y'], call_outputs = ['_Loss']
    streamDecl.init_declarator_list.push('_Loss')
    const loss_comp = MakeLossComposite(layers[layers.length - 1])
    const loss_call = new compositeCallNode(null, loss_comp.compName, call_inputs)
    loss_call.outputs = call_outputs
    result.push(new binopNode(null, call_outputs, '=', loss_call))
    // 正向传播展开完毕 
    // 开始展开反向传播
    temp_stream = ['_Loss']
    for (let layer of layers.slice().reverse()) {
        let call_inputs, call_outputs
        if (layer instanceof averagePooling2DLayerNode) {
            call_inputs = [temp_stream]
        } else {
            temp_stream_list[temp_stream_list.length - 1].unshift(temp_stream[0])
            call_inputs = temp_stream_list.pop()
        }
        if (layer !== layers[0]) {
            const namePrefix = 'B_' + layer.layerName + layer.level + '_' // B_DENSE2_
            const tempName = namePrefix + layer.prevLayer.layerName + layer.prevLayer.level // B_DENSE2_DENSE1
            call_outputs = [tempName]
        } else {
            call_outputs = ['Out']
        }
        streamDecl.init_declarator_list.push(call_outputs[0])
        temp_stream = [call_outputs[0]]
        const back_comp = MakeBackComposite(layer)
        const back_call = new compositeCallNode(null, back_comp.compName, call_inputs)
        back_call.outputs = call_outputs
        result.push(new binopNode(null, call_outputs, '=', back_call))
    }

    // 反向传播展开完毕



    debugger;
    return result;
}

/**  
 * 返回一个将输入数据流拷贝2份的 operator 
 * (copy_1, copy_2) = copy(In){
 *     work{
 *          copy_1[0].x = In[0].x;
 *          copy_2[0].x = In[0].x;
 *     }
 *     window{
 *          In sliding(1,1);
 *          copy_1 tumbling(1);
 *          copy_2 tumbling(1);
 *     }
 * }
 * @returns {binopNode}
*/
UnfoldComposite.prototype.MakeCopyOperator = function () {
    /** @type {compositeNode} */
    const composite = COStreamJS.parser.parse(`
    composite copy(input stream<double x>In, output stream<double x>copy_1, stream<double x>copy_2){
      (copy_1, copy_2) = copy(In){
         work{
              copy_1[0].x = In[0].x;
              copy_2[0].x = In[0].x;
         }
         window{
              In sliding(1,1);
              copy_1 tumbling(1);
              copy_2 tumbling(1);
         }
      };
    }`)[0]
    return composite.body.stmt_list[0]
}

/**
 * @returns {compositeNode}
 */
function MakeForwardComposite(/** @type {layerNode} */layer, isLast) {
    if (layer instanceof denseLayerNode) {
        return MakeDenseComposite(layer, isLast)
    }
}

/* 构建如下的 dense 层的 composite, 其中需要处理 level 和输出输出窗口大小. 构建完成后加入符号表
 *
  composite dense_1(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1) {
    (Out0,Out1) = dense_1(In){
        init{
            int i,j;
            for(i=0;i<784;i++){
                for(j=0;j<100;j++){
                    _weight_1[i][j]=0;
                }		
            }		
        }
        work{
            int i,j;
            double temp;
            for(j=0;j<100;j++){
                temp = 0;
                for(i=0;i<784;i++){
                    temp += In[i].x * _weight_1[i][j] ;
                }
                Out0[j].x = temp;
                Out1[j].x = temp;
            }	
        }
        window{
            In sliding(784,784);
            Out0 tumbling(100,100);
            Out1 tumbling(100,100);
        }
    };
  }
*/
function MakeDenseComposite(/** @type {denseLayerNode} */layer, isLast = false) {
    const { level, rows, cols } = layer
    if (isLast) {
        var compStr = `composite dense_${level}(input stream<double x>In, output stream<double x>Out) {
            Out = dense_${level}(In){
                init{
                    int i,j;
                    for(i=0;i<${rows};i++){
                        for(j=0;j<${cols};j++){
                            _weight_${level}[i][j]=0;
                        }
                    }
                }
                work{
                    int i,j;
                    double temp;
                    for(j=0;j<${cols};j++){
                        temp = 0;
                        for(i=0;i<${rows};i++){
                            temp += In[i].x * _weight_${level}[i][j] ;
                        }
                        Out[j].x = temp;
                    }
                }
                window{
                    In sliding(${rows},${rows});
                    Out tumbling(${cols},${cols});
                }
            };
          }`
    } else {
        var compStr = `composite dense_${level}(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1) {
            (Out0,Out1) = dense_${level}(In){
                init{
                    int i,j;
                    for(i=0;i<${rows};i++){
                        for(j=0;j<${cols};j++){
                            _weight_${level}[i][j]=0;
                        }
                    }
                }
                work{
                    int i,j;
                    double temp;
                    for(j=0;j<${cols};j++){
                        temp = 0;
                        for(i=0;i<${rows};i++){
                            temp += In[i].x * _weight_${level}[i][j] ;
                        }
                        Out0[j].x = temp;
                        Out1[j].x = temp;
                    }
                }
                window{
                    In sliding(${rows},${rows});
                    Out0 tumbling(${cols},${cols});
                    Out1 tumbling(${cols},${cols});
                }
            };
          }`
    }
    const comp = COStreamJS.parser.parse(compStr)[0]
    // 加入符号表
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)
    return comp
}

function MakeLossComposite(/** @type {layerNode} */layer) {
    let win = 0
    if (layer instanceof denseLayerNode) {
        win = layer.cols
    } else {
        error("未支持的 layer 类型")
    }
    var compStr = `composite loss(input stream<double x>In0, stream<double x>In1, output stream<double x>Out) {
        Out = loss(In0,In1){
            init{}
            work{
                int i;
                for(i=0;i<${win};i++){
                    Out[i].x = In0[i].x - In1[i].x;
                }            
            }
            window{
                In0 sliding(${win},${win});
                In1 sliding(${win},${win});
                Out tumbling(${win},${win});
            }
        };
      }`
    const comp = COStreamJS.parser.parse(compStr)[0]
    // 加入符号表
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)
    return comp
}

function MakeBackComposite(layer) {
    if (layer instanceof denseLayerNode) {
        return MakeDDenseComposite(layer)
    }
}
function MakeDDenseComposite(/** @type {denseLayerNode} */layer) {
    const { level, rows, cols } = layer
    var compStr = `composite dDense_${level}(input stream<double x>In0,stream<double x>In1, output stream<double x>Out) {
        Out = dDense${level}(In0,In1){
            init{}
            work{
                int i,j;
                double temp = 0;
                for (i = 0; i < ${rows}; i++)
                {
                    temp = 0;
                    for (j = 0; j < ${cols}; j++)
                    {
                        temp += In0[j].x * _weight_${level}[i][j];
                    }
                    Out[j].x = temp;
                }
                double lr = 0.100000;
                for (i = 0; i < ${rows}; i++)
                {
                    for (j = 0; j < ${cols}; j++)
                    {
                        _weight_${level}[i][j] = _weight_${level}[i][j] + In0[j].x * In1[i].x * lr;
                    }
                }
            }
            window{
                In0 sliding(${cols},${cols});
                In1 sliding(${rows},${rows});
                Out tumbling(${rows},${rows});
            }
        };
      }`
    const comp = COStreamJS.parser.parse(compStr)[0]
    // 加入符号表
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)
    return comp
}