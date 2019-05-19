const defaultDescriptor = {
    configurable: true,
    enumerable: false,
    value: undefined,
    writable: true
}
/**
* 定义 target 的 key 属性为私有属性, 例如 一个 node 的 this._source 和 this._loc
*/
export function definePrivate(target, key) {
    var descriptor = Object.getOwnPropertyDescriptor(target, key) || defaultDescriptor
    descriptor.enumerable = false
    Object.defineProperty(target, key, descriptor)
}

/**
 * 输入一段带有'{' '}'的字符串,然后按照层级在\n 的后面添加空格, 来美化输出
 */
String.prototype.beautify = function (space_num = 2) {
    var space = (x) => Array(x).fill(' ').join('')
    var stage = 0, result = ''
    var str = this.replace(/\{(?![ \t]*\n)/g, '{\n') // 在 { 右侧添加换行符
    str = str.replace(/(?<!\n[ \t]*)\}/g, '\n\}').replace(/\}(?![ \t;]*\n)/g, '}\n') // 在 } 的左右两侧都添加换行符,除非右侧已经有换行符或者右侧有个紧挨着的';'(全局 declareNode 的特例)
    var stmts = str.split('\n').map(x => x.trim())
    for (var s of stmts) {
        if (/\}/.test(s)) stage--
        result += space(stage * space_num) + s + '\n'
        if (/\{$/.test(s)) stage++
    }
    return result
}