/**
 * 深拷贝一个数据结构, 包括其原型链, 但以下滑线_开头的属性名浅拷贝, 例如 _symbol_table
 */
export function deepCloneWithoutCircle(node) {
    let hasVisitedNode = new WeakMap()
    return deepClone(node)

    function deepClone(node) {
        if (hasVisitedNode.has(node)) {
            console.error("深拷贝出现循环引用错误,请检查:",node)
        } else {
            if (['number', 'boolean', 'string', 'undefined'].includes(typeof node) || node === null) {
                return node
            } else {
                hasVisitedNode.set(node, true)
                let obj = new node.constructor()
                Object.keys(node).forEach(key => {
                    if(key.startsWith('_')){
                        obj[key] = node[key]
                    }else{
                        obj[key] = deepClone(node[key])
                    }
                })
                return obj
            }
        }
    }
}