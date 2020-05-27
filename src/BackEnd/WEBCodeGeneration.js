import { COStreamJS, setTop } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode, blockNode, operatorNode, fileReaderNode } from "../ast/node";
import { FlatNode } from "../FrontEnd/FlatNode"
import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { Partition } from "./Partition"
import { error } from "../utils";
import { fileWriterNode } from "../ast/node";
import "../ast/toJS"

export class WEBCodeGeneration {

    constructor(nCpucore, ssg, mp) {

        this.nCpucore = nCpucore
        /**@type {StaticStreamGraph} */
        this.ssg = ssg
        /**@type {Partition} */
        this.mp = mp
    }
}
/** 生成stream流类型 */
WEBCodeGeneration.prototype.CGStreamData = function () {
    var buf = ''

    //遍历所有compositeNode的streamType，找到流中所有包含的数据类型，作为结构体streamData中的数据
    //FIXME: 目前符号表未完成, 所以暂时假设所有的流都是同一种数据类型,因此只取一个 streamDcl 来填充至 streamData
    var typeSet = []
    for (let comp of COStreamJS.ast.filter(node => node instanceof compositeNode)) {
        for (let stmt of comp.body.stmt_list) {
            if (stmt instanceof declareNode && stmt.type instanceof strdclNode) {
                typeSet = typeSet.concat(stmt.type.id_list)
            }
        }
    }
    //数组去重 由[{type:'int', identifier:'x'}] 先转为字符串形式的 [ 'int x' ] 来完成去重, 再给后面调用
    typeSet = typeSet.map(o => o.type + ' ' + o.identifier)
    typeSet = [...new Set(typeSet)]
    typeSet = typeSet.map(str => ({ type: str.match(/\S+/g)[0], identifier: str.match(/\S+/g)[1] }))
    //写入数据流数据类型结构体
    buf += "class StreamData{\n constructor() {\n"
    for (let it of typeSet) {
        buf += `/* ${it.type} */ this.${it.identifier} = undefined;\n`
    }
    buf += "}\n}\n"

    COStreamJS.files['Global.js'] = buf.beautify()
}

WEBCodeGeneration.prototype.CGGlobalvar = function () {
    var buf = 
    `/*---------------------------*/
     /*     主流程开始             */
     /*---------------------------*/
    `;
    for (let node of COStreamJS.ast) {
        if (node instanceof declareNode) {
            buf += node.toJS() + ';\n'
        }
    }
    COStreamJS.files['GlobalVar.cpp'] = buf.beautify()
}

/**
 * 生成 Global.cpp  用于存储边的信息
 */
WEBCodeGeneration.prototype.CGGlobal = function () {
    var buf = '/* Buffer<StreamData> */\n';
    for (let flat of this.ssg.flatNodes) {
        for (let out of flat.outFlatNodes) {
            let stageminus = out.stageNum - flat.stageNum //发送方和接受方的软件流水阶段差
            let edgePos = flat.outFlatNodes.indexOf(out) // out 在 flat 的输出边的序号
            let perSteadyPushCount = flat.steadyCount * flat.outPushWeights[edgePos]//发送actor每次调用steadywork需要push的个数
            let copySize = 0, copyStartPos = 0;    //拷贝的数据大小，copy存放的开始位置

            let inEdgeIndex = out.inFlatNodes.indexOf(flat) // out节点中 flat 对应的这条边的下标
            let perWorkPeekCount = out.inPeekWeights[inEdgeIndex] //接收边actor每次peek的个数,b
            let perWorkPopCount = out.inPopWeights[inEdgeIndex];  //接收边actor每次调用work需要pop的个数
            let init1 = flat.initCount * flat.outPushWeights[edgePos] //发送actor调用initwork产生的数据量
            let init2 = out.initCount * perWorkPopCount //接受actor的数据量
            let size = init1 + perSteadyPushCount * (stageminus + 2) //缓冲区的大小
            if (perWorkPeekCount === perWorkPopCount) {
                if (perSteadyPushCount) {
                    copySize = (init1 - init2) % perSteadyPushCount
                    copyStartPos = init2 % perSteadyPushCount
                }
            } else {
                //peek != pop 情况的特殊处理, 目前测试用例无此种情况, 需对这方面单独测试, 目前不保证下面5代码的正确性 FIXME
                let leftnum = ((init1 - init2) % perSteadyPushCount + perSteadyPushCount - (perWorkPeekCount - perWorkPopCount) % perSteadyPushCount) % perSteadyPushCount;
                copySize = leftnum + perWorkPeekCount - perWorkPopCount;
                let addtime = copySize % perSteadyPushCount ? copySize / perSteadyPushCount + 1 : copySize / perSteadyPushCount;
                copyStartPos = init2 % perSteadyPushCount;
                size += addtime * perSteadyPushCount;
            }

            let edgename = flat.name + '_' + out.name
            buf += `let ${edgename} = new Buffer(${size},${copySize},${copyStartPos});\n`
        }
    }

    COStreamJS.files['Global.cpp'] = buf.beautify()
}

