
import { X86CodeGeneration } from "../BackEnd/X86CodeGeneration"
import { COStreamJS } from "../FrontEnd/global"

export function codeGeneration(nCpucore, ssg, mp){
    COStreamJS.options.platform = 'X86'
    
    var X86Code = new X86CodeGeneration(nCpucore, ssg, mp);
    X86Code.CGMakefile();        //生成Makefile文件
    X86Code.CGGlobalvar();       //生成流程序引入的全局变量定义文件 GlobalVar.cpp
    X86Code.CGGlobalvarHeader(); //生成流程序引入的全局变量的声明文件 GlobalVar.h
    X86Code.CGGlobalHeader();    //生成流程序的所有缓冲区声明Global.h
    X86Code.CGGlobal();          //生成流程序的所有缓冲区信息Global.cpp
    X86Code.CGactors();          //生成以类表示的计算单元actor
    X86Code.CGAllActorHeader();  //生成所有actor节点头文件
    X86Code.CGThreads();         //生成所有线程
    X86Code.CGMain();            //生成线程启动的main文件
    //X86Code.CGFunctionHeader();  //生成function头文件
    //X86Code.CGFunction();        //生成function定义

    /** 拷贝程序运行所需要的库文件 */
    if(typeof module !== 'undefined'){
        // 在 node 执行时是以 dist/costream-cli.js 的文件路径为准, 所以 ../lib
        const fs = require('fs')
        const dir = require('path').resolve(__dirname, '../lib')
        const filenames = fs.readdirSync(dir) 
        /* ['Buffer.h','Consumer.h','Producer.h',
            'lock_free_barrier.cpp','lock_free_barrier.h',
            'rdtsc.h','setCpu.cpp','setCpu.h'] */
        filenames.forEach(name => {
            COStreamJS.files[name] = fs.readFileSync(`${dir}/${name}`, 'utf8')
        })
        console.log(dir, filenames)
    }else{
        console.warn('浏览器版本暂不支持拷贝库文件')
    }
}