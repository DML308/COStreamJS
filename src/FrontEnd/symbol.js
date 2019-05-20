import { compositeNode } from "../ast/node";

export class SymbolTable{
    constructor(program){
        this.compTable = new Map()
        program.filter(node=> node instanceof compositeNode).forEach(node=>{
            this.compTable.set(node.compName,node)
        })
    }
    LookUpCompositeSymbol(name){
        return this.compTable.get(name)
    }
}