WEBCodeGeneration.prototype.CopyLib = function () {
    const LIB = `
    /** 工具函数 */
    function isNumber(string) {
        return string == +string;
    }
    function getNDArray(...args){
        if(!args || !args.length) return 0;
        return Array.from({ length: args[0] }).map(_=> getNDArray(...args.slice(1)))
    }
    /** 生产者消费者 Constructor */
    class Buffer {
        constructor(size,copySize,copyStartPos){
            let buffer = Array.from({ length:size }).map(_ => new StreamData());
            buffer.bufferSize = size;
            buffer.copySize = copySize;
            buffer.copyStartPos = copyStartPos;
            buffer.writePos = 0;
            return buffer;
        }
    }
    class Consumer {
      constructor(/* Buffer<T> & */conBuffer)
        {
            this.conBuffer = conBuffer
            this.head = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.conBuffer[target.head + parseInt(propKey)]
                    }
                    return target[propKey];
                },
                set: function(target, propKey, value) {
                    if(isNumber(propKey)){
                        target.conBuffer[target.head + parseInt(propKey)] = value
                        return true
                    }
                    target[propKey] = value;
                    return true
                }
            });
        }
        updatehead(offset){
            this.head += offset;
        }
        resetHead(){
            this.head = 0
        }
    }
    class Producer {
      constructor(/* Buffer<T> & */proBuffer)
        {
            this.proBuffer = proBuffer
            this.tail = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.proBuffer[target.tail + parseInt(propKey)]
                    }
                    return target[propKey];
                },
                set: function(target, propKey, value) {
                    if(isNumber(propKey)){
                        target.proBuffer[target.tail + parseInt(propKey)] = value
                        return true
                    }
                    target[propKey] = value;
                    return true
                }
            });
        }
        updatetail(offset){
            this.tail += offset;
        }
        resetTail(){
            this.tail = 0
        }
    }
    `
    COStreamJS.files['lib.js'] = LIB
}


/**
 * 因为 WEB 是单线程, 直接生成程序主流程
 */
