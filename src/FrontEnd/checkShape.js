import { binopNode, expNode } from "../ast/node"
import { error } from "../utils"
import { top } from "./global"
import { ternaryNode } from "../ast/node";
import { matrix_section, callNode } from "../ast/node";
import { matrix_constant } from "../ast/node";
import { BUILTIN_FUNCTIONS, BUILTIN_MATRIX_FUNCTIONS, BUILTIN_FUNCTIONS_ARG, getMostNearName, BUILTIN_MATRIX_FUNCTIONS_ARG } from "./built-in-function";
import { constantNode } from "../ast/node";
import { parenNode } from "../ast/node";

let lastLoc  = 0; //标记最近检查中处理到的最后一个行号,用于识别只有一个string的场景, 由于string类型无法得知自己的行号,因此需要从外部记忆

/** 该文件的函数同时执行两项工作: 对被操作数据的 shape 进行校验, 并将计算后的结果的 shape 缓存下来 */
export function checkShape(/** @type {Node | string} */stmt, _loc){
    lastLoc = _loc || stmt._loc
    if(Array.isArray(stmt)){
        const itemShape = checkShape(stmt[0])
        return [stmt.length].concat(itemShape == "1,1" ? 1 : itemShape)
    }else if(stmt instanceof binopNode){
        return checkBinopShape(stmt)//二元节点
    }else if(stmt instanceof ternaryNode){
        return checkTernaryNode(stmt)//三元节点
    }else{
        return checkUnaryShape(stmt) //一元节点
    }
}
function checkBinopShape(/** @type {binopNode} */stmt){
    if(stmt.op === '.'){
        return checkDotShape(stmt);
    }
    if(stmt.op === '='){ // A = m 或 S[0].x = 1
        return checkAssignmentShape(stmt.left, stmt.right)
    }else if(['+','-','/','%','|','&','^','<','>','<=','==','>=','<<=','>>=','!='].includes(stmt.op)){
        const lshape = checkShape(stmt.left), rshape = checkShape(stmt.right)
        return checkEqualShape(lshape,rshape,stmt._loc)
    }else if(stmt.op.length === 2 && stmt.op.right == '='){ // += -= *= /= %= 的情况
        return checkAssignmentShape(stmt.left,checkEqualShape(lshape,rshape,stmt._loc))
    }else if(stmt.op === '*'){
        return checkMultiShape(stmt)
    }
    debugger;
    return lshape
}
function checkMultiShape(/** @type {binopNode} */stmt){
    const lshape = checkShape(stmt.left), rshape = checkShape(stmt.right)
    if(lshape == "1,1") return rshape
    if(rshape == "1,1") return lshape
    if(lshape.length == 2 && rshape.length == 2 && lshape[1] == rshape[0]){
        return [lshape[0], rshape[1]]
    }else{
        throw new Error(error(stmt._loc,`乘法类型检查出错,左侧shape为${lshape}右侧shape为${rshape}`))
    }
}
function checkDotShape(/** @type {binopNode} */stmt){
    // S[0].x的情况
    debugger;
    if(stmt.left instanceof matrix_section && typeof stmt.right === "string"){
        const result = top.searchName(stmt.left.exp)
        // 数据流 S[0].x的情况
        if(result && result.type === 'stream'){
            const id_list = result.origin.streamTable[stmt.left.exp].strType.id_list
            const member = id_list.find(record => record.identifier === stmt.right)
            debugger;
            if(!member){
                throw new Error(error(stmt._loc,`数据流${stmt.left.exp}上不存在成员${stmt.right}`));
            }
            if(member.type !== 'Matrix'){
                return [1,1]
            }else{
                return member.shape || undefined
            }
        }
        if(!result || result.type !== 'stream'){
            error(stmt._loc,`在符号表中找不到流${stmt.left.exp}`)
        } 
        
    }else{
        debugger;
    }
}
/**
 * @returns {Array<{type:string,identifier:string,shape?:[1,1]}>} 
 */
