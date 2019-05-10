interface YYLTYPE {
    first_line: number,
    last_line:number,
    first_column:number,
    last_column:number
}
interface Node{
    _type : string,
    _source: string,
    _loc: YYLTYPE
}
interface expNode {
    
}
interface unaryNode{
    op : string,
    exp : expNode
}