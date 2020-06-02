import { error } from "../utils";

export const BUILTIN_PRINT = ['print', 'println']
export const BUILTIN_MATH = ['pow', 'sin','cos','tan','floor','round','ceil','abs','log','sqrt','exp', 'random']
export const BUILTIN_FUNCTIONS = ['print','println','Native'].concat(BUILTIN_MATH);
export const BUILTIN_FUNCTIONS_ARG = {
    print:  { length:'any', hint:'输出函数' },
    println:{ length:'any', hint:'输出函数' },
    Native: { length:'any', hint:'内置函数' },
    pow:    { length:2, hint:'(底数,指数)' },
    sin:    { length:1, hint:'(弧度)'     },
    cos:    { length:1, hint:'(弧度)'     },
    tan:    { length:1, hint:'(弧度)'     },
    floor:  { length:1, hint:'(数字)'     },
    round:  { length:1, hint:'(数字)'     },
    ceil:   { length:1, hint:'(数字)'     },
    abs:    { length:1, hint:'(数字)'     },
    log:    { length:1, hint:'(数字), 以e为底数' },
    sqrt:   { length:1, hint:'(数字)'     },
    exp:    { length:1, hint:'(数字)'     },
    random: { length:0, hint:'无需传参'    }
}

export const BUILTIN_MATRIX_STATIC_FUNCTIONS = ['random','constant','zeros','ones','identity']
export const BUILTIN_MATRIX_STATIC_FUNCTIONS_ARG = {
    random:     { length:2, hint: '随机矩阵的初始(行数,列数)' , returnShape: args=>[args[0],args[1]] },
    constant:   { length:3, hint: '常数矩阵的初始(行数,列数,常数值)', returnShape: args=>[args[0],args[1]]},
    zeros:      { length:2, hint: '全零矩阵(行数,列数)', returnShape: args=>[args[0],args[1]]},
    ones:       { length:2, hint: '全1矩阵(行数,列数)', returnShape: args=>[args[0],args[1]]},
    identity:   { length:1, hint: '单位矩阵的(行列数)', returnShape: args=>[args[0],args[0]] },
}
export const BUILTIN_MATRIX_FUNCTIONS = ['rank','trace','det','sum','rows','cols','shape','reshape','transpose','cwiseProduct','exp','pow','log','sin','cos']

export const BUILTIN_MATRIX_FUNCTIONS_ARG = {
    rank:   { length:0, hint:'矩阵的秩', returnShape: [1,1] },
    trace:  { length:0, hint:'矩阵的迹', returnShape: [1,1] },
    det:    { length:0, hint:'矩阵的行列式值',returnShape: [1,1] },
    sum:    { length:0, hint:'矩阵全元素求和',returnShape: [1,1] },
    rows:   { length:0, hint:'矩阵的行数',returnShape: [1,1] },
    cols:   { length:0, hint:'矩阵的列数',returnShape: [1,1] },
    shape:  { length:0, hint:'矩阵的[行数,列数]',returnShape: [2,1] },
    reshape:{ 
        length:2, 
        hint:'(行数,列数)', 
        returnShape: (lshape,args,_loc) =>{
            if(args[0] * args[1] !== lshape[0] * lshape[1]){
                throw new Error(error(_loc || lshape._loc, `不能将${lshape[0]}x${lshape[1]}的矩阵reshape为${args[0]}x${args[1]}`))
            }
            return [args[0],args[1]]
        }
    },
    transpose:{
        length:0,
        hint:'矩阵转置',
        returnShape: (lshape) =>{
            return [lshape[1], lshape[0]]
        }
    },
    cwiseProduct:{
        length:1,
        hint:'矩阵各元素位置对应相乘',
        returnShape:(lshape,args,_loc) =>{
            if(lshape[0] !== args[0] || lshape[1] !== args[1]){
                throw new Error(error(_loc || lshape._loc, `不能将${lshape[0]}x${lshape[1]}的矩阵与${args[0]}x${args[1]}的矩阵对位相乘`))
            }
            return [args[0],arg[1]]
        }
    },
    exp:    { length: 'any', hint:'矩阵各元素以e为底数的指数映射' ,returnShape: (lshape)=> lshape },
    pow:    { length: 1, hint:'矩阵各元素以该元素为底数的指数映射' ,returnShape: (lshape)=> lshape },
    log:    { length: 1, hint:'矩阵各元素以e为底数的对数映射' ,returnShape: (lshape)=> lshape },
    sin:    { length: 1, hint:'矩阵各的正弦映射' ,returnShape: (lshape)=> lshape },
    cos:    { length: 1, hint:'矩阵各的余弦映射' ,returnShape: (lshape)=> lshape }
}


export function getMostNearName(/** @type {string[]} */names, /** @type {string} */name){
    let min = 9999, minName = ''
    for(let i=0;i<names.length;i++){
        const distance = minDistance(names[i] , name)
        if(distance <= 1 ) return names[i]
        if(distance < min){
            min = distance
            minName = names[i]
        }
    }
    return minName
}
/** 最小编辑距离 
 * @return {number} */
function minDistance(/** @type {string} */word1, /** @type {string} */word2) {
    let n = word1.length;
    let m = word2.length;
    let dp = [];
    for(let i = 0;i <= n;i++){
        dp.push([])
        for(let j = 0;j <= m;j++){
            if(i*j){
                dp[i][j] = word1[i-1] == word2[j-1]? dp[i-1][j-1]: (Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]) + 1);
            }else{
                dp[i][j] = i + j;
            }
        }
    }
    return dp[n][m];
};