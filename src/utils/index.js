import { error } from "./color"
export { debug, line, error, green, errors } from './color.js'
export { ast2dot } from './ast2dot.js'
export { deepCloneWithoutCircle } from "./deepClone.js"

export function checkBraceMatching(str = ''){
    let stack = [], line = 0
    let symmetry = { '[':']', '(':')', '{':'}' }
    for(let s of str){
        if(s == '(' || s == '[' || s == '{'){
            stack.push(s)
        }else if( s == ')' || s == ']' || s == '}'){
            let top = stack.pop()
            if(symmetry[top] !== s){
                error({first_line:line}, `括号不匹配`)
                return false
            }
        }else if( s == '\n'){
            line++
        }
    }
    return true
}