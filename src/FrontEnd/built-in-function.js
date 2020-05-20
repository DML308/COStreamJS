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


export const BUILDIN_MATRIX_FUNCTIONS = ['transpose','cwiseProduct']