WEBCodeGeneration.prototype.CGMain = function CGMain() {
        var buf = ''
        let MaxStageNum = COStreamJS.MaxStageNum
        buf = `\n/** 构建 operator Instance */\n`

        this.ssg.flatNodes.forEach(flat => {
            //准备构造如下格式的声明语句: const Name = new PreName(out1,out2,in1,in2);
            buf += `const ${flat.name} = new ${flat.PreName}(`
            let streamNames = []
            flat.outFlatNodes.forEach(out => {
                let edgename = flat.name + '_' + out.name
                streamNames.push(edgename) 
            })
            flat.inFlatNodes.forEach(src => {
                let edgename = src.name + '_' + flat.name
                streamNames.push(edgename) 
            })
            buf += streamNames.join(',') + ','
            buf += flat.steadyCount + ',' + flat.initCount;
            flat.params.length > 0 ? buf += ',' + flat.params.join(',') : '';
            buf += ');'
            buf += '\n'
        })

        buf += `\n/** 数据流执行过程 */\nconst MAX_ITER = 1;\n`
        const constant_array = [1].concat(Array(MaxStageNum-1).fill(0)) // 得到这样的数组: [1,0,0,...,0] 长度为阶段数
        buf += `const stage = [${constant_array.join()}];\n`

        //生成初态的 initWork 对应的 for 循环
        let initFor = `
        for(let _stageNum = 0; _stageNum < ${MaxStageNum}; _stageNum++){
            #SLOT
        }
        `
        var forBody = ''
        for (let stage = 0 ; stage < MaxStageNum; stage++) {
            let ifStr = `if(${stage} == _stageNum){`
            //获取在这个 stage 上的 actor 集合
            let flatVec = this.ssg.flatNodes.filter(flat => flat.stageNum == stage)
            ifStr += flatVec.map(flat => flat.name + '.runInitScheduleWork();\n').join('') + '}\n'
            forBody += ifStr
        }
        buf += initFor.replace('#SLOT', forBody)
        //初态的 initWork 对应的 for 循环生成完毕

        //生成稳态的 steadyWork 对应的 for 循环
        let steadyFor = `
        for(let _stageNum = ${MaxStageNum}; _stageNum < 2*${MaxStageNum}+MAX_ITER-1; _stageNum++){
            #SLOT
        }
        `
        var forBody = ''
        for (let stage = 0 ; stage < MaxStageNum; stage++) {
            let ifStr = `if(stage[${stage}]){`
            //获取既在在这个 stage 上的 actor 集合
            let flatVec = this.ssg.flatNodes.filter(flat => flat.stageNum == stage)
            ifStr += flatVec.map(flat => flat.name + '.runSteadyScheduleWork();\n').join('') + '}\n'
            forBody += ifStr
        }
        forBody += 
        `for(let index=${MaxStageNum-1}; index>=1; --index){
            stage[index] = stage[index-1];
         }
         if(_stageNum == MAX_ITER - 1 + ${MaxStageNum}){
             stage[0] = 0;
         }
        `
        buf += steadyFor.replace('#SLOT', forBody)
        //稳态的 steadyWork 对应的 for 循环生成完毕

        COStreamJS.files[`main.js`] = buf.beautify()
}

WEBCodeGeneration.prototype.Pack = function Pack(){
    COStreamJS.files['main.cpp'] = Object.values(COStreamJS.files).join('\n').beautify();
}

/**
 * 生成各个计算节点, 例如 class Source {}; class Sink {};
 */
