
import { compositeNode }from "../ast/node.js"

export class SemCheck {
    constructor(){

    }
}
/*
* 功能：找到Main composite
* 输入参数：语法树单元program
* 输出：返回 Main Composite
*/
SemCheck.findMainComposite = function(program){
    var isMain = (node) => node instanceof compositeNode && node.compName == "Main" ;
    var main_composites = program.filter(node => isMain(node))
    if (main_composites.length != 1){
        throw new Error("the program should have one && more than one composite entrance")
    }
    return main_composites[0]
}