function checkUnaryShape(/** @type {Node} */stmt){
    if(stmt instanceof matrix_section){
        const result = top.searchName(stmt.exp)
        if(!result) throw new Error(error(stmt._loc,`找不到变量名${stmt.exp}在符号表中的定义`))
        const { type, origin } = result
        if(type === "stream"){
            origin.streamTable[stmt.exp].strType.id_list
        }else if(type === "variable"){
            return checkSliceShape(origin.variableTable[stmt.exp].shape, stmt)
        }else{
            throw new Error("暂未支持stream以外的top searchName type")
        }
    }else if(stmt instanceof matrix_constant){
        return stmt.shape
    }else if(typeof stmt === 'string'){
        const result = top.searchName(stmt)
        if(!result) throw new Error(error(lastLoc,`找不到变量名${stmt}在符号表中的定义`))
        const { type, origin } = result
        if(type === "variable"){
            return origin.variableTable[stmt].shape
        }else if(type === "member"){
            return origin.memberTable[stmt].shape
        }else{
            throw new Error(error(lastLoc,`获取符号表中${stmt}的shape出错`))
        }
    }else if(stmt instanceof callNode){
        return checkCallNodeShape(stmt)
    }else if(stmt instanceof parenNode){
        return checkShape(stmt.exp)
    }else if(stmt instanceof constantNode){
        return [1,1] //常数节点
    }else{
        debugger
        console.warn("返回了一个shape [1,1]", stmt)
        return [1,1]
    }
}
function checkCallNodeShape(/** @type {callNode} */node){
    if(typeof node.name === "string"){ //若为直接执行一个函数, 一般为数学函数
        if(BUILTIN_FUNCTIONS.includes(node.name)){
            const wanted_args = BUILTIN_FUNCTIONS_ARG[node.name].length
            if(wanted_args !== 'any' && wanted_args !== node.arg_list.length){
                const hint = BUILTIN_FUNCTIONS_ARG[node.name].hint
                throw new Error(error(stmt._loc, `调用函数${node.name}传参数量错误,当前传参为${node.arg_list},期待传参为${hint}`)) 
            }
            return [1,1] //全部检查通过, 因此该数学计算得到的值的结果是个数字, 返回数字的shape [1,1]
        }
        else{
            const msg = `你是否想使用函数 ${getMostNearName(BUILTIN_FUNCTIONS,node.name)} ?`
            throw new Error(error(stmt._loc, `不支持的函数调用 ${node.name},${msg} `))
        }
    }
    else if(node.name instanceof binopNode){
        const lshape = checkShape(node.name.left), funcName = node.name.right
        debugger;
        if(typeof funcName === 'string' && BUILTIN_MATRIX_FUNCTIONS.includes(funcName)){
            const wanted_args = BUILTIN_MATRIX_FUNCTIONS_ARG[funcName].length
            if(wanted_args !== 'any' && wanted_args !== node.arg_list.length){
                const hint = BUILTIN_MATRIX_FUNCTIONS_ARG[funcName].hint
                throw new Error(error(stmt._loc, `调用矩阵函数${funcName}传参数量错误,当前传参为(${node.arg_list}),提示: ${hint}`)) 
            }
            const returnShape = BUILTIN_MATRIX_FUNCTIONS_ARG[funcName].returnShape
            if(Array.isArray(returnShape)) return returnShape
            else if(typeof returnShape === 'function'){
                return returnShape(lshape,node.arg_list,node._loc)
            }
        }else{
            const mostNearName = getMostNearName(BUILTIN_MATRIX_FUNCTIONS,funcName)
            const msg = `你是否想使用函数 ${mostNearName} ? hint:${BUILTIN_MATRIX_FUNCTIONS_ARG[mostNearName]}`
            throw new Error(error(stmt._loc, `不支持的矩阵函数调用 ${funcName},${msg}`))
        }

    }else{
        throw new Error(error(stmt._loc, `未识别的callNode类型`))
    }
}
/** 
 * 获取右侧矩阵或数组表达式的shape
 * @returns {[number,number]} 
 */
