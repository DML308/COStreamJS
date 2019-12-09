import { ast2String } from "../../src/ast/toString.js"
require('../../main.js')
const assert = require("assert")
const fs = require('fs')
const resolve = require('path').resolve

import COStreamJS from "../../main"
COStreamJS.options.platform = 'default'
const parser = COStreamJS.parser

//最小化字符串,用于后续的字符串比较
function minifyStr(str){
    return str.replace(/\s+/g,'')
}

describe("测试各种 node 的 toString 方法",()=>{
    var declareNodeStrings = [
        "long long a[3] = {1,2,3};",
        "double x[];",
        "string x[][20] = {3,4,5};",
        "int x= 1,y=2,c=3,d=34;"
    ]
    declareNodeStrings.forEach(str=>{
        it(`declareNode : ${str}`, () => {
            var ast = parser.parse(str)
            assert(minifyStr(ast2String(ast)) === minifyStr(str))
        })
    })
    
    var compositeNodeStrings = [`composite B(input stream<int x>In,output stream<int x>Out)
{
	param
		int size1,int size2;
	Out = B(In)
	{
		work
		{
			int i,j;
			Out[0].x = In[0].x;
			for(i = 0;i < 10000;i++){
				j = i * i;
			}
		}
		window{
			In  sliding(1,1);
			Out tumbling(1);
		}
	};
}`, `composite Main(){
	int N =99;
	stream<int x,double y>S,P;
	S=Source(){
		int i;
		init{
			i=0;
            if(1) { println(1); }
		}
		work{
			for(i = 0;i < 8;i++){
				S[i].x=aaa[i];
			}
		}
		window{
			S tumbling(8);
		}
	};
	P = B(S)(88,99);
	Sink(P){
		work{
			println(P[0].x);
		}
		window{
			P tumbling(1);
		}
	};
}`]
    compositeNodeStrings.forEach(str => {
        it(`compositeNode : ${str.split('\n')[0]}`, () => {
            var ast = parser.parse(str)
            var str1 = ast.toString()
            var str2 = parser.parse(str1).toString()
            assert(minifyStr(str1) === minifyStr(str2))
        })
    })
    var files = ["wang.cos"]
    files.forEach(file => {
        it(`使用文件测试: ${file}`, () => {
            var str = fs.readFileSync(resolve(__dirname, `../../examples/${file}`), "utf8")
            var ast = parser.parse(str)
            var str1 = ast2String(ast)
            var str2 = ast2String(parser.parse(str1))
            assert(minifyStr(str1) === minifyStr(str2))
        })
    })
})