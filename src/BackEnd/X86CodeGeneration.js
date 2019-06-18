import { COStreamJS } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode } from "../ast/node";
import { getIOHandlerStrings } from "./IOHandler"
import { FlatNode } from "../FrontEnd/FlatNode"
import { StaticStreamGraph } from "../FrontEnd/StaticStreamGraph";
import { Partition } from "./Partition"

export class X86CodeGeneration {

    constructor(nCpucore, ssg, mp) {

        this.nCpucore = nCpucore
        /**@type {StaticStreamGraph} */
        this.ssg = ssg
        /**@type {Partition} */
        this.mp = mp

        /** @type {Map<string,bufferSpace>} 字符串到对应的缓冲区的映射 */
        this.bufferMatch = new Map()

        /** @type {Map<string,int>} 缓冲区到对应缓冲区类型的映射，通过这个来判断调用consumer和producer哪种方法 */
        this.bufferType = new Map()

        /** @type {Map<number,Set<number>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
        this.mapNum2Stage = new Map()

        //构造每个线程上的stage集合mapNum2Stage
        for (let i = 0; i < nCpucore; i++) {
            let stageNums = new Set() //使用Set来对阶段号做"数组去重"操作
            this.mp.PartitonNum2FlatNode.get(i).forEach(flat => stageNums.add(flat.stageNum))
            this.mapNum2Stage.set(i, stageNums) //Set 转回数组
        }
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
    var buf = `
    PROGRAM := a.out
    SOURCES := $(wildcard ./*.cpp)
    SOURCES += $(wildcard ./src/*.cpp)
    OBJS    := $(patsubst %.cpp,%.o,$(SOURCES))
    CC      := g++
    CFLAGS  := -ggdb -Wall 
    INCLUDE := -I .
    LIB     := -lpthread -ldl

    .PHONY: clean install
    $(PROGRAM): $(OBJS)
    \t$(CC) -o $@ $^ $(LIB)
    %.o: %.c
    \t$(CC) -o $@ -c $< $(CFLAGS) $(INCLUDE)
    clean:
    \trm $(OBJS) $(PROGRAM) -f
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
    COStreamJS.files['GlobalVar.cpp'] = buf
}

X86CodeGeneration.prototype.CGGlobalvarHeader = function () {
    var buf = `#ifndef GLOBALVAL_H\n`
    buf += `#define GLOBALVAL_H\n`;
    for (let node of COStreamJS.ast) {
        if (node instanceof declareNode) {
            let str = node.toString().replace(/=\s*\{[^}]*}/g, '') //去除 a[3] = {1,2,3} 的赋值部分
            str = str.replace(/=[^,]+/g, '')            //去除 a = 2 的赋值部分
            buf += "extern " + str + ';\n'
        }
    }
    COStreamJS.files['GlobalVar.h'] = buf + `#endif`
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
            if (perWorkPeekCount != perWorkPopCount || copySize || copyStartPos || stageminus) {
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
 * 循环渲染一段字符串, 用 i 替换 $
 * 例如输入 str='extern_$' , start =0, end=3, 则渲染为 'extern_0 \n extern_1 \n extern_2'
 */
function circleRender(str, start, end) {
    let result = ''
    for (let i = start; i < end; i++) {
        result += str.replace(/\$/g, i) + '\n'
    }
    return result
}

const workLen = 262144
const IOHandler = true
X86CodeGeneration.prototype.CGMain = function () {
    var buf = `
#include <iostream>
#include <fstream>
#include <stdlib.h>
#include <pthread.h>
#include "setCpu.h"
#include "lock_free_barrier.h"	//包含barrier函数
#include "Global.h"
#include "RingBuffer.h"
using namespace std;
int MAX_ITER=1;//默认的执行次数是1

#SLOT1

${circleRender('extern void thread_$_func();', 0, this.nCpucore)}
${circleRender(`
void* thread_$_fun_start(void *)
{
	set_cpu($);
	thread_$_fun();
	return 0;
}
`, 1, this.nCpucore)}

int main(int argc,char **argv)
{
	void setRunIterCount(int,char**);
    setRunIterCount(argc,argv);
    #SLOT2
	set_cpu(0);
	allocBarrier(2);
	pthread_t tid[1];
    pthread_create (&tid[0], NULL, thread_1_fun_start, (void*)NULL);
    #SLOT3
    thread_0_fun();
    #SLOT4
	return 0;
}
//设置运行次数
void setRunIterCount(int argc,char **argv)
{
	int oc;
	char *b_opt_arg;
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
        let IOHandler_strings = getIOHandlerStrings(workLen, 0, workcount)
        buf = buf.replace(/#SLOT1/, IOHandler_strings[0])
        buf = buf.replace(/#SLOT2/, IOHandler_strings[1])
        buf = buf.replace(/#SLOT3/, IOHandler_strings[2])
        buf = buf.replace(/#SLOT4/, IOHandler_strings[3])
    }
    COStreamJS.files['main.cpp'] = buf.beautify()
}

/**
 * 生成包含所有 actor 头文件的 AllActorHeader.h
 */
X86CodeGeneration.prototype.CGAllActorHeader = function () {
    var buf = ''
    this.ssg.flatNodes.forEach(flat => {
        buf += `#include "${flat.name}.h"\n`
    })
    COStreamJS.files['AllActorHeader.h'] = buf
}

