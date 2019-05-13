import { error } from "./color.js";

/**
 * 合并两个 YYLTYPE 类型的位置信息, 取前者的 first_line,first_column,取后者的 last_line,last_column
 */
export function mergeLoc(first,last){
    if(! first.first_line || !last.last_line){
        error("[mergeLoc]: loc 合并出错,输入参数为:",first,last)
    }
    return {
        first_line:first.first_line,
        first_column:first.first_column,
        last_line:last.last_line,
        last_column:last.last_column
    }
}