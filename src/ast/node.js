import { definePrivate } from "../utils/js-hacker"

/**
 * @interface Node
 */
class Node {
    constructor(loc){
        this._loc = loc
        ['_source','_loc',"_type"].forEach(key=>{
            definePrivate(this,key)
        })
    }
}
class ExpNode extends Node{
    constructor(loc){
        super(loc)
    }
}
/**
 * @interface  unaryNode 
 */
class unaryNode extends ExpNode{
    constructor(op,exp,loc){
        super(loc)
        this.op = op
        this.exp = exp
    }
};