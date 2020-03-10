import { COStreamJS } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode, blockNode } from "../ast/node";
import { FlatNode } from "../FrontEnd/FlatNode"
import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { Partition } from "./Partition"
import Plugins from "../plugins"
import { error } from "../utils";

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
            buf += node.toString() + ';\n'
        }
    }
    buf = Plugins.after('CGGlobalvar', buf, COStreamJS.ast)
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
            //准备构造如下格式的声明语句: const Name_obj = new Name(out1,out2,in1,in2);
            buf += `const ${flat.name}_obj = new ${flat.PreName}(`
            let streamNames = []
            flat.outFlatNodes.forEach(out => {
                let edgename = flat.name + '_' + out.name
                streamNames.push(edgename) 
            })
            flat.inFlatNodes.forEach(src => {
                let edgename = src.name + '_' + flat.name
                streamNames.push(edgename) 
            })
            buf += streamNames.join(',') + ');'
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
            ifStr += flatVec.map(flat => flat.name + '_obj.runInitScheduleWork();\n').join('') + '}\n'
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
            ifStr += flatVec.map(flat => flat.name + '_obj.runSteadyScheduleWork();\n').join('') + '}\n'
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

/** COStream 内建节点, 无需去重 */
const ProtectedActor = ['join', 'duplicate', 'roundrobin']
/**
 * 生成各个计算节点, 例如 class Source {}; class Sink {};
 */
WEBCodeGeneration.prototype.CGactors = function () {
    var hasGenerated = new Set() //存放已经生成过的 FlatNode 的 PreName , 用来做去重操作
    this.ssg.flatNodes.forEach(flat => {
        /** 暂时不对COStream 内建节点做去重操作 */
        if(ProtectedActor.includes(flat.PreName)){
            flat.PreName = flat.name
        } 
        if (hasGenerated.has(flat.PreName)) return
        hasGenerated.add(flat.PreName)

        var buf = ''
        //开始构建 class
        buf += `class ${flat.PreName}{\n`
        /*写入类成员函数*/
        let inEdgeNames = flat.inFlatNodes.map(src => src.name + '_' + flat.name)
        let outEdgeNames = flat.outFlatNodes.map(out => flat.name + '_' + out.name)
        buf += this.CGactorsConstructor(flat, inEdgeNames, outEdgeNames); 
        buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
        
        //写入init部分前的statement定义，调用tostring()函数，解析成规范的类变量定义格式

        buf += this.CGactorsPopToken(flat, inEdgeNames);
        buf += this.CGactorsPushToken(flat, outEdgeNames);
        //init部分前的statement赋值
        buf += this.CGactorsinitVarAndState(flat.contents.operBody.stmt_list);
        buf += this.CGactorsInit(flat, flat.contents.operBody.init);
         buf += this.CGactorsWork(flat.contents.operBody.work, flat, inEdgeNames, outEdgeNames);
        /* 类体结束*/
        buf += "}\n";
        COStreamJS.files[`${flat.PreName}.h`] = buf.beautify()
    })
}

