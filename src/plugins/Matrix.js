// 该函数组的执行时机为代码生成的尾巴, 对生成的 buf 通过字符串替换的手段达到目的
const Matrix_Object = {
    CGGlobalHeader(buf){
        // 引入矩阵头文件
        buf = buf.replace("using namespace std;",
        `using namespace std;
        #include "Eigen/Dense"
        using Eigen::MatrixXd;
        `
        )
        //替换 streamData 的类型声明
        buf = buf.replace(/Matrix\b/, 'MatrixXd *'); 
        return buf
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