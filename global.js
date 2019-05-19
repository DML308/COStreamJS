(function () {
    'use strict';

    function debug(...args) {
        console.log("%c " + args[0], "color: #0598bd", ...args.slice(1));
    }
    function green(...args) {
        console.log("%c " + args[0], "color: #00bc00", ...args.slice(1));
    }
    function line(...args) {
        const line = args[0].first_line || args[0];
        console.log(`%c line:${line} %c ${args[1]} `, "color: #00bc00", "color: #0598bd", ...args.slice(2));
    }
    function error(...args) {
        console.log("%c " + args[0], "color: #cd3131", ...args.slice(1));
    }

    /**
     * 输入一个 object 返回 graphviz 工具能识别的 dot 字符串
     */
    function ast2dot(node){
        ast2dot.count = 0;
        var header = `digraph { \n    node [shape = record];\n`;
        var body = '';
        dumpdot(node);
        //应 dot 文件格式的要求, 对中间部分的 [] {} "" < > |这些特殊符号进行转义
        body = body.replace(/\[(?!label|shape)/g, "\\[").replace(/](?!;)/g, "\\]");
        body = body.replace(/(\{|\})/g, "\\$1");
        body = body.replace(/(?<!\[label = )\"(?!];)/g,`\\"`);
        body = body.replace(/<(?!\d+>)/g,"\\<").replace(/(?<!<\d+|-)>/g,"\\>");
        body = body.replace(/\|(?!<)/g,"\\|");
        header += body + `}`;
        return header 

        function dumpdot(node){ 
            //下面这个 if 大部分情况都走第二个分支
            //第一个分支是为了 Program 语法树的根节点(可能有不同类型的孩子,例如 declaration,function,composite)
            if(node instanceof Array){
                if(node.length>0){
                    var types = [...new Set(node.map(x=>x.constructor.name))].join(" or ");
                    body += `    ${ast2dot.count} [label = "[${node.length} ${types}]"];\n`;
                    var nThis = ast2dot.count++;
                    var tag = 0;
                    for(var i of Object.keys(node)){
                        var nChild = dumpdot(node[i]);
                        body += `    ${nThis}:${tag++} -> ${nChild}\n`;
                    }
                }else{
                    return ast2dot.count++
                }
            }else{
                //生成一个dot 文件中的行
                var nThis = newNode(node);
                //遍历它的孩子将 nThis 和 nChild 进行连线
                var tag = 0;
                for (var i of Object.keys(node)) {
                    if (node[i] === undefined) continue
                    if (node[i] instanceof Array) {
                        node[i].forEach((child) => {
                            var nChild = dumpdot(child);
                            body += `    ${nThis}:${tag} -> ${nChild}\n`;
                        });
                        tag++;
                    } else if (node[i] instanceof Object) {
                        var nChild = dumpdot(node[i]);
                        body += `    ${nThis}:${tag++} -> ${nChild}\n`;
                    } else {
                        tag++;
                    }
                }
            }
            return nThis
        }
        /**
         * 输入 node 为 object 或 string ,创建一行格式为 
         * 6 [label="<1> int |<2> 2"] 的 dot 字符串
         * 返回该节点的序号, 例如6
         */
        function newNode(node){
            var line = `    ${ast2dot.count} [label = "`;
            if(typeof node === 'string'){
                line += node;
                body += line + '"];\n';
                return ast2dot.count++
            }
            var first = true;
            var tag = 0;
            var keys = Object.keys(node);
            for(var i of keys){
                if(node[i] === undefined) continue
                line+= first ? '' : " |";
                first = false;
                line += `<${tag++}> `;
                if(typeof node[i] == 'number'){
                    line+= node[i];
                }else if(typeof node[i] == 'string'){
                    line+= node[i];
                }else if (node[i] instanceof Array) {
                    var types = [...new Set(node[i].map(x => x.constructor.name))];
                    if(types.length>=3) types= types.slice(0,2).concat("other");
                    types = types.join(" or ");
                    if (node[i].length > 0) line += `[${node[i].length} ${types}]`; 
                    else line += `[ ]`;
                }else{
                    line+= ' ';
                }
            }
            line += `"];\n`;
            body += line;
            return ast2dot.count++
        }
    }



    var utils = /*#__PURE__*/Object.freeze({
        debug: debug,
        line: line,
        error: error,
        green: green,
        ast2dot: ast2dot
    });

    const defaultDescriptor = {
        configurable: true,
        enumerable: false,
        value: undefined,
        writable: true
    };
    /**
    * 定义 target 的 key 属性为私有属性, 例如 一个 node 的 this._source 和 this._loc
    */
    function definePrivate(target, key) {
        var descriptor = Object.getOwnPropertyDescriptor(target, key) || defaultDescriptor;
        descriptor.enumerable = false;
        Object.defineProperty(target, key, descriptor);
    }

    /**
     * 输入一段带有'{' '}'的字符串,然后按照层级在\n 的后面添加空格, 来美化输出
     */
    String.prototype.beautify = function (space_num = 2) {
        var space = (x) => Array(x).fill(' ').join('');
        var stage = 0, result = '';
        var str = this.replace(/\{(?![ \t]*\n)/g, '{\n'); // 在 { 右侧添加换行符
        str = str.replace(/(?<!\n[ \t]*)\}/g, '\n\}').replace(/\}(?![ \t;]*\n)/g, '}\n'); // 在 } 的左右两侧都添加换行符,除非右侧已经有换行符或者右侧有个紧挨着的';'(全局 declareNode 的特例)
        var stmts = str.split('\n').map(x => x.trim());
        for (var s of stmts) {
            if (/\}/.test(s)) stage--;
            result += space(stage * space_num) + s + '\n';
            if (/\{$/.test(s)) stage++;
        }
        return result
    };

    Array.prototype.replace = function (oldValue,newValue){
        var index = this.indexOf(oldValue);
        if(index !== -1){
            this.splice(index,1,newValue);
        }else{
            this.push(newValue);
        }
    };

    class Node {
        constructor(loc) {
            this._loc = loc;
            ['_loc'].forEach(key => {
                definePrivate(this, key);
            });
        }
    }
    /********************************************************/
    /*              1.1 declaration                         */
    /********************************************************/
    class declareNode extends Node {
        constructor(loc, type, init_declarator_list) {
            super(loc);
            this.type = type;
            this.init_declarator_list = [].concat(init_declarator_list);
        }
    }

    class declarator extends Node {
        constructor(loc, identifier, op1, parameter, op2, initializer) {
            super(loc);
            Object.assign(this, {
                identifier,
                op1, parameter,
                op2,
                initializer
            });
        }
    }
    /********************************************************/
    /*              1.2 function.definition 函数声明          */
    /********************************************************/
    class function_definition extends Node {
        constructor(loc, type, declarator, compound) {
            super(loc);
            this.type = type;
            this.name = declarator.identifier;
            this.op1 = '(';
            this.param_list = declarator.parameter;
            this.op2 = ')';
            this.funcBody = compound;
        }
    }
    class parameter_declaration extends Node {
        constructor(loc, type, declarator) {
            super(loc);
            this.type = type;
            this.declarator = declarator;
        }
    }
    /********************************************************/
    /*        2. composite                                  */
    /********************************************************/
    class compositeNode extends Node {
        constructor(loc, head, body) {
            super(loc);
            Object.assign(this, {
                op: 'composite',
                compName: head.compName,
                inout: head.inout,
                body
            });
        }
    }
    class compHeadNode extends Node {
        constructor(loc, compName, inout) {
            super(loc);
            Object.assign(this, { op: 'composite', compName, inout });
        }
    }
    class ComInOutNode extends Node {
        constructor(loc, input_list, output_list) {
            super(loc);
            Object.assign(this, { op1: 'input', input_list, op2: 'output', output_list });
        }
    }
    class inOutdeclNode extends Node {
        constructor(loc, type, id) {
            super(loc);
            Object.assign(this, { type, id });
        }
    }
    class compBodyNode extends Node {
        constructor(loc, param, stmt_list) {
            super(loc);
            Object.assign(this, {
                op1: '{',
                param,
                stmt_list,
                op2: '}'
            });
        }
    }
    class paramNode extends Node {
        constructor(loc, param_list) {
            super(loc);
            if (param_list) {
                this.op = 'param';
            }
            this.param_list = param_list;
        }
    }
    class operBodyNode extends Node {
        constructor(loc, stmt_list, init, work, win) {
            super(loc);
            Object.assign(this, {
                stmt_list,
                op1: 'init', init,
                op2: 'work', work,
                op3: 'window', win
            });
        }
    }
    class winStmtNode extends Node {
        constructor(loc, winName, { type, arg_list }) {
            super(loc);
            Object.assign(this, {
                winName,
                type,
                arg_list
            });
        }
    }
    /********************************************************/
    /*        3. statement 花括号内以';'结尾的结构是statement   */
    /********************************************************/
    class blockNode extends Node {
        constructor(loc, op1, stmt_list, op2) {
            super(loc);
            Object.assign(this, { op1, stmt_list, op2 });
        }
    }
    class jump_statement extends Node {
        constructor(loc, op1, op2) {
            super(loc);
            Object.assign(this, { op1, op2 });
        }
    }
    class labeled_statement extends Node {
        constructor(loc, op1, op2, op3, statement) {
            super(loc);
            Object.assign(this, { op1, op2, op3, statement });
        }
    }
    class selection_statement extends Node {
        constructor(loc, op1, op2, exp, op3, statement, op4, else_statement) {
            super(loc);
            Object.assign(this, {
                op1, op2, exp, op3,
                statement, op4, else_statement
            });
        }
    }
    class whileNode extends Node {
        constructor(loc, exp, statement) {
            super(loc);
            Object.assign(this, {
                type: 'while',
                op1: '(',
                exp,
                op2: ')',
                statement
            });
        }
    }
    class doNode extends Node {
        constructor(loc, exp, statement) {
            super(loc);
            Object.assign(this, {
                type: 'do',
                op1: '(',
                statement,
                op2: ')',
                op3: 'while',
                exp
            });
        }
    }
    class forNode extends Node {
        constructor(loc, init, cond, next, statement) {
            super(loc);
            Object.assign(this, {
                type: 'for',
                op1: '(',
                init, cond, next,
                op2: ')',
                statement
            });
        }
    }
    /********************************************************/
    /*        4. expression 计算表达式头节点                   */
    /********************************************************/

    class expNode extends Node {
        constructor(loc) {
            super(loc);
            this._value = NaN;
            definePrivate(this, '_value');
            //检查是否有常量传播插件提供的 getValue 函数
            if (expNode.prototype.getValue) {
                expNode.prototype.getValue.call(this);
            }
        }
    }

    class unaryNode extends expNode {
        constructor(loc, first, second) {
            super(loc);
            Object.assign(this, { first, second });
        }

    }class castNode extends expNode {
        constructor(loc, type, exp) {
            super(loc);
            Object.assign(this, { op1: '(', type, op2: ')', exp });
        }
    }

    class binopNode extends expNode {
        constructor(loc, left, op, right) {
            super(loc);
            Object.assign(this, { left, op, right });
        }
    }

    class ternaryNode extends expNode {
        constructor(loc, first, second, third) {
            super(loc);
            Object.assign(this, { first, op1: '?', second, op2: ':', third });
        }
    }

    class parenNode extends expNode {
        constructor(loc, exp) {
            super(loc);
            Object.assign(this, { op1: '(', exp, op2: ')' });
        }
    }
    class arrayNode extends expNode {
        constructor(loc, exp, arg) {
            super(loc);
            if (exp instanceof arrayNode) {
                this.exp = exp.exp;
                this.arg_list = exp.arg_list.slice().concat(arg);
            } else {
                this.exp = exp;
                this.arg_list = [arg];
            }
        }
    }
    class callNode extends expNode {
        constructor(loc, name, arg_list) {
            super(loc);
            this.name = name;
            this.op1 = '(';
            this.arg_list = arg_list;
            this.op2 = ')';
        }
    }
    class constantNode extends expNode {
        constructor(loc, sourceStr) {
            super(loc);
            //判断这个常量是数字还是字符串
            this.source = sourceStr;
            if (!Number.isNaN(Number(sourceStr))) {
                this._value = Number(sourceStr);
            }
            this._value = sourceStr;
        }
    }
    /********************************************************/
    /* operNode in expression's right                       */
    /********************************************************/
    class operNode extends Node {
        constructor(loc) {
            super(loc);
            definePrivate(this, 'outputs');
        }
    }
    class compositeCallNode extends operNode {
        constructor(loc, compName, inputs, params) {
            super(loc);
            Object.assign(this, {
                compName,
                op1: '(',
                inputs,
                op2: ')'
            });
            if (params) {
                Object.assign(this, {
                    op3: '(',
                    params,
                    op4: ')'
                });
            }
        }
    }
    class operatorNode extends operNode {
        constructor(loc, operName, inputs, operBody) {
            super(loc);
            Object.assign(this, { operName, inputs, operBody });
        }
    }
    class splitjoinNode extends operNode {
        constructor(loc, options) {
            super(loc);
            Object.assign(this, options);
            definePrivate(this, 'replace_composite');
        }
    }
    class pipelineNode extends operNode {
        constructor(loc, options) {
            super(loc);
            Object.assign(this, options);
            definePrivate(this, 'replace_composite');
        }
    }
    class splitNode extends Node {
        constructor(loc, node) {
            super(loc);
            this.name = "split";
            this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin";
            if (node.arg_list) {
                Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' });
            }
        }
    }
    class joinNode extends Node {
        constructor(loc, node) {
            super(loc);
            this.name = "join";
            this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin";
            if (node.arg_list) {
                Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' });
            }
        }
    }
    class duplicateNode extends Node {
        constructor(loc, arg_list) {
            super(loc);
            this.arg_list = arg_list;
        }
    }
    class roundrobinNode extends Node {
        constructor(loc, arg_list) {
            super(loc);
            this.arg_list = arg_list;
        }
    }
    class addNode$1 extends Node {
        constructor(loc, content) {
            super(loc);
            this.name = "add";
            this.content = content;
        }
    }

    var NodeTypes = /*#__PURE__*/Object.freeze({
        Node: Node,
        declareNode: declareNode,
        declarator: declarator,
        function_definition: function_definition,
        parameter_declaration: parameter_declaration,
        compositeNode: compositeNode,
        compHeadNode: compHeadNode,
        ComInOutNode: ComInOutNode,
        inOutdeclNode: inOutdeclNode,
        compBodyNode: compBodyNode,
        paramNode: paramNode,
        operBodyNode: operBodyNode,
        winStmtNode: winStmtNode,
        blockNode: blockNode,
        jump_statement: jump_statement,
        labeled_statement: labeled_statement,
        selection_statement: selection_statement,
        whileNode: whileNode,
        doNode: doNode,
        forNode: forNode,
        expNode: expNode,
        unaryNode: unaryNode,
        castNode: castNode,
        binopNode: binopNode,
        ternaryNode: ternaryNode,
        parenNode: parenNode,
        arrayNode: arrayNode,
        callNode: callNode,
        constantNode: constantNode,
        operNode: operNode,
        compositeCallNode: compositeCallNode,
        operatorNode: operatorNode,
        splitjoinNode: splitjoinNode,
        pipelineNode: pipelineNode,
        splitNode: splitNode,
        joinNode: joinNode,
        duplicateNode: duplicateNode,
        roundrobinNode: roundrobinNode,
        addNode: addNode$1
    });

    /**
     * 加载常量传播插件,加载该插件后,表达式 node 可以计算数值
     */
    function loadCVPPlugin() {

        expNode.prototype.getValue = function(){
            //异步计算 value 值, 为了常量传播保留这个接口
            Object.defineProperty(this, 'value', {
                enumerable: false,
                get: function () {
                    if (!Number.isNaN(this._value)) return Number(this._value)
                    else {
                        return (this.getValue && (this._value = this.getValue()))
                    }
                },
                set: function () {
                    error("请不要手动给 value 赋值. 请给 _value 赋值,然后 value 会基于 _value 计算而来", this);
                }
            });
        };
        ternaryNode.prototype.getValue = function (){
            return this.first.value ? this.second.value : this.third.value
        };
        parenNode.prototype.getValue = function(){
            return this.exp.value
        };
        /**
        * 目前只是简单计算值,后续常量传播时要修改此函数
        */
        unaryNode.prototype.getValue = function () {
            if (this.first == "+") return this.second.value
            if (this.first == "-") return -this.second.value
            if (this.first == "~") return ~this.second.value
            if (this.first == "!") return !this.second.value
            return NaN
        };

        binopNode.prototype.getValue = function () {
            var handlers = {
                '+': (a, b) => a.value + b.value,
                '-': (a, b) => a.value - b.value,
                '*': (a, b) => a.value * b.value,
                '/': (a, b) => a.value / b.value,
                '%': (a, b) => a.value % b.value,
                '|': (a, b) => a.value | b.value,
                '&': (a, b) => a.value & b.value,
                '^': (a, b) => a.value ^ b.value,
                '==': (a, b) => a.value == b.value,
                '!=': (a, b) => a.value != b.value,
                '<=': (a, b) => a.value <= b.value,
                '>=': (a, b) => a.value >= b.value,
                '>>': (a, b) => a.value >> b.value,
                '<<': (a, b) => a.value << b.value,
                //c++ 与 js 不同, c++的条件表达式返回 bool 值,而 js 是动态值
                '||': (a, b) => !!(a.value || b.value),
                '&&': (a, b) => !!(a.value && b.value),
            };
            if (this.op in handlers) {
                return this._value = handlers[this.op](this.left, this.right)
            }
            else {
                return NaN
            }
        };
        
        arrayNode.prototype.getValue = function(){
            return NaN
        };
        callNode.prototype.getValue = function(){
            return NaN
        };
    }

    function ast2String(root) {
        var result = '';
        root.forEach((x, idx) => {
            result += x.toString() + (x instanceof declareNode ? ';' : '') + '\n';
        });
        return result.replace(/ {2,}/g, ' ').beautify()
    }
    /**
     * 输入一个 list 返回它转化后的 string, 可以配置分隔符 split 例如','
     * 也可以配置 start 和 end 例如'{' '}'
     */
    function list2String(list, split, start, end) {
        if (!list || list.length == 0) return ''
        var str = start ? start : '';
        list.forEach((x, idx) => {
            str += x.toString();
            str += split && idx < list.length - 1 ? split : '';
        });
        return end ? str + end : str
    }

    /**
    * 加载toString插件,加载该插件后, statement 类型的节点可以执行 toString 用于代码生成或调试
    */
    function loadToStringPlugin() {
        declarator.prototype.toString = function () {
            var str = this.identifier.toString() + ' ';
            str += this.op1 ? this.op1 : '';
            str += this.parameter ? this.parameter.toString() : '';
            str += this.op2 ? this.op2 : '';
            if (this.initializer instanceof Array) {
                str += list2String(this.initializer, ',', '{', '}');
            } else {
                str += this.initializer ? this.initializer.toString() : '';
            }
            return str
        };
        declareNode.prototype.toString = function () {
            return this.type + ' ' + list2String(this.init_declarator_list, ',')
        };
        compositeNode.prototype.toString = function () {
            var str = 'composite ' + this.compName + '(';
            str += this.inout ? this.inout.toString() : '';
            str += ')' + this.body.toString();
            return str
        };
        ComInOutNode.prototype.toString = function () {
            return 'input ' + list2String(this.input_list) + ', output ' + list2String(this.output_list)
        };
        inOutdeclNode.prototype.toString = function () {
            return this.type.toString() + this.id
        };
        compBodyNode.prototype.toString = function () {
            var str = '{\n';
            str += this.param ? this.param.toString() : '';
            str += list2String(this.stmt_list, ';\n') + ';\n}\n';
            return str
        };
        paramNode.prototype.toString = function () {
            return 'param\n  ' + list2String(this.param_list, ',')+';\n'
        };
        parameter_declaration.prototype.toString = function () {
            return this.type + ' ' + this.declarator.toString()
        };
        //将每一行 statement 的';'上提至 blockNode 处理
        blockNode.prototype.toString = function () {
            var str = '{\n';
            str += list2String(this.stmt_list, ';\n')+';\n';
            return str + '}\n'
        };
        jump_statement.prototype.toString = function () {
            var str = this.op1 + ' ';
            str += this.op2 ? this.op2 + ' ' : '';
            return str
        };
        labeled_statement.prototype.toString = function () {
            var str = this.op1 + ' ';
            str += this.op2 ? this.op2 : '';
            return str + ' ' + this.op3 + this.statement.toString()
        };
        //expNode 的子类
        binopNode.prototype.toString = function () {
            return this.left + this.op + this.right
        };
        arrayNode.prototype.toString = function () {
            return '' + this.exp + list2String(this.arg_list, '][', '[', ']')
        };
        constantNode.prototype.toString = function () {
            return this.value
        };
        castNode.prototype.toString = function(){
            return '('+this.type+')'+this.exp
        };
        parenNode.prototype.toString = function(){
            return '('+this.exp+')'
        };
        unaryNode.prototype.toString = function () {
            return '' + this.first + this.second
        };
        operatorNode.prototype.toString = function () {
            var str =  this.operName + '('; 
            str+= this.inputs ? this.inputs :'';
            return str + ')' + this.operBody 
        };
        operBodyNode.prototype.toString = function () {
            var str = '{\n'; 
            str += this.stmt_list ? list2String(this.stmt_list, ';\n')+';\n' :'';
            str += this.init ? 'init' + this.init : '';
            str += this.work ? 'work' + this.work : '';
            str += this.win ? 'window{' + list2String(this.win,';\n')+';\n'+'}' : '';
            return str + '\n}\n'
        };
        winStmtNode.prototype.toString = function(){
            return this.winName+' '+this.type+'('+list2String(this.arg_list,',')+')'
        };
        forNode.prototype.toString = function () {
            var str = 'for(';
            str += this.init ? this.init.toString() + ';' : ';';
            str += this.cond ? this.cond.toString() + ';' : ';';
            str += this.next ? this.next.toString() : '';
            str += ')' + this.statement.toString();
            return str
        };
        selection_statement.prototype.toString = function(){
            if(this.op1 === 'if'){
                var str =  'if('+this.exp+')'+this.statement;
                str += this.op4 === 'else' ? ('else'+this.else_statement):'';
                return str
            }else if(this.op1 == 'switch');
        };
        callNode.prototype.toString = function(){
            var str = this.name + '(';
            str += list2String(this.arg_list,',');
            return str +')'
        };
        compositeCallNode.prototype.toString = function(){
            var str = this.compName+'(';
            str += this.inputs? list2String(this.inputs,',') : '';
            str += ')(';
            str += this.params ? list2String(this.params,',') :'';
            return str +')'
        };
    }

    class Scope{
        constructor(description){
            this.description = description;//用来简单描述该作用域
            this.ST = {};        // 当前作用域的符号表
            this.parent = null;  // 指向父级作用域
        }
        getInstance(root){
            if(Scope.instance){
                return Scope.instance
            }
            return (Scope.instance = initSymbol(root))
        }
    }
    const S = new Scope();

    /**
     * 输入一棵语法树,返回初始化后的composite符号表
     */
    function initSymbol(root) {
        var global = new Scope("global");
        root.filter(node=>node instanceof declareNode ).forEach(decl=>{
            decl.init_declarator_list.forEach(dec=>{
                global.ST[dec.identifier] = dec;
                global.ST[dec.identifier] . type = decl.type;
            });
        });
        root.filter(node => node instanceof compositeNode).forEach(comp => {
            var compScop = S[comp.compName] = new Scope(comp);
            //处理该 composite 的输入参数
            debugger
            //处理该 composite 的 body
        });

        return global
    }

    class Edge{
        constructor(){
            this.from = {};
            this.to = {};
            this.weight = 0;
        }
    }
    class FlatNode{
        constructor(node){
            this.name = node.operName;
            this.inEdges = [];
            this.outEdges = [];
            this.work_estimate = 0;
            this.contents = node;
        }
    }

    class StaticStreamGraph {
        constructor() {
            this.topNode = null;
            this.flatNodes = getHackerNodes();
        }
        getInstance() {
            return StaticStreamGraph.instance ? StaticStreamGraph.instance : new StaticStreamGraph()
        }
    }

    StaticStreamGraph.prototype.generateAllEdges = function (composite){

    };
    StaticStreamGraph.prototype.GenerateFlatNodes = function (operator) {
        
    };
    function getHackerNodes(){
        var flatNodes = [];
        for(var i = 0;i< 6;i++){
            var node = new FlatNode({operName:'hacker_'+i});
            flatNodes.push(node);
        }
        for(var i = 1;i<6;i++){
            var edge = new Edge();
            edge.from = flatNodes[i-1];
            edge.to = flatNodes[i];
            flatNodes[i-1].outEdges.push(edge);
            flatNodes[i].inEdges.push(edge);
        }
        return flatNodes
    }

    /**
     * 输入一棵语法树, 返回 StaticStreamGraph 对象
     */
    function AST2FlatStaticStreamGraph(root){
        //var main = findMainComposite(root)
        var ssg = new StaticStreamGraph();
        //第1步, 把所有的 splitjoin pipeline 节点展开为普通 operator 节点
        unfold(root);
        //第2步, 对所有的 operator 节点声明,建立 FlatNode, 对 stream<type x>S 声明,建立对应的Edge
        //第3步, 将第2步中建立的 FlatNode 和 Edge 连接起来

        return ssg
    }

    function unfold(root){
        root.filter(x=>x instanceof compositeNode ).forEach(comp=>{
            comp.body.stmt_list.forEach(stmt=>{
                var resultComp = null;

                if(stmt instanceof pipelineNode){
                    resultComp = unfoldPipelineToOperator(stmt,comp);
                    var compCall = new compositeCallNode('', resultComp.compName, stmt.inputs);
                    comp.body.stmt_list.replace(stml, compCall);
                }else if(stmt instanceof binopNode && stmt.right instanceof pipelineNode){
                    resultComp = unfoldPipelineToOperator(stmt.right,comp);
                    stmt.right = new compositeCallNode('', resultComp.compName, stmt.right.inputs);
                    root.push(resultComp);
                }
            });
        });
    }

    /**
     * 展开 pipeline , 目前该函数只支持单输入单输出流,且不支持识别内部的 for 循环(需要完成循环展开函数)
     */
    function unfoldPipelineToOperator(pipeline,comp){
        debugger
        //构建新 composite 的 head 部分
        var compName = 'pipeline'+'_'+comp.compName;
        var inputs = pipeline.inputs.map(inputStreamName=>{
            return new inOutdeclNode('', getTypeof(inputStreamName), inputStreamName)
        });
        //构建新 composite 的 body 部分
        var stmt_list = [];
        var currentStream = pipeline.inputs;
        var count = 0;
        pipeline.body_stmts.forEach(stmt=>{
            if (stmt instanceof addNode && stmt.content instanceof compositeCallNode){
                var outStreamName = 'S' + count++;
                var decl = new declareNode('', getTypeof(), outStreamName);
                var right = new compositeCallNode('', stmt.content.compName,currentStream);
                var binop = new binopNode('', outStreamName,'=',right);
                stmt_list.push(decl);
                stmt_list.push(binop);
                currentStream = [outStreamName];
            }
        });
        var body = new compBodyNode('',undefined,stmt_list);
        var inout = new ComInOutNode('', inputs, [new inOutdeclNode('', getTypeof(), currentStream[0])]);
        var head = new compHeadNode('', compName, inout);
        //合并 head 和 body
        var composite = new compositeNode('',head,body);
        return composite;
    }

    //临时函数, 后来要被替换(完成符号表后)
    function getTypeof(str){
        return 'stream<int x>'
    }

    loadCVPPlugin();
    loadToStringPlugin();

    var COStreamJS = {};
    COStreamJS.global = typeof window === "object" ? window : global;
    Object.assign(COStreamJS.global, utils);
    Object.assign(COStreamJS.global, NodeTypes,{
        S,
        initSymbol,
        ast2String,
        AST2FlatStaticStreamGraph
    });

}());
