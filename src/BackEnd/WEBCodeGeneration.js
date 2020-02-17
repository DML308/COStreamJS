import { COStreamJS } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode, blockNode } from "../ast/node";
import { FlatNode } from "../FrontEnd/FlatNode"
import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { Partition } from "./Partition"
import Plugins from "../plugins"

export class WEBCodeGeneration {

    constructor(nCpucore, ssg, mp) {

        this.nCpucore = nCpucore
        /**@type {StaticStreamGraph} */
        this.ssg = ssg
        /**@type {Partition} */
        this.mp = mp

        /** @type {Map<number,Set<number>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
        this.mapNum2Stage = new Map()

    }
}

WEBCodeGeneration.prototype.CGGlobalvar = function () {
    var buf = `#include "GlobalVar.h" \n`;
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
    var buf = `
#include "Buffer.h"
#include "Global.h"
#include <vector>
using namespace std;\n
    `
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

            /* 优先构建那些很明显不能被复用的边:
             * 1. peak != pop 的
             * 2. copySize 或 copyStartPos 不为0的 
             * 3. 上下游有阶段差的 */
            if (1|| perWorkPeekCount != perWorkPopCount || copySize || copyStartPos || stageminus) {
                let edgename = flat.name + '_' + out.name //边的名称
                this.bufferMatch.set(edgename, new bufferSpace(edgename, edgename, size, 1, copySize, copyStartPos))
            }
        }
    }

    //为同一核上可以共享内存的缓冲区分配内存
    this.shareBuffers()

    //检查是否有缓冲区没有分配, 若分配了, 则加入返回字符串中
    for (let flat of this.ssg.flatNodes) {
        for (let out of flat.outFlatNodes) {
            let edgename = flat.name + '_' + out.name
            if (!this.bufferMatch.has(edgename)) {
                throw new Error('有缓冲区未分配, 程序异常, 请联系管理员')
            } else {
                let b = this.bufferMatch.get(edgename)
                let str = `Buffer<streamData>${edgename}(${b.buffersize},${b.copySize},${b.copyStartPos});`
                if (b.original !== b.instance) {
                    str = '//' + str + `  该缓冲区复用了${b.instance}的内存`
                }
                buf += str + '\n'
            }
        }
    }
    COStreamJS.files['Global.cpp'] = buf.beautify()
    debugger
}

