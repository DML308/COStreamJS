import { COStreamJS } from "../FrontEnd/global"
import { declareNode, function_definition, compositeNode, strdclNode } from "../ast/node";
import { getIOHandlerStrings } from "./IOHandler"
export class X86CodeGeneration {

    constructor(nCpucore, ssg, mp) {

        this.nCpucore = nCpucore
        this.ssg = ssg
        this.mp = mp

        /** @type {Map<string,bufferSpace>} 字符串到对应的缓冲区的映射 */
        this.bufferMatch = new Map()

        /** @type {Map<string,int>} 缓冲区到对应缓冲区类型的映射，通过这个来判断调用consumer和producer哪种方法 */
        this.bufferType = new Map()

        /** @type {Map<number,number[]>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
        this.mapNum2Stage = new Map()
    }
}

class bufferSpace {
    constructor() {
        /** @type {string} 原始缓冲区的名称 */
        this.original = ''
        /** @type {string} 实际对应的缓冲区名称 */
        this.instance = ''
        /** @type {int} 分配缓冲区的大小 */
        this.buffersize = ''
        /** @type {int} 分配缓冲区的类型，是否可复用，0代表未分配，1代表不可复用，2代表可复用 */
        this.buffertype = ''
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
        debugger
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

X86CodeGeneration.prototype.CGGlobal = function () {

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

${circleRender('extern void thread_$_func();',0,this.nCpucore)}
${circleRender(`
void* thread_$_fun_start(void *)
{
	set_cpu($);
	thread_$_fun();
	return 0;
}
`,1,this.nCpucore)}

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
    if(! IOHandler){
        buf = buf.replace(/#SLOT\d/g,'')
    }else{
        let workcount = this.ssg.flatNodes[0].steadyCount
        let IOHandler_strings = getIOHandlerStrings(workLen, 0, workcount)
        buf = buf.replace(/#SLOT1/, IOHandler_strings[0])
        buf = buf.replace(/#SLOT2/, IOHandler_strings[1])
        buf = buf.replace(/#SLOT3/, IOHandler_strings[2])
        buf = buf.replace(/#SLOT4/, IOHandler_strings[3])
    }
    COStreamJS.files['main.cpp'] =  buf.beautify()
}