export interface YYLTYPE {
    first_line: number
    last_line: number
    first_column: number
    last_column: number
}

export class Node {
    _type: string
    _source: string
    _loc: YYLTYPE
}