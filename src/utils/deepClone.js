/**
 * 深拷贝一个数据结构, 包括其原型链
 */
export function deepCloneWithoutCircle(node) {
    let hasVisitedNode = new WeakMap()
    return deepClone(node)

    function deepClone(node) {
        if (hasVisitedNode.has(node)) {
            console.error("深拷贝出现递归错误,请检查:",node)
        } else {
            if (['number', 'boolean', 'string', 'undefined'].includes(typeof node) || node === null) {
                return node
            } else {
                hasVisitedNode.set(node, true)
                let proto = Object.getPrototypeOf(node)
                let obj = Object.create(proto)
                Object.keys(node).forEach(key => {
                    obj[key] = deepClone(node[key])
                })
                return obj
            }
        }
    }
}