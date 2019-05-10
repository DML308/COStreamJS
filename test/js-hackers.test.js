import { definePrivate } from '../src/utils/js-hackers'
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