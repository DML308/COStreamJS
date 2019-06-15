import { COStreamJS } from "../FrontEnd/global"
import { declareNode } from "../ast/node";

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
    COStreamJS.files['GLobalVar.cpp'] = buf
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
    COStreamJS.files['GLobalVar.h'] = buf+`#endif`
}