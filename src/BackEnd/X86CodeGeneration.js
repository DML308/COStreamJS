import { COStreamJS } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode, blockNode } from "../ast/node";
import { getIOHandlerStrings } from "./IOHandler"
import { FlatNode } from "../FrontEnd/FlatNode"
import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { Partition } from "./Partition"
import Plugins from "../plugins"

export class X86CodeGeneration {

    constructor(nCpucore, ssg, mp) {

        this.nCpucore = nCpucore
        /**@type {StaticStreamGraph} */
        this.ssg = ssg
        /**@type {Partition} */
        this.mp = mp

        /** @type {Map<string,bufferSpace>} 字符串到对应的缓冲区的映射 */
        this.bufferMatch = new Map()

        /** @type {Map<string,number>} 缓冲区到对应缓冲区类型的映射，通过这个来判断调用consumer和producer哪种方法 */
        this.bufferType = new Map()

        /** @type {Map<number,Set<number>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
        this.mapNum2Stage = new Map()

        //构造每个线程上的stage集合mapNum2Stage
        for (let i = 0; i < nCpucore; i++) {
            let stageNums = new Set() //使用Set来对阶段号做"数组去重"操作
            this.mp.PartitonNum2FlatNode.get(i).forEach(flat => stageNums.add(flat.stageNum))
            this.mapNum2Stage.set(i, stageNums) //Set 转回数组
        }

        //头节点执行一次work所需读入的数据量
        this.workLen = 0
    }
}

class bufferSpace {
    constructor(original, instance, buffersize, buffertype, copySize = 0, copyStartPos = 0) {
        /** @type {string} 原始缓冲区的名称 */
        this.original = original
        /** @type {string} 实际对应的缓冲区名称 */
        this.instance = instance
        /** @type {int} 分配缓冲区的大小 */
        this.buffersize = buffersize
        /** @type {int} 分配缓冲区的类型，是否可复用，0代表未分配，1代表不可复用，2代表可复用 */
        this.buffertype = buffertype
        /** FIXME用来标识流的类型,未完成 */
        this.classification = 'int_x'
        this.copySize = copySize
        this.copyStartPos = copyStartPos
    }
}

X86CodeGeneration.prototype.CGMakefile = function () {
    /** Makefile 要求左边必须靠边, 在左边的空白字符用 \t 而不能用空格 */
    var buf = `
PROGRAM := a.out
SOURCES := $(wildcard ./*.cpp)
SOURCES += $(wildcard ./src/*.cpp)
OBJS    := $(patsubst %.cpp,%.o,$(SOURCES))
CXX     := g++
CPPFLAGS := -ggdb -Wall -std=c++11
INCLUDE := -I .
LIB     := -lpthread -ldl

.PHONY: clean install
$(PROGRAM): $(OBJS)
\t$(CXX) -o $@ $^ $(LIB) $(CFLAGS)
%.o: %.c
\t$(CXX) -o $@ -c $< $(CPPFLAGS) $(INCLUDE)
clean:
\trm -f $(OBJS) $(PROGRAM)
install: $(PROGRAM)
\tcp $(PROGRAM) ./bin/
    `
    COStreamJS.files['Makefile'] = buf
}

X86CodeGeneration.prototype.CGGlobalvar = function () {
    var buf = `#include "GlobalVar.h" \n`;
    for (let node of COStreamJS.ast) {
        if (node instanceof declareNode) {
            buf += node.toString() + ';\n'
        }
    }
    buf = Plugins.after('CGGlobalvar', buf, COStreamJS.ast)
    COStreamJS.files['GlobalVar.cpp'] = buf.beautify()
}