function checkSliceShape(shape, /** @type {matrix_section} */matrix_s){
    const slice_pair_list = matrix_s.slice_pair_list
    //1.简单情况, S[0]直接降维
    if(slice_pair_list.length === 1 && !slice_pair_list[0].op){
        if(slice_pair_list[0].start >= shape[0] || slice_pair_list[0].start < 0) {
            throw new Error(error(matrix_s._loc,`取下标操作非法, 当前值为${slice_pair_list[0].start},该值允许的范围为0:${shape[0]}`))
        }
        const slice_result = shape.slice(1); // [8,2,2]降维后为[2,2], [5,6]降维后得[6,1], [6,1]降维后得[1,1]
        return slice_result.length === 1 ? [slice_result[0],1] : slice_result
    }//2. S[0:1] 或S[0:1,0:10] 切片
    else{
        let resShape = [],i
        for(i=0;i<slice_pair_list.length;i++){
            let start = (slice_pair_list[i].start || 0).value
            let end = (slice_pair_list[i].end || shape[i]).value
            if(start < 0) throw new Error(error(matrix_s._loc,`切片操作第${i}维的起始坐标不能小于0`))
            if(end > shape[i]) throw new Error(error(matrix_s._loc,`切片操作的第${i}维终止坐标不能大于最大值${shape[i]},当前为${end}`))
            resShape[i] = end - start
        }
        // 考虑对[5,6]矩阵取S[0:1]的情况,需保留尾部
        if(i<shape.length){
            resShape = resShape.concat(shape.slice(i))
        }
        return resShape
    }
}
function checkTernaryNode(/** @type {ternaryNode} */stmt){

}
function checkAssignmentShape(left,right){
    // x = 1 的情况
    if(typeof left === 'string'){
        const rshape = checkShape(right)
        const result = top.searchName(left)
        if(!result){
            throw new Error(error(right._loc,`在符号表中找不到变量名${left}`));
        }else if(result.type === 'member'){
            // member成员只支持非矩阵数据
            if(rshape.join('') !== '11'){
                throw new Error(error(right._loc,`oper的成员${left}不支持赋值为${rshape.join('x')}大小的矩阵`));
            }
            return [1,1]
        }else if(result.type === 'variable'){
            const originVariable = result.origin.variableTable[left]
            if(originVariable.shape.join() !== rshape.join()){
                throw new Error(error(right._loc,`赋值语句左右两侧的shape不符,左侧为${originVariable.shape}右侧为${rshape}`));
            }
            return rshape; // 赋值表达式的shape检查通过, 返回该shape
        }else{
            throw new Error(error(right._loc,`该字段${left}不支持赋值`));
        }
    }else if(left instanceof matrix_section){
        if(typeof left.exp === 'string'){
            const result = top.searchName(left.exp)
            if(result){
                // 少见的一种情况, S[0] = In[0] 用于数据流的拷贝
                if(result.type === 'stream' && right instanceof matrix_constant){
                    if(typeof right.exp === 'string'){
                        const right_result = top.searchName(right.exp)
                        if(right_result && right_result.type === 'stream'){
                            return [1,1] // 两侧均为数据流, 检查通过. 返回一个无意义的[1,1]
                        }
                    }else{
                        throw new Error(error(left._loc,`该行操作不合法`));
                    }
                }else if(result.type === "member"){
                    // this.coeff[0][1] = 1 的情况
                    const lshape = result.origin.memberTable[left.exp].shape
                    return checkEqualShape(lshape, checkShape(right))
                }else if(result.type === "variable"){
                    // A[0] = 1 的情况
                    const lshape = result.origin.variableTable[left.exp].shape
                    return checkEqualShape(lshape, checkShape(right))
                }
                throw new Error(error(left._loc,`该行操作不合法`));
            }else{
                throw new Error(error(_loc,`在符号表中找不到流${left.exp}`))
            }
            
        }
        else{
            // S[0].x[0,0] = 1 的情况
            throw new Error(error(left._loc,`暂未支持该左操作数格式${left}`));
        }
        
    }else if(left instanceof binopNode && left.op == '.' && left.left instanceof matrix_section && typeof left.right ==='string'){
        // S[0].x = 1 的情况
        const matrix_s = left.left , _loc = left._loc
        const result = top.searchName(matrix_s.exp)
        if(result && result.type === 'stream'){
            const id_list = result.origin.streamTable[matrix_s.exp].strType.id_list
            const member = id_list.find(record => record.identifier === left.right)
            if(!member){
                throw new Error(error(_loc,`数据流${matrix_s.exp}上不存在成员${left.right}`));
            }
            const rshape = checkShape(right)
            if(member.type !== 'Matrix'){
                if(rshape.join('')!=='11') throw new Error(error(_loc,`不能给shape为1,1的值赋值新shape ${rshape}`));
                return [1,1]
            }else{
                if(!member.shape){
                    return member.shape = rshape // 若该数据流的该字段是矩阵类型且未定义shape,则为其定义shape
                }else{
                    if(member.shape.join() !== rshape.join()){
                        throw new Error(error(_loc,`不能给shape为${member.shape}的值赋值新shape ${rshape}`));
                    }
                    return member.shape // 若该数据流的该字段是矩阵类型且校验通过,则返回该shape
                }
            }
        }else{
            throw new Error(error(_loc,`在符号表中找不到流${matrix_s.exp}`))
        }
    }
    throw new Error(error(right._loc," = 左侧的表达式不支持赋值"))
}
function checkEqualShape(/** @type {[number,number]} */lshape,/** @type {[number,number]} */rshape,_loc){
    if(lshape[0] === rshape[0] && lshape[1] === rshape[1]){
        return lshape //检测左右两侧的shape相同,通过检查
    }else if(lshape.join('') !== '11' && rshape.join('') == '11'){
        return lshape //矩阵和常数的加法,例如A+1
    }else if(lshape.join('') === '11' && rshape.join('') !== '11'){
        return rshape //常数和矩阵的加法,例如1+A
    }
    throw new Error(error(_loc, `左右操作数的shape未通过校验,左侧为${lshape},右侧为${rshape}`))
}