WEBCodeGeneration.prototype.CGactors = function () {
    var hasGenerated = new Set() //存放已经生成过的 FlatNode 的 PreName , 用来做去重操作
    this.ssg.flatNodes.forEach(flat => {
        // 先对 FileReader 进行特殊处理
        if(flat.contents instanceof fileReaderNode || flat.contents instanceof fileWriterNode){
            COStreamJS.files[`${flat.PreName}.h`] = this.cgFileActor(flat.contents);
            return;
        }
        // 再处理普通 oper
        if (hasGenerated.has(flat.PreName)) return
        hasGenerated.add(flat.PreName)
        
        var buf = ''
        //开始构建 class
        buf += `class ${flat.PreName}{\n`
        /*写入类成员函数*/
        let oper = flat.contents
        let inEdgeNames = oper.inputs
        let outEdgeNames = oper.outputs
        buf += this.CGactorsConstructor(oper,inEdgeNames, outEdgeNames); 
        buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
        
        //写入init部分前的statement定义，调用tostring()函数，解析成规范的类变量定义格式

        buf += this.CGactorsPopToken(oper);
        buf += this.CGactorsPushToken(oper);
        //init部分前的statement赋值
        buf += this.CGactorsinitVarAndState(oper.operBody.stmt_list, oper);
        buf += this.CGactorsInit(oper.operBody.init, flat);
        buf += this.CGactorsWork(oper.operBody.work, flat);
        /* 类体结束*/
        buf += "}\n";
        COStreamJS.files[`${flat.PreName}.h`] = buf.beautify()
    })
}
WEBCodeGeneration.prototype.cgFileActor = function(fileNode){
    if(fileNode instanceof fileReaderNode && /canvas/.test(fileNode.fileName)){
        return `
        class FileReader{
            constructor(/* Buffer<StreamData>& */RAW,steadyC,initC){
                this.steadyScheduleCount = steadyC;
                this.initScheduleCount = initC;
                this.RAW = new Producer(RAW);
            }
            runInitScheduleWork() {}
            runSteadyScheduleWork() {
                for (let i = 0; i < this.steadyScheduleCount; i++) {
                    this.work();
                }
                this.RAW.resetTail();
            }
            popToken(){ }
            pushToken(){
                this.RAW.updatetail(784);
            }
            work(){
                
                let i=0;
                window.getCanvasData();
                for(i=0;i<784;i++)
                    this.RAW[i].x= window.img28[i];
                this.pushToken();
                this.popToken();
            }
        }`
    }else if(fileNode instanceof fileWriterNode && /chart/.test(fileNode.fileName)){
        return `
        class FileWriter{
            constructor(/* Buffer<StreamData>& */Out,steadyC,initC){
                this.steadyScheduleCount = steadyC;
                this.initScheduleCount = initC;
                this.Out = new Consumer(Out);
            }
            runInitScheduleWork() {}
            runSteadyScheduleWork() {
                for (let i = 0; i < this.steadyScheduleCount; i++) {
                    this.work();
                }
                this.Out.resetHead();
            }
            popToken(){ 
                this.Out.updatehead(10);
            }
            pushToken(){}
            work(){
                let i=0, arr= [];
                for(i=0;i<10;i++)
                    arr.push(this.Out[i].x)
                window.update_data(arr) //调用index.html中提供的更新图表的接口
                this.pushToken();
                this.popToken();
            }
        }`
    }
    throw new Error('WEB端暂不支持该类型的FileReader or FileWriter')
}

/**
 * 生成actors constructor
 * @example
 * constructor(Source_0_B_1, steadyC,initC, param1 ) {
 *  this.steadyScheduleCount = steadyC;
 *  this.initScheduleCount = initC;
 *  this.Source_0_B_1 = new Producer(Source_0_B_1)
 *  this.paramName1 = param1;
 *  this.i = 0
 * }
**/
WEBCodeGeneration.prototype.CGactorsConstructor = function(/** @type {operatorNode} */oper,inEdgeNames, outEdgeNames) {
    let paramNames = oper._symbol_table.prev.paramNames
    var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames) // 把 out 放前面, in 放后面
    var buf = 'constructor(/* Buffer<StreamData>& */'
    buf += OutAndInEdges.join(',')
    buf += ',steadyC,initC';
    paramNames.length ? buf += ',' + paramNames.join(',') : '';
    buf += '){'
    buf += `
        this.steadyScheduleCount = steadyC;
        this.initScheduleCount = initC;
        ${inEdgeNames.map(src => `this.${src} = new Consumer(${src});`).join('\n')}
        ${outEdgeNames.map(out => `this.${out} = new Producer(${out});`).join('\n')}
        ${paramNames.map(param => `this.${param} = ${param};`).join('\n')}
    `
    if(oper._symbol_table){
        for(let name of Object.keys(oper._symbol_table.memberTable)){
            let variable = oper._symbol_table.memberTable[name];
            // 若该成员变量被声明为数组类型
            if(variable.shape && variable.shape.join('') !== '11'){
                var initializer = `getNDArray(${variable.shape.join(',')})`
            }
            // 非数组类型
            else{
                var initializer = variable.value;
            }
            buf += `this.${name} = ${initializer};\n`
        }
    }
    return buf+'}'
}

