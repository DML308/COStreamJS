/**
 * 输入一个 object 返回 graphviz 工具能识别的 dot 字符串
 */
export function ast2dot(node){
    ast2dot.count = 0
    var header = `digraph { \n    node [shape = record];\n`
    var body = ''
    dumpdot(node)
    //应 dot 文件格式的要求, 对中间部分的 [] {} "" 这些特殊符号进行转义
    body = body.replace(/\[(?!label|shape)/g, "\\[").replace(/](?!;)/g, "\\]")
    body = body.replace(/(\{|\})/, "\\$1")
    body = body.replace(/(?<!\[label = )\"(?!];)/g,`\\"`)
    header += body + `}`
    return header 

    function dumpdot(node){ 
        //下面这个 if 大部分情况都走第二个分支
        //第一个分支是为了 Program 语法树的根节点(可能有不同类型的孩子,例如 declaration,function,composite)
        if(node instanceof Array){
            if(node.length>0){
                var types = [...new Set(node.map(x=>x.constructor.name))].join(" or ")
                body += `    ${ast2dot.count} [label = "[${node.length} ${types}]"];\n`
                var nThis = ast2dot.count++
                var tag = 0
                for(var i of Object.keys(node)){
                    var nChild = dumpdot(node[i])
                    body += `    ${nThis}:${tag++} -> ${nChild}\n`
                }
            }else{
                var line = `    ${ast2dot.count} [label = "[ ]"`
                return ast2dot.count++
            }
        }else{
            //生成一个dot 文件中的行
            var nThis = newNode(node)
            //遍历它的孩子将 nThis 和 nChild 进行连线
            var tag = 0
            for (var i of Object.keys(node)) {
                if (node[i] === undefined) continue
                if (node[i] instanceof Array) {
                    node[i].forEach((child) => {
                        var nChild = dumpdot(child)
                        body += `    ${nThis}:${tag} -> ${nChild}\n`
                    })
                    tag++
                } else if (node[i] instanceof Object) {
                    var nChild = dumpdot(node[i])
                    body += `    ${nThis}:${tag++} -> ${nChild}\n`
                } else {
                    tag++
                }
            }
        }
        return nThis
    }
    /**
     * 输入 node 为 object,创建一行格式为 
     * 6 [label="<1> int |<2> 2"] 的 dot 字符串
     * 返回该节点的序号, 例如6
     */
    function newNode(node){
        var line = `    ${ast2dot.count} [label = "`
        var first = true
        var tag = 0
        var keys = Object.keys(node)
        for(var i of keys){
            if(node[i] === undefined) continue
            line+= first ? '' : " |"
            first = false
            line += `<${tag++}> `
            if(typeof node[i] == 'number'){
                line+= node[i]
            }else if(typeof node[i] == 'string'){
                line+= node[i]
            }else if (node[i] instanceof Array) {
                if(node[i].length > 0)  line+= `[${node[i].length} ${node[i][0].constructor.name}]` 
                else line += `[ ]`
            }else{
                line+= ' '
            }
        }
        line += `"];\n`
        body += line
        return ast2dot.count++
    }
}