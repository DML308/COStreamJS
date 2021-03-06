# COStreamJS
[![Build Status](https://travis-ci.com/DML308/COStreamJS.svg?branch=master)](https://travis-ci.com/DML308/COStreamJS)
![](https://img.shields.io/npm/v/costreamjs)

COStream 工具在动态弱类型语言 js 上的部署, 目的是代码模块化 ; 易读 ; 易测试

# 对实验室其它同学傻瓜式指南:
1. 首先在`ubuntu`安装`node`执行环境
```bash
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.6/install.sh | bash
nvm install --lts
```
2. 接着clone项目并编译执行例子程序`wang.cos`
```
git clone https://github.com/DML308/COStreamJS.git
cd COStreamJS
npm install
npm run build
node dist/costream-cli.js example/wang.cos -j4
cd dist/wang
make
./a.out
```

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
`node.js` 12 以上

# DEMO   试玩地址  [https://demo.costream.org](https://demo.costream.org)
![](https://i.loli.net/2019/06/14/5d035b1d14ce759801.gif)