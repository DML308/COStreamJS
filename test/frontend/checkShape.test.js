import { checkSliceShape } from "../../src/FrontEnd/checkShape"
const assert = require('assert')
const fs = require("fs")
const resolve = require('path').resolve

if(!Number.prototype.value){
    Object.defineProperty(String.prototype,'value',{
        get(){
            if(!Number.isNaN(parseFloat(this))){
                return parseFloat(this); // 如果这个字符串本身就是一个数字, 则直接返回, 例如'0;
            }
            return top.LookupIdentifySymbol(this).value; 
        }
    })
    Object.defineProperty(Number.prototype,'value',{
        get(){
            return this
        }
    })
}


describe("测试 checkShape 机制", ()=>{
    it("checkSliceShape S[i,j]", ()=>{
        var shape = checkSliceShape([2,2], { 
            slice_pair_list: [
                {start:'i'},
                {start:'j'}
            ]})
        assert(shape.join() === '1,1')
    })  
    it("checkSliceShape S[i,:]", ()=>{
        var shape = checkSliceShape([10,10], { 
            slice_pair_list: [
                {start:'i'},
                {op:':'}
            ]})
            console.log(shape.join())
        assert(shape.join() === '1,10')
    })  
    it("checkSliceShape S[1:3,4:9]", ()=>{
        var shape = checkSliceShape([10,10], { 
            slice_pair_list: [
                {start:'1',op:':',end:'3'},
                {start:4,op:':',end: 9}
            ]})
            console.log(shape.join())
        assert(shape.join() === '2,5')
    })  
})