X86CodeGeneration.prototype.CGGlobalvarHeader = function () {
    var buf = `#ifndef GLOBALVAL_H\n`
    buf += `#define GLOBALVAL_H\n`;
    for (let node of COStreamJS.ast) {
        if (node instanceof declareNode) {
            let str = node.toString().replace(/=\s*\{[^}]*}/g, '') //去除 a[3] = {1,2,3} 的赋值部分
            str = sliceStringFromComma(str)            //去除 a = 2 的赋值部分
            buf += "extern " + str + ';\n'
        }
    }
    buf = Plugins.after('CGGlobalvarHeader', buf)
    COStreamJS.files['GlobalVar.h'] = (buf + `#endif`).beautify();

    //截取一个字符串 = 号后(括号匹配最外层的)逗号前的字符串
    function sliceStringFromComma(str){
        let res = ''
        let paren_depth = 0
        let hasPassedEqual = false
        for(let i of str){
            if(i === '=') hasPassedEqual = true
            if(paren_depth === 0 && i === ',') return res
            if(['[','{','('].includes(i)) paren_depth++
            if([']', '}', ')'].includes(i)) paren_depth--
            if(!hasPassedEqual) res+=i
        }
        return res
    }
}

/**
 * 生成stream流类型和全局数据流缓存区的声明
 * @description 边的命名规则：A_B,其中A->B
 */
X86CodeGeneration.prototype.CGGlobalHeader = function () {
    var buf = `
    #ifndef _GLOBAL_H
    #define _GLOBAL_H
    #include "Buffer.h"
    #include <math.h>
    #include <string>
    using namespace std;
    `

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
    buf += "struct streamData{\n"
    for (let it of typeSet) {
        buf += it.type + ' ' + it.identifier + ';'
    }
    buf += "};\n\n"
    //声明流边
    for (let flat of this.ssg.flatNodes) {
        for (let nextFlat of flat.outFlatNodes) {
            var edgename = flat.name + '_' + nextFlat.name
            buf += `extern Buffer<streamData>${edgename};\n`
        }
    }
    buf += `\n#endif\n`
    // 返回前调用插件功能对文本进行处理
    buf = Plugins.after('CGGlobalHeader', buf)
    COStreamJS.files['Global.h'] = buf.beautify()
}

/**
 * 生成 Global.cpp  用于存储边的信息
 */