/**
 * 生成所有线程文件
 */
X86CodeGeneration.prototype.CGThreads = function () {
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
        buf += `void thread_${i}_func()\n{\n`
        let syncString = (i > 0 ? `workerSync(` + i : `masterSync(` + this.nCpucore) + `);\n`
        buf += syncString

        let actorSet = this.mp.PartitonNum2FlatNode.get(i) //获取到当前线程上所有flatNode
        actorSet.forEach(flat => {
            //准备构造如下格式的声明语句: Name Name_obj(in1,in2,in3,out1);
            buf += flat.name + ' ' + flat.name + '_obj('
            let streamNames = [], comments = []
            flat.inFlatNodes.forEach(src => {
                let edgename = src.name + '_' + flat.name
                let buffer = this.bufferMatch.get(edgename)
                if(buffer.instance !== buffer.original) { 
                    comments.push(buffer.original +'使用了'+ buffer.instance+'的缓冲区') 
                }
                streamNames.push(buffer.instance) //使用实际的缓冲区
            })
            flat.outFlatNodes.forEach(out => {
                let edgename = flat.name + '_' + out.name
                let buffer = this.bufferMatch.get(edgename)
                if (buffer.instance !== buffer.original) {
                    comments.push(buffer.original + '使用了' + buffer.instance + '的缓冲区')
                }
                streamNames.push(buffer.instance) //使用实际的缓冲区
            })
            buf += streamNames.join(',') + ');'
            comments.length && (buf += ' //' + comments.join(','))
            buf+='\n'
        })

        buf += 'char stage[' + MaxStageNum + '];\n'
        buf += 'stage[0] = 1;\n'

        //生成初态的 initWork 对应的 for 循环
        let initFor = `
        for(int _stageNum = 0; _stageNum < ${MaxStageNum}; _stageNum++){
            #SLOT
            ${syncString}
        }
        `
        var forBody = ''
        let stageSet = this.mapNum2Stage.get(i)    //查找该thread对应的阶段号集合
        for(let stage = MaxStageNum - 1; stage >=0 ;stage--){
            if(stageSet.has(stage)){
                //如果该线程在阶段i有actor
                let ifStr = `if(stage[${stage}] == _stageNum){`
                //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat=>flat.stageNum == stage)
                ifStr += flatVec.map(flat=>flat.name+'_obj.runInitScheduleWork();\n').join('') + '}\n'
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
                let ifStr = `if(stage[${stage}] == _stageNum){`
                //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat => flat.stageNum == stage)
                ifStr += flatVec.map(flat => flat.name + '_obj.runInitScheduleWork();\n').join('') + '}\n'
                forBody += ifStr
            }
        }
        buf += steadyFor.replace('#SLOT', forBody)
        //稳态的 steadyWork 对应的 for 循环生成完毕

        buf+='}'
        COStreamJS.files[`thread_${i}.cpp`] = buf.beautify()
    }
}

X86CodeGeneration.prototype.CGactors = function () {

}