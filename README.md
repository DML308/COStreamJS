# COStreamJS
COStream 工具在动态弱类型语言 js 上的部署, 目的是代码模块化 ; 易读 ; 易测试
# 使用方法
`git clone`后执行`npm install`或`cnpm install`或`yarn`
依次执行下列指令
1. `npm run dev` 把 js 文件打包至`dist/global.js` , 该文件会自动热更新
1. `npm run bison` 使用`jison`工具来生成语法分析器至`dist/parser.js`, **每次修改`src/config/parser.jison`后都要执行该命令**
1. `simple-server` 然后访问`localhost:3000/dist`查看效果

# 环境依赖
`node.js` 10 以上