X86CodeGeneration.prototype.CGGlobal = function () {
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

/**
 * 为同一核上可以共享内存的缓冲区分配内存
 * @description 根据拓扑排序模拟运行各个CPU上的计算节点找出可以被复用的缓冲区
 */
X86CodeGeneration.prototype.shareBuffers = function () {
    //获取 核号 => 该核上所有节点的拓扑排序 的 Map
    let processor2topoactors = this.GetProcessor2topoactors(this.mp.FlatNode2PartitionNum)
    for (let nodes of processor2topoactors.values()) {
        let vb = [] //用来存储在一次稳态调度中已经使用完的缓冲区

        //按拓扑排序访问各个节点
        nodes.forEach(flat => {
            flat.outFlatNodes.forEach((out, edgePos) => {
                let edgename = flat.name + '_' + out.name
                if (this.bufferMatch.has(edgename)) { return }//如果该边为特殊缓冲区在之前已经分配完成则进入下一条边的分配

                //计算所需要占用的缓冲区大小
                let stageminus = out.stageNum - flat.stageNum
                let perSteadyPushCount = flat.steadyCount * flat.outPushWeights[edgePos]//稳态时产生的数据量
                let size = perSteadyPushCount * (stageminus + 2);

                //分配时首先搜索队列中是否有已经使用完的缓冲区,没有再自己分配内存，使用队列中的缓冲区要将其从队列中删除
                if (vb.length) {
                    let sameClassification = vb.filter(b => b.classification === 'int_x')
                    if (sameClassification) {
                        let availableBuffer = sameClassification.find(b => b.buffersize >= size)
                        if (availableBuffer) {
                            //对当前可用缓冲区中最小的进行内存共享
                            let buffer = new bufferSpace()
                            buffer.original = edgename
                            buffer.instance = availableBuffer.instance
                            buffer.buffersize = availableBuffer.buffersize
                            buffer.buffertype = 2
                            this.bufferMatch.set(edgename, buffer)
                            vb.splice(vb.indexOf(availableBuffer), 1)
                        } else {
                            //若当前可用缓冲区大小都不符合要求则对最大缓冲区进行扩容
                            let maxBuffer = sameClassification.pop()
                            this.bufferMatch.get(maxBuffer.instance).buffersize = size
                            this.bufferMatch.get(maxBuffer.original).buffersize = size

                            let buffer = new bufferSpace()
                            buffer.original = edgename
                            buffer.instance = maxBuffer.instance
                            buffer.buffersize = size
                            buffer.buffertype = 2
                            this.bufferMatch.set(edgename, buffer)
                            vb.splice(vb.indexOf(availableBuffer), 1)
                        }
                    }
                } else {
                    //找不到可以复用的缓冲区，自己进行分配
                    let buffer = new bufferSpace(edgename, edgename, size, 2)
                    this.bufferMatch.set(edgename, buffer)
                }
            })

            //由于空闲缓冲区队列中的缓冲区与原始缓冲区存在映射关系，所以要更新其缓冲区大小
            vb.forEach(v => v.buffersize = this.bufferMatch.get(v.instance).buffersize)

            //当该节点内存分配完之后说明该节点执行完毕，可以将节点上游能够复用的缓冲区加入到队列中
            flat.inFlatNodes.forEach(src => {
                let buffer = this.bufferMatch.get(src.name + '_' + flat.name)
                if(!buffer){
                    console.log(this.bufferMatch)
                    console.warn(src.name, flat.name);
                }
                if (buffer.buffertype == 2) {
                    vb.push(buffer)
                }
            })

            //对 vb 进行排序, 按照 buffersize  升序排列
            vb.sort((a, b) => a.buffersize - b.buffersize)
        })
    }
}

/**
 * 输入一个保存了 FlatNode => 划分核号 的 Map, 返回 核号 => 该核上所有节点的拓扑排序 的 Map
 * @param {Map<FlatNode,number>} map 
 * @return {Map<number,FlatNode[]} processor2topoactors
 */
X86CodeGeneration.prototype.GetProcessor2topoactors = function (map) {
    var processor2topoactors = new Map()
    for (let flat of COStreamJS.topologic) {
        let coreNum = map.get(flat)
        let set = processor2topoactors.get(coreNum) || []
        processor2topoactors.set(coreNum, set.concat(flat))
    }
    return processor2topoactors
}

/**
 * 循环渲染一段字符串, 用 i 替换 $, 用 i+1 替换$$
 * 例如输入 str='extern_$' , start =0, end=3, 则渲染为 'extern_0 \n extern_1 \n extern_2'
 */
function circleRender(str, start, end) {
    let result = ''
    for (let i = start; i < end; i++) {
        result += str.replace(/\$\$/g, i + 1).replace(/\$/g, i) + '\n'
    }
    return result
}

const IOHandler = false
X86CodeGeneration.prototype.CGMain = function () {
    var buf = `
#include <iostream>
#include <fstream>
#include <stdlib.h>
#include <pthread.h>
#include "setCpu.h"
#include "lock_free_barrier.h"	//包含barrier函数
#include "Global.h"
#include "GlobalVar.h"
#include "RingBuffer.h"
using namespace std;
int MAX_ITER=1;//默认的执行次数是1

#SLOT1

${circleRender('extern void thread_$_fun();', 0, this.nCpucore)}
pthread_t tid[${this.nCpucore}];
${circleRender(`
void* thread_$_fun_start(void *)
{
	set_cpu($, tid[$]);
	thread_$_fun();
	return 0;
}
`, 1, this.nCpucore)}

int main(int argc,char **argv){
	void setRunIterCount(int,char**);
    setRunIterCount(argc,argv);
    #SLOT2
	set_cpu(0,tid[0]);
	allocBarrier(${this.nCpucore});
    
    ${circleRender('pthread_create (&tid[$], NULL, thread_$_fun_start, (void*)NULL);', 1, this.nCpucore)}
    #SLOT3
    thread_0_fun();
    #SLOT4
	return 0;
}
//设置运行次数
void setRunIterCount(int argc,char **argv)
{
	int oc;
	while((oc=getopt(argc,argv,"i:"))!=-1)
	{
		switch(oc)
		{
			case 'i':
				MAX_ITER=atoi(optarg);
				break;
		}
	}
}
`
    if (!IOHandler) {
        buf = buf.replace(/#SLOT\d/g, '')
    } else {
        let workcount = this.ssg.flatNodes[0].steadyCount
        let IOHandler_strings = getIOHandlerStrings(this.workLen, 0, workcount)
        buf = buf.replace(/#SLOT1/, IOHandler_strings[0])
        buf = buf.replace(/#SLOT2/, IOHandler_strings[1])
        buf = buf.replace(/#SLOT3/, IOHandler_strings[2])
        buf = buf.replace(/#SLOT4/, IOHandler_strings[3])
    }
    buf = Plugins.after('CGMain', buf)
    COStreamJS.files['main.cpp'] = buf.beautify()
}

/**
 * 生成包含所有 actor 头文件的 AllActorHeader.h
 */
X86CodeGeneration.prototype.CGAllActorHeader = function () {
    var buf = ''
    this.ssg.flatNodes.forEach(flat => {
        buf += `#include "${flat.PreName}.h"\n`
    })
    COStreamJS.files['AllActorHeader.h'] = buf
}

/**
 * 生成所有线程文件
 */
X86CodeGeneration.prototype.CGThreads = function () {
    debugger;
    for (let i = 0; i < this.nCpucore; i++) {
        var buf = ''
        let MaxStageNum = COStreamJS.MaxStageNum
        buf = `
/*该文件定义各thread的入口函数，在函数内部完成软件流水迭代*/
#include "Buffer.h"
#include "Producer.h"
#include "Consumer.h"
#include "Global.h"
#include "AllActorHeader.h"	//包含所有actor的头文件
#include "lock_free_barrier.h"	//包含barrier函数
#include "rdtsc.h"
#include <fstream>
extern int MAX_ITER;
        `
        buf += `void thread_${i}_fun()\n{\n`
        let syncString = (i > 0 ? `workerSync(` + i : `masterSync(` + this.nCpucore) + `);\n`
        buf += syncString

        let actorSet = this.mp.PartitonNum2FlatNode.get(i) //获取到当前线程上所有flatNode
        actorSet.forEach(flat => {
            //准备构造如下格式的声明语句: Name Name_obj(out1,out2,in1,in2,steadyC,initC,[params?]);
            buf += flat.PreName + ' ' + flat.name + '_obj('
            let streamNames = [], comments = []
            flat.outFlatNodes.forEach(out => {
                let edgename = flat.name + '_' + out.name
                let buffer = this.bufferMatch.get(edgename)
                if (buffer.instance !== buffer.original) {
                    comments.push(buffer.original + '使用了' + buffer.instance + '的缓冲区')
                }
                streamNames.push(buffer.instance) //使用实际的缓冲区
            })
            flat.inFlatNodes.forEach(src => {
                let edgename = src.name + '_' + flat.name
                let buffer = this.bufferMatch.get(edgename)
                if (buffer.instance !== buffer.original) {
                    comments.push(buffer.original + '使用了' + buffer.instance + '的缓冲区')
                }
                streamNames.push(buffer.instance) //使用实际的缓冲区
            })
            streamNames.push(flat.steadyCount)
            streamNames.push(flat.initCount)
            buf += streamNames.concat(flat.params).join(',') + ');'
            comments.length && (buf += ' //' + comments.join(','))
            buf += '\n'
        })

        const constant_array = [1].concat(Array(MaxStageNum-1).fill(0)) // 得到这样的数组: [1,0,0,...,0] 长度为阶段数
        buf += `char stage[${MaxStageNum}] = {${constant_array.join()}};\n`

        //生成初态的 initWork 对应的 for 循环
        let initFor = `
        for(int _stageNum = 0; _stageNum < ${MaxStageNum}; _stageNum++){
            #SLOT
            ${syncString}
        }
        `
        var forBody = ''
        let stageSet = this.mapNum2Stage.get(i)    //查找该thread对应的阶段号集合
        for (let stage = MaxStageNum - 1; stage >= 0; stage--) {
            if (stageSet.has(stage)) {
                //如果该线程在阶段i有actor
                let ifStr = `if(${stage} == _stageNum){`
                //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat => flat.stageNum == stage)
                ifStr += flatVec.map(flat => flat.name + '_obj.runInitScheduleWork();\n').join('') + '}\n'
                forBody += ifStr
            }
        }
        buf += initFor.replace('#SLOT', forBody)
        //初态的 initWork 对应的 for 循环生成完毕

        //生成稳态的 steadyWork 对应的 for 循环
        let steadyFor = `
        for(int _stageNum = ${MaxStageNum}; _stageNum < 2*${MaxStageNum}+MAX_ITER-1; _stageNum++){
            #SLOT
            ${syncString}
        }
        `
        var forBody = ''
        for (let stage = MaxStageNum - 1; stage >= 0; stage--) {
            if (stageSet.has(stage)) {
                //如果该线程在阶段i有actor
                let ifStr = `if(stage[${stage}]){`
                //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                debugger;
                let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat => flat.stageNum == stage)
                ifStr += flatVec.map(flat => flat.name + '_obj.runSteadyScheduleWork();\n').join('') + '}\n'
                forBody += ifStr
            }
        }
        forBody += 
        `for(int index=${MaxStageNum-1}; index>=1; --index){
            stage[index] = stage[index-1];
         }
         if(_stageNum == MAX_ITER - 1 + ${MaxStageNum}){
             stage[0] = 0;
         }
        `
        buf += steadyFor.replace('#SLOT', forBody)
        //稳态的 steadyWork 对应的 for 循环生成完毕

        buf += '}'
        COStreamJS.files[`thread_${i}.cpp`] = buf.beautify()
    }
}

/** COStream 内建节点, 无需去重 */
const ProtectedActor = ['join', 'duplicate', 'roundrobin']
/**
 * 生成各个计算节点, 例如 source.h sink.h
 */
X86CodeGeneration.prototype.CGactors = function () {
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
            //由于目前不支持多类型流变量，这里先强制设置为int
            buf += `
            struct source{
                int buffer[${this.workLen}];
            };
            extern RingBuffer<source> ringBuffer;
            `
        }

        //开始构建 class
        buf += `class ${flat.PreName}{\n`
        buf += `public:\n`
        /*写入类成员函数*/
        let inEdgeNames = flat.contents.inputs
        let outEdgeNames = flat.contents.outputs
        buf += this.CGactorsConstructor(flat, inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
        buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
        /*写入类成员变量*/
        buf += "private:\n";
        outEdgeNames.forEach(out => buf += `Producer<streamData>${out};\n` )
        inEdgeNames.forEach(src => buf += `Consumer<streamData>${src};\n`)
        flat._symbol_table.paramNames.forEach(param => buf += `int ${param};\n`)
        buf += "int steadyScheduleCount;\t//稳态时一次迭代的执行次数\n";
        buf += "int initScheduleCount;\n";
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
 * rtest_3(Buffer<streamData>& Out,Buffer<streamData>& In, int steadyC, int initC, [params?]):Out(Out),In(In),param(param){
 *		steadyScheduleCount = steadyC;
 *		initScheduleCount = initC;
 * }
 */
X86CodeGeneration.prototype.CGactorsConstructor = function(flat, inEdgeNames, outEdgeNames) {
    var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames) // 把 out 放前面, in 放后面
    var paramNames = flat._symbol_table.paramNames
    var paramWithType = paramNames.map(name => 'int '+name) // FIXME 暂时先都用 int
    var buf = flat.PreName + '('
    buf += OutAndInEdges.map(s => 'Buffer<streamData>& ' + s).concat(['int steadyC','int initC']).concat(paramWithType).join(',') + '):'
    buf += OutAndInEdges.concat(paramNames).map(s => s + '(' + s + ')').join(',') + '{'
    buf += `
        steadyScheduleCount = steadyC;
		initScheduleCount = initC;
	}
    `
    return buf
}
/**
 * @example
 * void runInitScheduleWork() {
 *		initVarAndState();
 *		init();
 *		for(int i=0;i<initScheduleCount;i++)
 *			work();
 *		round1_0.resetTail();
 *		round1_1.resetTail();
 *		dup0_0.resetHead();
 *	}
 */
X86CodeGeneration.prototype.CGactorsRunInitScheduleWork = function (inEdgeNames, outEdgeNames) {
    var buf = `
    void runInitScheduleWork() {
		initVarAndState();
		init();
		for(int i=0;i<initScheduleCount;i++){    
            work();
        }`;
    (outEdgeNames || []).forEach(out => buf += out + '.resetTail();\n');
    (inEdgeNames || []).forEach(src => buf += src + '.resetHead();\n');
    return buf + '}\n'
}

/**
 * @example
 * void runSteadyScheduleWork() {
 *		for(int i=0;i<steadyScheduleCount;i++)
 *			work();
 *		round1_0.resetTail2();
 *		round1_1.resetTail();
 *		dup0_0.resetHead2();
 *	}
 */
X86CodeGeneration.prototype.CGactorsRunSteadyScheduleWork = function(inEdgeNames, outEdgeNames) {
    var buf = `
    void runSteadyScheduleWork() {
		for(int i=0;i<steadyScheduleCount;i++){
            work();
        }`;
    // var use1Or2 = str => this.bufferMatch.get(str).buffertype == 1 ? '' : '2';
    (outEdgeNames || []).forEach(out => buf += out + '.resetTail();\n');
    (inEdgeNames || []).forEach(src => buf += src + '.resetHead();\n');
    return buf + '}\n'
}

/**
 * 将.cos 文件中的 operator 的 init 前的变量声明转为新的 class 的 private 成员,例如 
 * private: 
 *   int i; 
 *   int j;
 * 而赋值操作放到 initVarAndState 中去做
 * @param {declareNode[]} stmt_list
 */
X86CodeGeneration.prototype.CGactorsStmts = function (stmt_list) {
    /*解析等号类似int i=0,j=1形式变成int i; int j;的形式,因为类的成员变量定义不能初始化*/
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
X86CodeGeneration.prototype.CGactorsPopToken = function (flat, inEdgeNames) {
    let streams = {}
    for(let winStmt of flat.contents.operBody.win){
        streams[winStmt.winName] = winStmt.arg_list[0].toString()
    }
    const stmts = inEdgeNames.map(src => `${src}.updatehead(${streams[src]});\n`).join('')
    return `\n void popToken(){ ${stmts} }\n`
}

/**
 * 生成 class 的 private 部分的 pushToken 函数, 例如
 * void pushToken() {
 *		Dstream0_1.updatetail(2);
 * }
 * @param {FlatNode} flat
 */
X86CodeGeneration.prototype.CGactorsPushToken = function (flat, outEdgeNames) {
    let streams = {}
    for(let winStmt of flat.contents.operBody.win){
        streams[winStmt.winName] = winStmt.arg_list[0].toString()
    }
    const stmts = outEdgeNames.map(out => `${out}.updatetail(${streams[out]});\n`).join('')
    return `\n void pushToken(){ ${stmts} }\n`
}

/** 
 * 将 stmt_list 中的 int i=0部分转换为 i=0; 
 * @param {declareNode[]} stmt_list
 */
X86CodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list){
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
X86CodeGeneration.prototype.CGactorsInit = function(init){
    return `void init() ${init|| '{ }'} \n`
}

/** 
 * @param {blockNode} work 
 * @param {FlatNode} flat
 */
X86CodeGeneration.prototype.CGactorsWork = function (work, flat, inEdgeNames, outEdgeNames){
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