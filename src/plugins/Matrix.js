import { jump_statement, blockNode, idNode, expNode, labeled_statement, forNode, declareNode, declarator, compositeNode, ComInOutNode, compBodyNode, inOutdeclNode, strdclNode, paramNode, binopNode, operatorNode, operBodyNode, constantNode, unaryNode, winStmtNode, callNode, compositeCallNode, selection_statement, castNode, parenNode } from "../ast/node.js"
import { debug } from "../utils/color.js";
import { matrix_constant } from "../ast/node.js";

// 该函数组的执行时机为代码生成的尾巴, 对生成的 buf 通过字符串替换的手段达到目的
const Matrix_Object = {
    CGMain(buf){
        /* 在 main 函数头部中插入 initGlobalVar() 函数
         * 考虑到普通的全局变量都是可以直接在.h 文件中声明的类型, 例如 a[] = {1,2,3}
         * 而矩阵必须在函数执行阶段赋初始值. */
        debugger;
        return buf.replace(/int main\(int argc,char \*\*argv\){/, `int main(int argc,char **argv){ initGlobalVar();`)
    },
    CGGlobalHeader(buf){
        // 引入矩阵头文件
        buf = buf.replace("using namespace std;",
        `using namespace std;
        #include "Eigen/Dense"
        using Eigen::MatrixXd;
        typedef MatrixXd Matrix;
        `
        )
        return buf
    },
    CGGlobalvarHeader(buf){
        buf = buf.replace("#define GLOBALVAL_H",`#define GLOBALVAL_H
        #include "Eigen/Dense"
        using Eigen::MatrixXd;
        typedef MatrixXd Matrix;
        void initGlobalVar();
        `)
        return buf
    },
    CGGlobalvar(buf,ast){
        // 矩阵的常量声明比较特殊, 所以直接重写
        let ReWriteBuf = `#include "GlobalVar.h" \n`;
        /** @type{ declareNode[] } */
        const matrixVars = []
        for (let node of ast) {
            if (node instanceof declareNode) {
                if(node.type === 'Matrix'){
                    matrixVars.push(node)
                    ReWriteBuf += 'MatrixXd '
                    for (let declarator of node.init_declarator_list){
                        ReWriteBuf += declarator.identifier.toString()
                    }
                    ReWriteBuf += ';\n'
                }else{
                    ReWriteBuf += node.toString() + ';\n'
                }
            }
        }
        ReWriteBuf += `void initGlobalVar(){ ${initMatrix()}`
        return ReWriteBuf += '}'

        // 根据 matrixVars 的内容, 在 initGlobalVar 函数中执行矩阵的初始化
        function initMatrix(){
            var buf = ''
            for(let node of matrixVars){
                for(let declarator of node.init_declarator_list){
                    // 如果是矩阵数组
                    if(declarator.identifier.arg_list.length){
                        const length = declarator.initializer.length // 暂时只支持一维数组
                        const shape = declarator.initializer[0].shape
                        const name = declarator.identifier.name
                        /**
                         * 一般 rawData 为 [ [1,2], [3,4] ] 格式的数组, 由于MatrixXd 已经定了宽高,
                         * 所以可以使用 array[i] << 1,2,3,4; 的方式来赋初值
                         */
                        for (let i = 0; i < length; i++) {
                            const sequence = declarator.initializer[i].rawData.flat().join();
                            buf += `
                                ${name}[${i}] = MatrixXd(${shape[0]},${shape[1]});
                                ${name}[${i}] << ${sequence};
                            `
                        }
                    }
                    //如果是单个矩阵
                    else{
                        if(declarator.initializer instanceof matrix_constant){
                            const shape = declarator.initializer.shape
                            const name = declarator.identifier.name
                            const sequence = declarator.initializer.rawData.flat().join();
                            buf += `
                                ${name} = MatrixXd(${shape[0]},${shape[1]});
                                ${name} << ${sequence};
                            `
                        }else if(declarator.initializer instanceof callNode){
                            const name = declarator.identifier.name
                            buf += `${name} = ${declarator.initializer};`
                        }else{
                            debug("FIXME: 代码生成-矩阵插件-矩阵常量初始化类型错误")
                        }
                    }
                }
            }
            return buf;
        }
    }
}

const Void = x=>x // 默认函数, 返回原参数

// 添加代理, 避免访问不存在的函数而报错
export const Matrix = new Proxy(Matrix_Object, {
    get: function (target, key, receiver) {
        return target[key] ? target[key] : Void;
    },
})
export default Matrix;