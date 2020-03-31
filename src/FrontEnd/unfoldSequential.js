import { UnfoldComposite, compositeCallFlow } from "./unfoldComposite"

import { COStreamJS } from "./global"
import { addNode, parenNode, forNode, compositeCallNode, splitjoinNode, pipelineNode, ComInOutNode, compHeadNode, compBodyNode, compositeNode, binopNode, operatorNode, splitNode, roundrobinNode, duplicateNode, joinNode, constantNode, blockNode, declareNode, operBodyNode, winStmtNode, declarator, idNode, inOutdeclNode, strdclNode, unaryNode, conv2DLayerNode, maxPooling2DLayerNode, activationLayerNode } from "../ast/node";
import { top, setTop } from "./generateSymbolTables"
import { SymbolTable, Variable, ArrayConstant } from "./symbol";
import { sequentialNode, denseLayerNode, layerNode, averagePooling2DLayerNode } from "../ast/node";
import { error } from "../utils";




/**
 * 对于如下形式的 squential 和 Dense 的例子
 * Out = squential (In, Y) (784) {
 *      add Dense(100);
 *      add Dense(10);
 * };
 * 我们要连接数据流节点的策略是: 以 loss 为中心, 前后对称地补上 dense 和 dDense , 最后在首部加一个 copy
 * 我们要生成的 composite 的样式为
 *   composite sequential_0(input stream<double x>In, stream<double x>Y, output stream<double x> Out){
 *          stream<double x> copy_1, copy_2, F1_F2, F1_B2, F2_loss, _Loss, B2_B1, Out;
 *          (copy_1,copy2) = copy(In);                     // 内容参见 MakeCopyOperator
            F1_F2,F1_B2=dense_1(copy_1)();
            F2_loss=dense_2(F1_F2)();
            _Loss=loss(F2_loss,Y)();
            B2_B1=dDense_2(_Loss,F1_B2)();
            Out=dDense_1(B2_B1,copy_2)();
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
    layers.forEach(layer => layer.init(sequential));

    // 2. 在语法树的头部插入权值矩阵 二维数组的声明 例如_weight_0[784][100], _weight_1[100][10]
    for (let layer of layers) {
        const weightName = '_weight_' + layer.level
        switch (layer.constructor) {
            case denseLayerNode: {
                // 全局声明 权值矩阵 double _weight_[prevDim][dim];
                const declStr = `double ${weightName}[${layer.rows}][${layer.cols}];`
                const declare = COStreamJS.parser.parse(declStr)[0] // 这里使用了parse字符串的方式来创建了语法树节点. 在 c++ 对应的地方要手动构建

                COStreamJS.ast.unshift(declare);
                COStreamJS.S.variableTable[weightName] = new Variable('double', weightName, new ArrayConstant('double'))
                break
            }
            case conv2DLayerNode: {
                // 全局声明 权值矩阵 double _weight_[filters][depth][rows][cols];
                const depth = layer.inputSize[layer.inputSize.length-1]
                const [rows, cols] = layer.kernel_size
                const declStr = `double ${weightName}[${layer.filters}][${depth}][${rows}][${cols}];`
                const declare = COStreamJS.parser.parse(declStr)[0] // 这里使用了parse字符串的方式来创建了语法树节点. 在 c++ 对应的地方要手动构建

                COStreamJS.ast.unshift(declare);
                COStreamJS.S.variableTable[weightName] = new Variable('double', weightName, new ArrayConstant('double'))
                break;
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
    // 展开前向传播composite
    for (let layer of layers) {
        let call_inputs = [], call_outputs = []
        if (layer !== layers[layers.length - 1]) { // 如果不是最后一个 layer
            const namePrefix = 'F' + layer.level + '_' // 前缀, 例如 F1_
            // 正向传递给下一层的stream名称, 例如 F1_F2
            const tempName1 = namePrefix + 'F' + layer.nextLayer.level
            // 将数据流声明加入
            streamDecl.init_declarator_list.push(tempName1)
            call_inputs = [temp_stream[0]]
            if (layer.nextLayer instanceof averagePooling2DLayerNode || layer.nextLayer instanceof activationLayerNode) {
                call_outputs = [tempName1]
            } else {
                // 传递给反向传播中本层的stream名称, 例如 F1_B2
                const tempName2 = namePrefix + 'B' + layer.nextLayer.level
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
            const tempName = 'F' + layer.level + '_loss'
            call_inputs = [temp_stream[0]]
            call_outputs = [tempName]
            temp_stream.pop()
            temp_stream.push(tempName)
            streamDecl.init_declarator_list.push(tempName)
            
        }
        if(layer instanceof activationLayerNode){
            const tempName3 = `F${layer.level}_B${layer.level}`
            streamDecl.init_declarator_list.push(tempName3)
            call_outputs.push(tempName3)
        }
        // 构造实际的正向传播composite
        const comp = MakeForwardComposite(layer, call_outputs.length == 1)
        const call = new compositeCallNode(null, comp.compName, call_inputs)
        call.outputs = call_outputs
        result.push(new binopNode(null, call_outputs, '=', call))
    }
    debugger;
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
            call_inputs = [temp_stream[0]]
        }else if(layer instanceof activationLayerNode){
            call_inputs = [temp_stream[0], `F${layer.level}_B${layer.level}`]
        }else {
            temp_stream_list[temp_stream_list.length - 1].unshift(temp_stream[0])
            call_inputs = temp_stream_list.pop()
        }
        if (layer !== layers[0]) {
            const namePrefix = 'B' + layer.level + '_'
            const tempName = namePrefix + 'B' + layer.prevLayer.level // 例如 B2_B1
            call_outputs = [tempName]
        } else {
            call_outputs = ['Out']
        }
        if(call_outputs[0] !== 'Out') streamDecl.init_declarator_list.push(call_outputs[0])
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
 * (copy_1, copy_2) = _copy(In){
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
      (copy_1, copy_2) = _copy(In){
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

/** @returns {compositeNode} */
function MakeForwardComposite(/** @type {layerNode} */layer, singleOutput) {
    let comp;
    if (layer instanceof denseLayerNode) {
        comp = MakeDenseComposite(layer, singleOutput)
    }else if(layer instanceof conv2DLayerNode) {
        comp = MakeConv2DComposite(layer, singleOutput)
    }else if(layer instanceof maxPooling2DLayerNode){
        comp = makeMaxPooling2DLayer(layer, singleOutput)
    }else if(layer instanceof averagePooling2DLayerNode){
        comp = makeAveragePooling2DLayer(layer, singleOutput)
    }else if(layer instanceof activationLayerNode){
        comp = makeActivationLayer(layer)
    }
    // 加入符号表
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)
    return comp
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
function MakeDenseComposite(/** @type {denseLayerNode} */layer, singleOutput = false) {
    const { level, rows, cols } = layer
    if (singleOutput) {
        var compStr = `composite dense_${level}(input stream<double x>In, output stream<double x>Out) {
            Out = dense_${level}(In){
                init{
                    int i,j;
                    for(i=0;i<${rows};i++){
                        for(j=0;j<${cols};j++){
                            _weight_${level}[i][j]= random() - 0.5;
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
                            _weight_${level}[i][j]=0.01;
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
    return COStreamJS.parser.parse(compStr)[0]
}

/** @returns {compositeNode} */
function MakeConv2DComposite(/** @type {conv2DLayerNode} */ layer, singleOutput){
    const conv2D_comp = MakeConv2DKernel(layer)
    COStreamJS.S.compTable[conv2D_comp.compName] = { composite: conv2D_comp }
    COStreamJS.ast.push(conv2D_comp)

    if(singleOutput){
        return COStreamJS.parser.parse(`
        composite conv2DLayer_${layer.level}(input stream<double x>In, output stream<double x>Out){
            int i;
            Out = splitjoin(In){
                split duplicate();
                for(i = 0; i < ${layer.filters} ;i++){
                    add ${conv2D_comp.compName}(i);
                }
                join roundrobin();
            };
        }
        `)[0]
    }
    return COStreamJS.parser.parse(`
        composite conv2DLayer_${layer.level}(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1){
            stream<double x> MID;
            int i;
            MID = splitjoin(In){
                split duplicate();
                for(i = 0; i < ${layer.filters} ;i++){
                    add ${conv2D_comp.compName}(i);
                }
                join roundrobin();
            };
            (Out0, Out1) = _copy(MID){
                work{
                    Out0[0].x = MID[0].x;
                    Out1[0].x = MID[0].x;
                }
                window{
                    MID sliding(1,1);
                    Out0 tumbling(1);
                    Out1 tumbling(1);
                }
             };

        }
        `)[0]
    
}
function MakeConv2DKernel(/** @type {conv2DLayerNode} */ layer){
    const { level, strides } = layer
    const [inputSize0,inputSize1,depth] = layer.inputSize // inputSize0 用不到但不要删除
    const inputWindowSize = layer.inputSize.reduce((a,b)=>a*b)
    const [rows,cols] = layer.kernel_size
    const [m,n] = layer.outputFeatureMapSize
    return COStreamJS.parser.parse(`
        composite conv2DKernel_${level}(input stream<double x>In, output stream<double x>Out){
            param 
                int kernelIndex;
            Out = conv2D_${level}(In){
                init {
                    int j,n,m;
                    for(j=0;j<${depth};j++){
                        for(n=0;n<${rows};n++){
                            for(m=0;m<${cols};m++){
                                _weight_${level}[kernelIndex][j][n][m]= random() - 0.5;
                            }		
                        }		
                    }		
                }
                work {
                    int i, j, n, m, d, pushIndex = 0;
                    double temp;
                    for (m = 0; m < ${m}; m++){
                        for (n = 0; n < ${n}; n++){
                            temp = 0;
                            for (d = 0; d < ${depth}; d++){
                                for (i = 0; i < ${rows}; i++){
                                    for (j = 0; j < ${cols}; j++){
                                        // 取一个 三维 [inputSize0][inputSize1][depth] 向量 的 in[m*strides0+i][n*strides1+j][d] 的线性下标
                                        int index = d + (n * ${strides[1]} + j) * ${depth} + (m * ${strides[0]} + i) * ${inputSize1} * ${depth} ;
                                        temp += In[index].x * _weight_${level}[kernelIndex][d][i][j];
                                    }
                                }
                            }
                            Out[pushIndex].x = temp;
                            pushIndex++;
                        }
                    }
                }
                window {
                    In sliding(${inputWindowSize}, ${inputWindowSize});
                    Out tumbling(${m*n});
                }
            };
        }
    `)[0]
}
function MakeLossComposite(/** @type {layerNode} */layer) {
    let win = 0
    if (layer instanceof denseLayerNode) {
        win = layer.cols
    }else if(layer instanceof activationLayerNode){
        win = layer.count
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
function makeMaxPooling2DLayer(/** @type {maxPooling2DLayerNode} */layer, singleOutput = false){
    const comp = makeMaxPooling2DKernel(layer)
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)

    if(singleOutput){
        return COStreamJS.parser.parse(`
        composite maxPooling2DLayer_${layer.level}(input stream<double x>In, output stream<double x>Out){
            int i;
            Out = splitjoin(In){
                split roundrobin();
                for(i = 0; i < ${layer.depth} ;i++){
                    add ${comp.compName}(i);
                }
                join roundrobin();
            };
        }
        `)[0]
    }
    return COStreamJS.parser.parse(`
        composite maxPooling2DLayer_${layer.level}(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1){
            stream<double x> MID;
            int i;
            MID = splitjoin(In){
                split roundrobin();
                for(i = 0; i < ${layer.depth} ;i++){
                    add ${comp.compName}();
                }
                join roundrobin();
            };
            (Out0, Out1) = _copy(MID){
                work{
                    Out0[0].x = MID[0].x;
                    Out1[0].x = MID[0].x;
                }
                window{
                    MID sliding(1,1);
                    Out0 tumbling(1);
                    Out1 tumbling(1);
                }
             };

        }
        `)[0]
}
function makeMaxPooling2DKernel(/** @type {maxPooling2DLayerNode} */layer){
    const { level } = layer
    const [output0,output1] = layer.outputPooledSize
    const size = layer.pool_size
    const inputWindowSize = layer.inputSize[0] * layer.inputSize[1]
    const [_,inputSize1] = layer.inputSize
    return COStreamJS.parser.parse(`
        composite maxPooling2DKernel_${level}(input stream<double x>In, output stream<double x>Out){
            Out = maxPooling2D_${level}(In){
                init {}
                work {
                    int i, j, n, m;
                    double max;
                    for (m = 0; m < ${output0}; m++){
                        for (n = 0; n < ${output1}; n++){
                            i = 0;
                            j = 0;
                            max = In[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x;
                            for (i = 0; i < ${size}; i++){
                                for (j = 0; j < ${size}; j++){
                                    if (max < In[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x){
                                        max = In[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x;
                                    }
                                }
                            }
                            Out[m*${output1} +n].x = max;
                        }
                    }
                }
                window {
                    In sliding(${inputWindowSize}, ${inputWindowSize});
                    Out tumbling(${output0*output1});
                }
            };
        }
    `)[0]
}
function makeAveragePooling2DLayer(/** @type {averagePooling2DLayerNode} */layer, singleOutput = false){

}
function makeActivationLayer(/** @type {activationLayerNode} */layer){
    const { level, count } = layer
    const funcName = layer.arg_list[0].source.slice(1,-1) // 刚拿到是 "relu", 通过 slice 移出左右两侧双引号
    if(!["relu", "softmax","sigmoid"].includes(funcName)){
        error(layer._loc, `不支持此种激活函数:${funcName}, 仅支持 relu,softmax,sigmoid`)
    }
    const works = {
        "relu":     `for (i = 0; i < ${count}; i++){
                        if (In[i].x > 0){
                            out0[i].x = In[i].x;
                            out1[i].x = In[i].x;
                            derivative[i].x = 1;
                        }
                        else{
                            out0[i].x = 0;
                            out1[i].x = 0;
                            derivative[i].x = 0;
                        }
                    }`,
        "softmax": `double total = 0, res;
                    for (i = 0; i < ${count}; i++){
                        total += exp(In[i].x);
                    }
                    for (i = 0; i < ${count}; i++){
                        res = exp(In[i].x) / total;
                        out0[i].x = res;
                        out1[i].x = res;
                        derivative[i].x = res;
                    }`,
        "sigmoid": `double res;
                    for (i = 0; i < ${count}; i++) {
                        res = 1 / ( 1 + exp(-In[i].x));
                        out0[i].x = res;
                        out1[i].x = res;
                        derivative[i].x = res * (1 - res);
                    }
        `
    }
    if (!layer.nextLayer || layer.nextLayer instanceof averagePooling2DLayerNode) {
        var compStr = `composite Activation_${level}(input stream<double x>In, output stream<double x>out0, stream<double x>derivative) {
            (out0,derivative) = activation_${funcName}_${level}(In){
                init{}
                work{
                    int i;
                    ${works[funcName].split('\n').filter(str => !(/out1/.test(str))).join('\n')}
                }
                window{
                    In sliding(${count},${count});
                    out0 tumbling(${count},${count});
                    derivative tumbling(${count},${count});
                }
            };
            }`
    } else {
        var compStr = `composite Activation_${level}(input stream<double x>In, output stream<double x>out0,stream<double x>out1, stream<double x>derivative) {
            (out0,out1,derivative) = activation_${funcName}_${level}(In){
                init{}
                work{
                    int i;
                    ${works[funcName]}
                }
                window{
                    In sliding(${count},${count});
                    out0 tumbling(${count},${count});
                    out1 tumbling(${count},${count});
                    derivative tumbling(${count},${count});
                }
            };
          }`
    }
    return COStreamJS.parser.parse(compStr)[0]
}

function MakeBackComposite(layer) {
    if (layer instanceof denseLayerNode) {
        var comp = MakeDDenseComposite(layer)
    }else if(layer instanceof conv2DLayerNode){
        var comp = MakeDConv2DComposite(layer)
    }else if(layer instanceof maxPooling2DLayerNode){
        var comp = makeDMaxPooling2DLayer(layer)
    }else if(layer instanceof activationLayerNode){
        var comp = makeDActivitionComposite(layer)
    }
    // 加入符号表
    COStreamJS.S.compTable[comp.compName] = { composite: comp }
    COStreamJS.ast.push(comp)
    return comp
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
                    Out[i].x = temp;
                }
                double lr = 0.100000;
                for (i = 0; i < ${rows}; i++)
                {
                    for (j = 0; j < ${cols}; j++)
                    {
                        _weight_${level}[i][j] = _weight_${level}[i][j] - In0[j].x * In1[i].x * lr;
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
    return COStreamJS.parser.parse(compStr)[0]
}
// 生成名为"dConv2DLayer_" + level 的卷积层反向传播计算节点
function MakeDConv2DComposite(/** @type {conv2DLayerNode} */ layer){
    const { level } = layer
    const comp =  COStreamJS.parser.parse(`
        composite dConv2DLayer_${level}(input stream<double x>In0,stream<double x>In1, output stream<double x>Out) {
            ;
        }
    `)[0]
    comp.body.stmt_list = MakeDConv2DLayerBodyStmt(layer, comp)
    return comp
}

/** @returns {binopNode} */
function operToBinop(/** @type {operatorNode} */oper){
    return new binopNode(null, new parenNode(null, oper.outputs), '=', oper)
}
function MakeDConv2DLayerBodyStmt(/** @type {conv2DLayerNode} */ layer, /** @type {compositeNode} */comp){
    const compStmtList = [] // 要返回的 body_stmt
    let streamName = "DConv2dStream_" + layer.level;
    
    // join operator的输入流
    let inputs_join = [];
    // list<compositeCallNode *> *comCallList = new list<compositeCallNode *>();

    const strType = comp.inout.input_list[0].strType
    const streamDecl = new declareNode(null, strType, []);

    // 数据流声明 stream<double x> dilateAndExtend_2;
    const dilateAndExtendStream = "dilateAndExtend_" + layer.level
    streamDecl.init_declarator_list.push(dilateAndExtendStream)
    compStmtList.push(streamDecl);

    // 构建 Dilate_Extend 
    compStmtList.push(makeConv2DDilateAndExtendOperator(layer, ["In0"], [dilateAndExtendStream]));

    let dupCount = layer.inputSize[layer.inputSize.length - 1];
    // splitOperator1 将误差duplicate成filters份, splitOperator2 将传入正向传播的输入再次传入到反向传播中,并duplicate成多份
    const splitOperator1 = makeSpecialSplitOperator(dilateAndExtendStream, dupCount, layer.level);
    const splitOperator2 = makeSpecialSplitOperator('In1', dupCount, layer.level);
    compStmtList.push(operToBinop(splitOperator1));
    compStmtList.push(operToBinop(splitOperator2));

    // 加入数据流声明中
    debugger;
    [...splitOperator1.outputs, ...splitOperator2.outputs].forEach(name => streamDecl.init_declarator_list.push(name))
    
    const dKernelComp = makeDConv2DKernel(layer);
    //开始连接 oper
    for(let i=0; i< dupCount; i++){
        const tempName = streamName + "_" + i;
        streamDecl.init_declarator_list.push(tempName)

        //compositeCall的输出流是join节点的输入流
        inputs_join.push(tempName);

        // kernel的输出流
        const call_outputs = [tempName];
        //compositeCall的输入流
        const call_inputs = [splitOperator1.outputs[i], splitOperator2.outputs[i]]
        // compositeCallNode *call = new compositeCallNode(call_outputs, tempName, argList, call_inputs, dKernelComp);
        const call = new compositeCallNode(null,dKernelComp.compName, call_inputs, [new constantNode(null,i)]);
        call.outputs = call_outputs
        compStmtList.push(call);
    }

    const joinOperator = makeSpecialJoinOperator('Out', inputs_join, layer.level);
    compStmtList.push(operToBinop(joinOperator));

    return compStmtList;
}

function makeConv2DDilateAndExtendOperator(/** @type {conv2DLayerNode} */ layer, inputs_id, outputs_id){
    const level = layer.level
    const [stride0, stride1] = layer.strides
    const [kernel0, kernel1] = layer.kernel_size
    const [inputErrorSize0,inputErrorSize1] = layer.inputErrorSize
    const filters = layer.filters
    const [outputFeatureMapSize0,outputFeatureMapSize1] = layer.outputFeatureMapSize
    const slidingWindowSize = outputFeatureMapSize0 * outputFeatureMapSize1 * filters
    const tumblingWindowSize = inputErrorSize0 * inputErrorSize1 * filters

    return COStreamJS.parser.parse(`
        composite conv2D_Dilate_Extend_${level}(){
            ${outputs_id} = conv2D_Dilate_Extend_${level}(${inputs_id}){
                init{}
                work{
                    int i, j, filters;
                    for (i=0;i<${tumblingWindowSize};i++){
                        dilateAndExtend_${level}[i].x = 0;
                    }
                    for (i = 0; i < ${outputFeatureMapSize0}; i++){
                        for (j = 0; j < ${outputFeatureMapSize1}; j++){
                            for (filters = 0; filters < ${filters}; filters++){
                                // [i][j][filters] => [kernel0 + i * stride0][kernel1 + j * stride1][filters];
                                int dilate_index = (${stride0} * i + ${kernel0}) * ${inputErrorSize1*filters} + (${stride1} * j + ${kernel1}) * ${filters} + filters;
                                int in_index = i * ${outputFeatureMapSize1*filters} + j * ${filters} + filters;
                                dilateAndExtend_${level}[dilate_index].x = ${inputs_id}[in_index].x;
                            }
                        }
                    }
                }
                window{
                    ${inputs_id} sliding(${slidingWindowSize},${slidingWindowSize});
                    ${outputs_id} tumbling(${tumblingWindowSize});
                }
            };
        }
    `)[0].body.stmt_list[0]
}
function makeDConv2DKernel(/** @type {conv2DLayerNode} */ layer){
    const { level, filters } = layer
    const [inputSize0,inputSize1, depth] = layer.inputSize
    const [kernel0, kernel1] = layer.kernel_size
    const [inputErrorSize0,inputErrorSize1] = layer.inputErrorSize
    const [stride0, stride1] = layer.strides
    const slidingWindowSize = inputErrorSize0 * inputErrorSize1 * filters
    const in1_WindowSize = inputSize0 * inputSize1 * depth

    const comp = COStreamJS.parser.parse(`
        composite dConv2D_${level}(input stream<double x>in0, stream<double x>in1, output stream<double x>out){
            param
                int depthIndex;
            out = dConv2D_${level}(in0,in1){
                init{}
                work{
                    int i, j, n, m, filterIndex;
                    double temp;
                    for (m = 0; m < ${inputSize0}; m++){
                        for (n = 0; n < ${inputSize1}; n++){
                            temp = 0;
                            for (filterIndex = 0; filterIndex < ${filters}; filterIndex++){
                                for (i = 0; i < ${kernel0}; i++){
                                    for (j = 0; j < ${kernel1}; j++){
                                        temp += in0[(m + i) * ${inputErrorSize1} * ${filters} + (n + j) * ${filters} + filterIndex].x * _weight_${level}[filterIndex][depthIndex][${kernel0-1} - i][${kernel1-1} - j];
                                    }
                                }
                            }
                            out[m * ${inputSize1} + n].x = temp;
                        }
                    }
                    for (filterIndex = 0; filterIndex < ${filters}; filterIndex++){
                        for (i = 0; i < ${kernel0}; i++){
                            for (j = 0; j < ${kernel1}; j++){
                                temp = 0;
                                for (m = 0; m < ${inputSize0}; m++){
                                    for (n = 0; n < ${inputSize1}; n++){
                                        int in0_index = ( ${kernel0} - 1 + m * ${stride0} ) * ${inputErrorSize1*filters} + (${kernel1} -1 + n * ${stride1}) * ${filters} + filterIndex;
                                        int in1_index = ( i + m * ${stride0} ) * ${inputSize1*depth} + ( j + n*${stride1} )*${depth} + depthIndex;
                                        temp += in0[in0_index].x * in1[in1_index].x;
                                    }
                                }
                                _weight_${level}[filterIndex][depthIndex][i][j] -= temp;
                            }
                        }
                    }
                }
                window{
                    in0 sliding(${slidingWindowSize},${slidingWindowSize});
                    in1 sliding(${in1_WindowSize},${in1_WindowSize});
                    out tumbling(${inputSize0 * inputSize1});
                }
            };
        }
    `)[0]
    COStreamJS.S.compTable[comp.compName] = { composite: comp };
    COStreamJS.ast.push(comp);
    return comp;
}

function makeSpecialSplitOperator(inputStreamName, splitCount, level, isRoundrobin = undefined){
    const outputs = Array.from({length: splitCount}).map((_,idx)=> inputStreamName+'_'+idx);
    if(isRoundrobin){
        return COStreamJS.parser.parse(`
        composite special_roundrobin(input stream<double x>${inputStreamName}){
            (${outputs.join(',')}) = special_roundrobin_${level}(${inputStreamName}){
                init{}
                work{
                    ${outputs.map((name,idx) => `${name}[0] = ${inputStreamName}[${idx}];`).join('\n')}
                }
                window{
                    ${inputStreamName} sliding(${splitCount},${splitCount});
                    ${outputs.map(name => name + ' tumbling(1);').join('\n')}
                }
            };
        }
    `)[0].body.stmt_list[0].right
    }
    return COStreamJS.parser.parse(`
        composite special_duplicate(input stream<double x>${inputStreamName}){
            (${outputs.join(',')}) = special_duplicate_${level}(${inputStreamName}){
                init{}
                work{
                    ${outputs.map(name => name + '[0]=' + inputStreamName + '[0];').join('\n')}
                }
                window{
                    ${inputStreamName} sliding(1,1);
                    ${outputs.map(name => name + ' tumbling(1);').join('\n')}
                }
            };
        }
    `)[0].body.stmt_list[0].right
}

function makeSpecialJoinOperator(outputStreamName, /** @type {string[]} */inputs, level){
    return COStreamJS.parser.parse(`
        composite special_join(output stream<double x>${outputStreamName}){
            ${outputStreamName} = special_join_${level}(${inputs.join(',')}){
                init{}
                work{
                    int i=0;
                    ${inputs.map(name => outputStreamName +'[i++] = ' + name + '[0];').join('\n')}
                }
                window{
                    ${inputs.map(name => name + ' sliding(1,1);').join('\n')}
                    ${outputStreamName} tumbling(${inputs.length});
                }
            };
        }
    `)[0].body.stmt_list[0].right
}
function makeDMaxPooling2DLayer(/** @type {maxPooling2DLayerNode} */layer){
    const { level } = layer
    const comp =  COStreamJS.parser.parse(`
        composite dMaxPooling2DLayer_${level}(input stream<double x>In0,stream<double x>In1, output stream<double x>Out) {
            ;
        }
    `)[0]
    comp.body.stmt_list = makeDMaxPooling2DBodyStmt(layer, comp)
    return comp
}
function makeDMaxPooling2DBodyStmt(/** @type {maxPooling2DLayerNode} */layer, comp){
    const compStmtList = [] // 要返回的 body_stmt
    let streamName = "DMaxPooling2D_Stream_" + layer.level;
    
    // join operator的输入流
    let inputs_join = [];

    const strType = comp.inout.input_list[0].strType
    const streamDecl = new declareNode(null, strType, []);
    compStmtList.push(streamDecl);

    let dupCount = layer.inputSize[layer.inputSize.length - 1];
    // splitOperator1 将误差roundrobin成filters份, splitOperator2 将传入正向传播的输入再次传入到反向传播中,并roundrobin成多份
    const splitOperator1 = makeSpecialSplitOperator("In0", dupCount, layer.level,1);
    const splitOperator2 = makeSpecialSplitOperator('In1', dupCount, layer.level,1);
    compStmtList.push(operToBinop(splitOperator1));
    compStmtList.push(operToBinop(splitOperator2));

    // 加入数据流声明中
    debugger;
    [...splitOperator1.outputs, ...splitOperator2.outputs].forEach(name => streamDecl.init_declarator_list.push(name))
    
    const dKernelComp = makeDMaxPooling2DKernel(layer);
    //开始连接 oper
    for(let i=0; i< dupCount; i++){
        const tempName = streamName + "_" + i;
        streamDecl.init_declarator_list.push(tempName)

        //compositeCall的输出流是join节点的输入流
        inputs_join.push(tempName);

        // kernel的输出流
        const call_outputs = [tempName];
        //compositeCall的输入流
        const call_inputs = [splitOperator1.outputs[i], splitOperator2.outputs[i]]
        // compositeCallNode *call = new compositeCallNode(call_outputs, tempName, argList, call_inputs, dKernelComp);
        const call = new compositeCallNode(null,dKernelComp.compName, call_inputs);
        call.outputs = call_outputs
        compStmtList.push(call);
    }

    const joinOperator = makeSpecialJoinOperator('Out', inputs_join, layer.level);
    compStmtList.push(operToBinop(joinOperator));

    return compStmtList;
}
function makeDMaxPooling2DKernel(/** @type {maxPooling2DLayerNode} */layer){
    const { level } = layer
    const [error0,error1] = layer.outputPooledSize
    const [inputSize0, inputSize1] = layer.inputSize
    const size = layer.pool_size
  
    const comp = COStreamJS.parser.parse(`
        composite dMaxPooling2DKernel_${level}(input stream<double x>in0, stream<double x>in1, output stream<double x>out){
            out = dMaxPooling2DKernel_${level}(in0,in1){
                init{}
                work{
                    int i, j, n, m;
                    double max;
                    for (m = 0; m < ${error0}; m++){
                        for (n = 0; n < ${error1}; n++){
                            i = 0;
                            j = 0;
                            max = in1[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x;
                            for (i = 0; i < ${size}; i++){
                                for (j = 0; j < ${size}; j++){
                                    if (max < in1[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x){
                                        max = in1[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x;
                                    }
                                }
                            }
                            for (i = 0; i < ${size}; i++){
                                for (j = 0; j < ${size}; j++){
                                    if (max == in1[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x){
                                        out[(m * ${size} + i) * ${inputSize1} + n * ${size} + j].x = in0[m * ${error1} + n].x;
                                    }
                                }
                            }
                        }
                    }
                }
                window{
                    in0 sliding(${error0 * error1},${error0 * error1});
                    in1 sliding(${inputSize0 * inputSize1},${inputSize0 * inputSize1});
                    out tumbling(${inputSize0 * inputSize1});
                }
            };
        }
    `)[0]
    COStreamJS.S.compTable[comp.compName] = { composite: comp };
    COStreamJS.ast.push(comp);
    return comp;
  }

function makeDActivitionComposite(/** @type {activationLayerNode} */layer){
    const { level, count } = layer
    const funcName = layer.arg_list[0].source.slice(1,-1) // 刚拿到是 "relu", 通过 slice 移出左右两侧双引号
    if(!["relu", "softmax","sigmoid"].includes(funcName)){
        error(layer._loc, `不支持此种激活函数:${funcName}, 仅支持 relu,softmax,sigmoid`)
    }
    const works = {
        "relu":     `for (i = 0; i < ${count}; i++) {
                        out[i].x = error[i].x * In[i].x;
                    }`,
        "softmax": `int j;
                    for(i = 0; i < ${count}; i++) {
                        double temp = 0;
                        for (j = 0; j < ${count}; j++) {
                            if (i == j) {
                                temp += error[j].x * In[i].x * (1 - In[i].x);
                            } else {
                                temp += error[j].x * In[i].x * In[j].x;
                            }
                        }
                        out[i].x = temp;
                    }`,
        "sigmoid": `for (i = 0; i < ${count}; i++) {
                        out[i].x = error[i].x * In[i].x;
                    }`,
    }

    var compStr = `composite DActivation_${level}(input stream<double x>error, stream<double x>In, output stream<double x>out) {
        out = dActivation_${funcName}_${level}(error, In){
            init{}
            work{
                int i;
                ${works[funcName]}
            }
            window{
                In sliding(${count},${count});
                error sliding(${count},${count});
                out tumbling(${count},${count});
            }
        };
        }`
    return COStreamJS.parser.parse(compStr)[0]
}