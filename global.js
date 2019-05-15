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
                op:'composite',
                compName:head.compName,
                inout:head.inout,
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
        constructor(loc, strType, id) {
            super(loc);
            Object.assign(this, { strType, id });
        }
    }
    class strdclNode extends Node {
        constructor(loc, type, identifier) {
            super(loc);
            this.op = 'stream<';
            this.id_list = [
                { type, identifier }
            ];
            this.op2 = '>';
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
    class winStmtNode extends Node{
        constructor(loc,winName,{type,arg_list}){
            super(loc);
            Object.assign(this,{
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

    }
    class joinNode extends Node {

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
        strdclNode: strdclNode,
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
        joinNode: joinNode
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

    /**
    * 加载toString插件,加载该插件后, statement 类型的节点可以执行 toString 用于代码生成
    */
    function loadToStringPlugin() {
        //将每一行 statement 的';'上提至 blockNode 处理
        blockNode.prototype.toString = function () {
            var str = '{';
            this.stmt_list && this.stmt_list.forEach((node) => {
                str += node.toString();
                if ([expNode].some(x => node instanceof x)) {
                    str += ';';
                }
                str += '\n';
            });
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
        //TODO:未完成,待填充
        expNode.prototype.toString = function () {
            return this.value
        };
        forNode.prototype.toString = function () {
            var str = 'for(';
            str += this.init ? this.init.toString() + ';' : ';';
            str += this.cond ? this.cond.toString() + ';' : ';';
            str += this.next ? this.next.toString() : '';
            str += ')' + this.statement.toString();
            return str
        };
    }

    loadCVPPlugin();
    loadToStringPlugin();

    var COStreamJS = {};
    COStreamJS.global = typeof window === "object" ? window : global;
    Object.assign(COStreamJS.global, utils);
    Object.assign(COStreamJS.global, NodeTypes);

}());