WEBCodeGeneration.prototype.CopyLib = function () {
    const LIB = `
    /** 工具函数 */
    function isNumber(string) {
        return string == +string;
    }
    /** 生产者消费者 Constructor */
    class Buffer
    {
        constructor(size,copySize,copyStartPos){
            let buffer = Array.from({ length:size }).map(_ => new streamData())
            buffer.bufferSize = size;
            buffer.copySize = copySize;
            buffer.copyStartPos = copyStartPos;
            buffer.writePos = 0;
            return buffer;
        }
    }
    class Consumer
    {
      constructor(/* Buffer<T> & */conBuffer)
        {
            this.conBuffer = conBuffer
            this.head = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.conBuffer[target.head + parselet(propKey)]
                    }
                    return target[propKey];
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
    class Producer
    {
      constructor(/* Buffer<T> & */proBuffer)
        {
            this.proBuffer = proBuffer
            this.tail = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.proBuffer[target.tail + parselet(propKey)]
                    }
                    return target[propKey];
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
    COStreamJS.files['main.cpp'] = (Object.values(COStreamJS.files).join('\n') + LIB).beautify();
}


/**
 * 因为 WEB 是单线程, 直接生成程序主流程
 */
WEBCodeGeneration.prototype.CGMain = function () {
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
            let ifStr = `if(stage[${stage}]){`
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

/** COStream 内建节点, 无需去重 */
const ProtectedActor = ['join', 'duplicate', 'roundrobin']
/**
 * 生成各个计算节点, 例如 source.h sink.h
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

        var buf = `
        #ifndef _${flat.PreName}_
        #define _${flat.PreName}_
        #include <string>
        #include <iostream>
        #include "Buffer.h"
        #include "Consumer.h"
        #include "Producer.h"
        #include "Global.h"
        #include "GlobalVar.h"
        using namespace std;
        `
        //如果当前节点为IO节点
        if (flat.name.match(/FILEREADER/i)) {
            buf += "#include \"RingBuffer.h\"\n";
            this.workLen = flat.outPushWeights[0];
            //由于目前不支持多类型流变量，这里先强制设置为let
            buf += `
            struct source{
                let buffer[${this.workLen}];
            };
            extern RingBuffer<source> ringBuffer;
            `
        }

        //开始构建 class
        buf += `class ${flat.PreName}{\n`
        buf += `public:\n`
        /*写入类成员函数*/
        let inEdgeNames = flat.inFlatNodes.map(src => src.name + '_' + flat.name)
        let outEdgeNames = flat.outFlatNodes.map(out => flat.name + '_' + out.name)
        buf += this.CGactorsConstructor(flat, inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
        /*写入类成员变量*/
        buf += "private:\n";
        outEdgeNames.forEach(out => buf += `Producer<streamData>${out};\n` )
        inEdgeNames.forEach(src => buf += `Consumer<streamData>${src};\n`)
        buf += "let steadyScheduleCount;\t//稳态时一次迭代的执行次数\n";
        buf += "let initScheduleCount;\n";
        //写入init部分前的statement定义，调用tostring()函数，解析成规范的类变量定义格式
        buf += this.CGactorsStmts(flat.contents.operBody.stmt_list);
        buf += this.CGactorsPopToken(flat, inEdgeNames);
        buf += this.CGactorsPushToken(flat, outEdgeNames);
        //init部分前的statement赋值
        buf += this.CGactorsinitVarAndState(flat.contents.operBody.stmt_list);
        buf += this.CGactorsInit(flat.contents.operBody.init);
        buf += this.CGactorsWork(flat.contents.operBody.work, flat, inEdgeNames, outEdgeNames);
        /* 类体结束*/
        buf += "};\n";
        buf += "#endif";
        COStreamJS.files[`${flat.PreName}.h`] = buf.beautify()
    })
}

/**
 * 生成actors constructor
 * @example
 * rtest_3(Buffer<streamData>& Rstream0_0,Buffer<streamData>& round1_0):Rstream0_0(Rstream0_0),round1_0(round1_0){
 *		steadyScheduleCount = 1;
 *		initScheduleCount = 0;
 * }
 */
WEBCodeGeneration.prototype.CGactorsConstructor = function(flat, inEdgeNames, outEdgeNames) {
    var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames) // 把 out 放前面, in 放后面
    var buf = flat.PreName + '('
    buf += OutAndInEdges.map(s => 'Buffer<streamData>& ' + s).join(',') + '):'
    buf += OutAndInEdges.map(s => s + '(' + s + ')').join(',') + '{'
    buf += `
        steadyScheduleCount = ${flat.steadyCount};
		initScheduleCount = ${flat.initCount};
	}
    `
    return buf
}
/**
 * @example
 * void runInitScheduleWork() {
 *		initVarAndState();
 *		init();
 *		for(let i=0;i<initScheduleCount;i++)
 *			work();
 *		round1_0.resetTail();
 *		round1_1.resetTail();
 *		dup0_0.resetHead();
 *	}
 */
WEBCodeGeneration.prototype.CGactorsRunInitScheduleWork = function (inEdgeNames, outEdgeNames) {
    var buf = `
    void runInitScheduleWork() {
		initVarAndState();
		init();
		for(let i=0;i<initScheduleCount;i++){    
            work();
        }`;
    (outEdgeNames || []).forEach(out => buf += out + '.resetTail();\n');
    (inEdgeNames || []).forEach(src => buf += src + '.resetHead();\n');
    return buf + '}\n'
}

/**
 * @example
 * void runSteadyScheduleWork() {
 *		for(let i=0;i<steadyScheduleCount;i++)
 *			work();
 *		round1_0.resetTail2();
 *		round1_1.resetTail();
 *		dup0_0.resetHead2();
 *	}
 */
WEBCodeGeneration.prototype.CGactorsRunSteadyScheduleWork = function(inEdgeNames, outEdgeNames) {
    var buf = `
    void runSteadyScheduleWork() {
		for(let i=0;i<steadyScheduleCount;i++){
            work();
        }`;
    var use1Or2 = str => this.bufferMatch.get(str).buffertype == 1 ? '' : '2';
    (outEdgeNames || []).forEach(out => buf += out + '.resetTail' + use1Or2(out) + '();\n');
    (inEdgeNames || []).forEach(src => buf += src + '.resetHead' + use1Or2(src) + '();\n');
    return buf + '}\n'
}

/**
 * 将.cos 文件中的 operator 的 init 前的变量声明转为新的 class 的 private 成员,例如 
 * private: 
 *   let i; 
 *   let j;
 * 而赋值操作放到 initVarAndState 中去做
 * @param {declareNode[]} stmt_list
 */
WEBCodeGeneration.prototype.CGactorsStmts = function (stmt_list) {
    /*解析等号类似let i=0,j=1形式变成let i; let j;的形式,因为类的成员变量定义不能初始化*/
    var result = ''
    stmt_list.forEach(declare => {
        declare.init_declarator_list.forEach(item => {
            result += item.type + ' ' + item.identifier + ';\n'
        })
    })
    return result;
}

/**
 * 生成 class 的 private 部分的 popToken 函数, 例如
 * void popToken() {
 *		Rstream0_0.updatehead(1);
 *		Rstream0_1.updatehead(1);
 * }
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsPopToken = function (flat, inEdgeNames) {
    const pop = flat.inPopWeights[0]
    const stmts = inEdgeNames.map(src => `${src}.updatehead(${pop});\n`).join('')
    return `\n void popToken(){ ${stmts} }\n`
}

/**
 * 生成 class 的 private 部分的 pushToken 函数, 例如
 * void pushToken() {
 *		Dstream0_1.updatetail(2);
 * }
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsPushToken = function (flat, outEdgeNames) {
    const push = flat.outPushWeights[0]
    const stmts = outEdgeNames.map(out => `${out}.updatetail(${push});\n`).join('')
    return `\n void pushToken(){ ${stmts} }\n`
}

/** 
 * 将 stmt_list 中的 let i=0部分转换为 i=0; 
 * @param {declareNode[]} stmt_list
 */
WEBCodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list){
    var result = 'void initVarAndState() {'
    stmt_list.forEach( declare =>{
        declare.init_declarator_list.forEach(item =>{
            if(item.initializer){
                result += item.identifier + '=' + item.initializer +';\n'
            }
        })
    })
    return result+'}';
}
WEBCodeGeneration.prototype.CGactorsInit = function(init){
    return `void init() ${init|| '{ }'} \n`
}

/** 
 * @param {blockNode} work 
 * @param {FlatNode} flat
 */
WEBCodeGeneration.prototype.CGactorsWork = function (work, flat, inEdgeNames, outEdgeNames){
    // 将 work 的 toString 的头尾两个花括号去掉}, 例如 { cout << P[0].x << endl; } 变成 cout << P[0].x << endl; 
    var innerWork = (work + '').replace(/^\s*{/, '').replace(/}\s*$/, '') 
    // 替换流变量名 , 例如 P = B(S)(88,99);Sink(P){...} 则将 P 替换为 B_1_Sink_2
    flat.contents.inputs.forEach((src, idx) => replace(src, inEdgeNames[idx]))
    flat.contents.outputs.forEach((out, idx) => replace(out, outEdgeNames[idx]))
    
    return `void work(){
        ${innerWork}
        pushToken();
        popToken();
    }\n`

    function replace(A, B) {
        const reg = new RegExp(`\\b${A}\\b`, 'g')
        innerWork = innerWork.replace(reg, B)
    }
}