/**
 * 生成actors constructor
 * @example
 * constructor(Source_0_B_1) {
 *  this.steadyScheduleCount = 1;
 *  this.initScheduleCount = 0;
 *  this.Source_0_B_1 = new Producer(Source_0_B_1)
 *  this.i = 0
 * }
**/
WEBCodeGeneration.prototype.CGactorsConstructor = function(/** @type {FlatNode} */flat, inEdgeNames, outEdgeNames) {
    var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames) // 把 out 放前面, in 放后面
    var buf = 'constructor(/* Buffer<StreamData>& */'
    buf += OutAndInEdges.join(',') + '){'
    buf += `
        this.steadyScheduleCount = ${flat.steadyCount};
        this.initScheduleCount = ${flat.initCount};
        ${inEdgeNames.map(src => `this.${src} = new Consumer(${src});`).join('\n')}
        ${outEdgeNames.map(out => `this.${out} = new Producer(${out});`).join('\n')}
    `
    if(flat.contents._symbol_table){
        for(let name of Object.keys(flat.contents._symbol_table.memberTable)){
            let variable = flat.contents._symbol_table.memberTable[name];
            // 若该成员变量被声明为数组类型
            if(variable.array){
                let { length } = variable.array.arg_list
                if(length > 2){
                    error(variable._loc,"暂不支持二维以上的数组")
                }else if(length === 2){
                    const firstDim = variable.array.arg_list[0]
                    var initializer = `Array.from({length:${firstDim}}).map(_=>[])`
                }else if(length === 1){
                    var initializer = `[]`;
                }
            }
            // 非数组类型
            else{
                var initializer = variable.value.val;
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
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsPopToken = function (flat, inEdgeNames) {
    const pop = flat.inPopWeights[0]
    const stmts = inEdgeNames.map(src => `this.${src}.updatehead(${pop});\n`).join('')
    return `\n popToken(){ ${stmts} }\n`
}

/**
 * 生成 class 的 pushToken 函数, 例如
 * pushToken() {
 *		this.Dstream0_1.updatetail(2);
 * }
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsPushToken = function (flat, outEdgeNames) {
    const push = flat.outPushWeights[0]
    const stmts = outEdgeNames.map(out => `this.${out}.updatetail(${push});\n`).join('')
    return `\n pushToken(){ ${stmts} }\n`
}

/** 
 * 将 stmt_list 中的 let i=0部分转换为 this.i=0; 
 * @param {declareNode[]} stmt_list
 */
WEBCodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list){
    var result = 'initVarAndState() {'
    stmt_list.forEach( declare =>{
        declare.init_declarator_list.forEach(item =>{
            if(item.initializer){
                result += 'this.' + item.identifier + '=' + item.initializer +';\n'
            }
        })
    })
    return result+'}';
}
WEBCodeGeneration.prototype.CGactorsInit = function(flat, init){
    const memberTable = (flat.contents._symbol_table||{}).memberTable || {} ;
    let buf = (init||'{ }').toString();
    Object.keys(memberTable).forEach(memberName =>{
        const reg  = new RegExp(`\\b(?<!\\.)${memberName}\\b`,'g')
        buf = buf.replace(reg, 'this.'+memberName)
    })

    return `init() ${buf} \n`
}

/** 
 * @param {blockNode} work 
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsWork = function (work, flat, inEdgeNames, outEdgeNames){
    // 将 work 的 toString 的头尾两个花括号去掉}, 例如 { cout << P[0].x << endl; } 变成 cout << P[0].x << endl; 
    let innerWork = (work + '').replace(/^\s*{/, '').replace(/}\s*$/, '') 
    // 替换符号表中的成员变量的访问 
    const memberTable = (flat.contents._symbol_table||{}).memberTable || {} ;
    Object.keys(memberTable).forEach(name => replaceWithoutDot(name, 'this.'+name))
    // 替换流变量名 , 例如 P = B(S)(88,99);Sink(P){...} 则将 P 替换为 this.B_1_Sink_2
    flat.contents.inputs.forEach((src, idx) => replaceStream(src, 'this.'+inEdgeNames[idx]))
    flat.contents.outputs.forEach((out, idx) => replaceStream(out, 'this.'+outEdgeNames[idx]))
    return `work(){
        ${innerWork}
        this.pushToken();
        this.popToken();
    }\n`

    function replaceWithoutDot(A,B){
        const reg = new RegExp(`\\b(?<!\\.)${A}\\b`, 'g')
        innerWork = innerWork.replace(reg, B)
    }
    function replaceStream(A, B) {
        let reg = new RegExp(`${A}(?=\\s+(tumbling|sliding))`, 'g')
        innerWork = innerWork.replace(reg, B)
        reg = new RegExp(`${A}(?=\\[)`, 'g')
        innerWork = innerWork.replace(reg, B)
    }
}