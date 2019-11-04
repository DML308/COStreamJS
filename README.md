# COStreamJS
![](https://travis-ci.org/DML308/COStreamJS.svg?branch=master)
![](https://img.shields.io/npm/v/costreamjs)

COStream 工具在动态弱类型语言 js 上的部署, 目的是代码模块化 ; 易读 ; 易测试

# 使用方法
- 浏览器版本: 可参考 [http://demo.costream.org](http://demo.costream.org)
```html
<!-- example.html -->
<script src="https://demo.costream.org/COStreamJS.js"></script>
<script>
    COStreamJS.parser.parse(`int i= 1*2+3;`)
    COStreamJS.main(`...`) // ...处需填入数据流程序
</script>
```
- node 版本: `npm install -g costreamjs`
, 然后在命令行执行`costreamjs -h`即可查看操作指南
>例子命令: `costreamjs ./example/pipeline.cos -j4 -o ./dist/`


# 开发方法
`git clone`后执行`npm install`或`cnpm install`或`yarn`
然后依次执行下列指令
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