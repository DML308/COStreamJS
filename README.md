# COStreamJS
![](https://travis-ci.org/DML308/COStreamJS.svg?branch=master)

COStream 工具在动态弱类型语言 js 上的部署, 目的是代码模块化 ; 易读 ; 易测试
# 使用方法
`git clone`后执行`npm install`或`cnpm install`或`yarn`
依次执行下列指令
1. `npm run dev` 把 js 文件打包至`dist/global.js` , 该文件会自动热更新
1. `npm run bison` 使用`jison`工具来生成语法分析器至`dist/parser.js`, **每次修改`src/config/parser.jison`后都要执行该命令**
1. `simple-server` 然后访问`localhost:3000/dist`, 在 Chrome 控制台中输入
`parser.parse('int i = 1+2')`
即可拿到生成的语法树

# 环境依赖
`node.js` 10 以上

# 进度
代码生成完成, 还未测试 & 调 bug

# DEMO   试玩地址  [https://demo.costream.org](https://demo.costream.org)
![](https://i.loli.net/2019/06/14/5d035b1d14ce759801.gif)