WEBCodeGeneration.prototype.CGactorsRunInitScheduleWork = function (inEdgeNames, outEdgeNames) {
    var buf = `
    runInitScheduleWork() {
        this.initVarAndState();
        this.init();
        for (let i = 0; i < this.initScheduleCount; i++) {
            this.work();
        }
        `;
    (outEdgeNames || []).forEach(out => buf += 'this.' + out + '.resetTail();\n');
    (inEdgeNames || []).forEach(src => buf += 'this.' + src + '.resetHead();\n');
    return buf + '}\n'
}

WEBCodeGeneration.prototype.CGactorsRunSteadyScheduleWork = function(inEdgeNames, outEdgeNames) {
    var buf = `
    runSteadyScheduleWork() {
        for (let i = 0; i < this.steadyScheduleCount; i++) {
            this.work();
        }
        `;
    (outEdgeNames || []).forEach(out => buf += 'this.' + out + '.resetTail();\n');
    (inEdgeNames || []).forEach(src => buf += 'this.' + src + '.resetHead();\n');
    return buf + '}\n'
}

/**
 * 生成 class 的 popToken 函数, 例如
 * popToken() {
 *		this.Rstream0_0.updatehead(1);
 *		this.Rstream0_1.updatehead(1);
 * }
 * @param {operatorNode} oper
 */
WEBCodeGeneration.prototype.CGactorsPopToken = function (oper) {
    const stmts = [];
    (oper.operBody.win||[]).forEach(winStmt =>{
        if(winStmt.type == 'sliding'){
            let pop = winStmt.arg_list[0].toString()
            oper._symbol_table.prev.paramNames.forEach(name =>{
                const reg = new RegExp(`\\b(?<!\\.)${name}\\b`, 'g')
                pop = pop.replace(reg, 'this.'+name)
            })
            stmts.push(`this.${winStmt.winName}.updatehead(${pop});`)
        }
    })
    return `\n popToken(){ ${stmts.join('\n')} }\n`
}

/**
 * 生成 class 的 pushToken 函数, 例如
 * pushToken() {
 *		this.Dstream0_1.updatetail(2);
 * }
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsPushToken = function (oper) {
    const stmts = [];
    (oper.operBody.win||[]).forEach(winStmt =>{
        if(winStmt.type == 'tumbling'){
            let push = winStmt.arg_list[0].toString()
            oper._symbol_table.prev.paramNames.forEach(name =>{
                const reg = new RegExp(`\\b(?<!\\.)${name}\\b`, 'g')
                push = push.replace(reg, 'this.'+name)
            })
            stmts.push(`this.${winStmt.winName}.updatetail(${push});`)
        }
    })
    return `\n pushToken(){ ${stmts.join('\n')} }\n`
}

/** 
 * 将 stmt_list 中的 let i=0部分转换为 this.i=0; 
 * @param {declareNode[]} stmt_list
 */
WEBCodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list, oper){
    // 基于符号表来把 变量名 转化为 string
    setTop(oper._symbol_table)
    var result = 'initVarAndState() {'
    stmt_list.forEach( declare =>{
        declare.init_declarator_list.forEach(item =>{
            if(item.initializer){
                result += item.identifier.toJS() + '=' + item.initializer.toJS() +';\n'
            }
        })
    })
    return result+'}';
}
WEBCodeGeneration.prototype.CGactorsInit = function(init, flat){
    // 基于符号表来把 init 转化为 string
    if(init) setTop(init._symbol_table)
    let buf = (init||'{ }').toJS();
    return `init() ${buf} \n`
}

/** 
 * @param {blockNode} work 
 * @param {operatorNode} oper
 */
WEBCodeGeneration.prototype.CGactorsWork = function (work, flat){
    // 基于符号表来把 work 转化为 string
    // 将 work 的 toString 的头尾两个花括号去掉}, 例如 { cout << P[0].x << endl; } 变成 cout << P[0].x << endl; 
    setTop(work._symbol_table)
    let innerWork = work.toJS().replace(/^\s*{/, '').replace(/}\s*$/, '') 
    return `work(){
        ${innerWork}
        this.pushToken();
        this.popToken();
    }\n`
}