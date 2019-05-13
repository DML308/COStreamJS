/**
 * 输入一个 object 返回 graphviz 工具能识别的 dot 字符串
 */
export function ast2dot(node){
    var result = `digraph { \n node [shape = record];\n`

    result += `}`
    return result
}