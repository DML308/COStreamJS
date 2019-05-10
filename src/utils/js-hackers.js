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
