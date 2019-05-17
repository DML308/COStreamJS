import { definePrivate } from '../src/ast/js-hacker.js'
const assert = require('assert')

describe("utils/js-hackers definePrivate - 为target定义私有属性(不可枚举)",()=>{
    it("为{ _type : 'test' } 设置 '_type' 私有属性",()=>{
        var obj = { _type :'test'}
        assert(Object.keys(obj).indexOf('_type') !== -1)
        definePrivate(obj,'_type')
        assert(Object.keys(obj).indexOf('_type') === -1)
    })
    it("为对象设置新的私有属性时的边界处理",()=>{
        var obj = { }
        definePrivate(obj, '_type')
        assert(obj.hasOwnProperty('_type') && Object.keys(obj).indexOf('_type') === -1)
    })
})


describe("utils/js-hackers beautify - 让 String 变得好看", () => {
    it("beautify 行数", () => {
        var uglyStr = "composite Main(){ operator(){init{int i=0} work{ i=2} window{ S tumbling(1)} }"
        var lines = uglyStr.beautify().split('\n').filter(x=>/\S+/.test(x))
        assert(lines.length == 12)
    })
})