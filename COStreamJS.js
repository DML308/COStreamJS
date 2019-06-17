var COStreamJS = (function () {
    'use strict';

    function debug$1(...args) {
        console.log("%c " + args[0], "color: #0598bd", ...args.slice(1));
    }
    function green(...args) {
        console.log("%c " + args[0], "color: #00bc00", ...args.slice(1));
    }
    function line(...args) {
        const line = args[0].first_line || args[0];
        console.log(`%c line:${line} %c ${args[1]} `, "color: #00bc00", "color: #0598bd", ...args.slice(2));
    }
    function error$1(...args) {
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

    /**
     * 深拷贝一个数据结构, 包括其原型链
     */
    function deepCloneWithoutCircle(node) {
        let hasVisitedNode = new WeakMap();
        return deepClone(node)

        function deepClone(node) {
            if (hasVisitedNode.has(node)) {
                console.error("深拷贝出现循环引用错误,请检查:",node);
            } else {
                if (['number', 'boolean', 'string', 'undefined'].includes(typeof node) || node === null) {
                    return node
                } else {
                    hasVisitedNode.set(node, true);
                    let obj = new node.constructor();
                    Object.keys(node).forEach(key => {
                        obj[key] = deepClone(node[key]);
                    });
                    return obj
                }
            }
        }
    }



    var utils = /*#__PURE__*/Object.freeze({
        debug: debug$1,
        line: line,
        error: error$1,
        green: green,
        ast2dot: ast2dot,
        deepCloneWithoutCircle: deepCloneWithoutCircle
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
    class idNode extends Node{
        constructor(loc, name, arg){
            super(loc);
            this.name = name;
            this.arg_list = [];
            if(arg){
                this.isArray = true;
                this.arg_list.push(arg);
            } 
        }
    }
    class declarator extends Node {
        constructor(loc, identifier, initializer) {
            super(loc);
            this.identifier = identifier;
            initializer && (this.op = '=');
            this.initializer = initializer;
        }
    }
    /********************************************************/
    /*              1.2 function.definition 函数声明          */
    /********************************************************/
    class function_definition extends Node {
        constructor(loc, type, declarator,param_list, compound) {
            super(loc);
            this.type = type;
            this.name = declarator.name;
            this.op1 = '(';
            this.param_list = param_list;
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
        constructor(loc, head = {}, body = {}) {
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
    class winStmtNode extends Node {
        constructor(loc, winName, options ={}) {
            super(loc);
            Object.assign(this, {
                winName,
                type: options.type,
                arg_list: options.arg_list
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
        constructor(loc, sourceStr='') {
            super(loc);
            // 转义字符串中的 \n 等特殊字符
            this.source = (sourceStr+'').replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
        }
    }
    /********************************************************/
    /* operNode in expression's right                       */
    /********************************************************/
    class operNode extends Node {
        constructor(loc) {
            super(loc);
            this.outputs = [];
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
            definePrivate(this, 'actual_composite');
        }
    }
    class operatorNode extends operNode {
        constructor(loc, operName, inputs, operBody) {
            super(loc);
            Object.assign(this, { operName, inputs, operBody });
        }
    }
    class splitjoinNode extends operNode {
        constructor(loc, options = {}) {
            super(loc);
            this.compName = options.compName;
            this.inputs = options.inputs;
            this.stmt_list = options.stmt_list;
            this.split = options.split;
            this.body_stmts = options.body_stmts;
            this.join = options.join;
            definePrivate(this, 'replace_composite');
        }
    }
    class pipelineNode extends operNode {
        constructor(loc, options = {}) {
            super(loc);
            this.compName = options.compName;
            this.inputs = options.inputs;
            this.body_stmts = options.body_stmts;
            definePrivate(this, 'replace_composite');
        }
    }
    class splitNode extends Node {
        constructor(loc, node = {}) {
            super(loc);
            this.name = "split";
            this.type = node instanceof duplicateNode ? "duplicate" : "roundrobin";
            if (node.arg_list) {
                Object.assign(this, { op1: '(', arg_list: node.arg_list, op2: ')' });
            }
        }
    }
    class joinNode extends Node {
        constructor(loc, node = {}) {
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
    class addNode extends Node {
        constructor(loc, content) {
            super(loc);
            this.name = "add";
            this.content = content;
        }
    }

    var NodeTypes = /*#__PURE__*/Object.freeze({
        Node: Node,
        declareNode: declareNode,
        idNode: idNode,
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
        addNode: addNode
    });

    /* parser generated by jison 0.4.18 */
    /*
      Returns a Parser object of the following structure:

      Parser: {
        yy: {}
      }

      Parser.prototype: {
        yy: {},
        trace: function(),
        symbols_: {associative list: name ==> number},
        terminals_: {associative list: number ==> name},
        productions_: [...],
        performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
        table: [...],
        defaultActions: {...},
        parseError: function(str, hash),
        parse: function(input),

        lexer: {
            EOF: 1,
            parseError: function(str, hash),
            setInput: function(input),
            input: function(),
            unput: function(str),
            more: function(),
            less: function(n),
            pastInput: function(),
            upcomingInput: function(),
            showPosition: function(),
            test_match: function(regex_match_array, rule_index),
            next: function(),
            lex: function(),
            begin: function(condition),
            popState: function(),
            _currentRules: function(),
            topState: function(),
            pushState: function(condition),

            options: {
                ranges: boolean           (optional: true ==> token location info will include a .range[] member)
                flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
                backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
            },

            performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
            rules: [...],
            conditions: {associative list: name ==> set},
        }
      }


      token location info (@$, _$, etc.): {
        first_line: n,
        last_line: n,
        first_column: n,
        last_column: n,
        range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
      }


      the parseError function receives a 'hash' object with these members for lexer and parser errors: {
        text:        (matched text)
        token:       (the produced terminal token, if any)
        line:        (yylineno)
      }
      while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
        loc:         (yylloc)
        expected:    (string describing the set of expected tokens)
        recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
      }
    */
    var parser = (function(){
    var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,14],$V1=[1,20],$V2=[1,12],$V3=[1,15],$V4=[1,16],$V5=[1,17],$V6=[1,18],$V7=[1,19],$V8=[5,37,43,133,134,135,136,137,138],$V9=[1,25],$Va=[1,26],$Vb=[20,21],$Vc=[20,21,22],$Vd=[11,16],$Ve=[2,12],$Vf=[1,40],$Vg=[1,39],$Vh=[11,16,18,21,22,23],$Vi=[5,11,20,21,29,31,37,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vj=[11,20,21,29,43,51,55,56,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,133,134,135,136,137,138],$Vk=[1,71],$Vl=[1,62],$Vm=[1,66],$Vn=[1,65],$Vo=[1,72],$Vp=[1,73],$Vq=[1,59],$Vr=[1,60],$Vs=[1,64],$Vt=[1,67],$Vu=[1,68],$Vv=[1,69],$Vw=[1,70],$Vx=[1,76],$Vy=[1,95],$Vz=[1,94],$VA=[1,105],$VB=[1,92],$VC=[1,93],$VD=[1,97],$VE=[1,98],$VF=[1,99],$VG=[1,100],$VH=[1,101],$VI=[1,102],$VJ=[1,103],$VK=[1,104],$VL=[1,116],$VM=[11,16,22],$VN=[11,16,22,25,31,74],$VO=[1,129],$VP=[1,130],$VQ=[1,123],$VR=[1,124],$VS=[1,121],$VT=[1,122],$VU=[1,125],$VV=[1,126],$VW=[1,127],$VX=[1,128],$VY=[1,131],$VZ=[1,132],$V_=[1,133],$V$=[1,134],$V01=[1,135],$V11=[1,136],$V21=[1,137],$V31=[1,138],$V41=[11,16,22,25,31,44,46,74,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119],$V51=[2,118],$V61=[11,16,18,22,25,31,44,46,74,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$V71=[11,16,18,21,22,23,25,31,44,46,74,91,92,93,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$V81=[20,21,55,56,87,88,92,93,94,100,101,102,103],$V91=[11,16,31],$Va1=[11,20,21,29,31,43,51,55,56,59,66,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vb1=[11,20,21,29,31,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vc1=[11,20,21,22,29,31,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vd1=[1,165],$Ve1=[11,16,22,25,74],$Vf1=[16,46],$Vg1=[16,31],$Vh1=[5,11,20,21,29,31,37,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,127,133,134,135,136,137,138],$Vi1=[16,22],$Vj1=[11,16,22,25,31,44,46,74,100,101,107,108,109,110,111,112,113,114,115,116,117,119],$Vk1=[11,16,22,25,31,44,46,74,107,108,109,110,111,112,113,116,117,119],$Vl1=[11,16,22,25,31,74,107,108,109,112,113,116,117,119],$Vm1=[11,16,22,25,31,44,46,74,107,108,109,110,111,112,113,114,115,116,117,119],$Vn1=[1,245],$Vo1=[2,148],$Vp1=[11,16,18,21,22,23,25,29,31,44,46,74,91,92,93,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$Vq1=[1,247],$Vr1=[1,263],$Vs1=[1,271],$Vt1=[1,290],$Vu1=[2,151],$Vv1=[1,296],$Vw1=[1,308],$Vx1=[1,313],$Vy1=[1,332],$Vz1=[20,31],$VA1=[11,20,21,29,31,43,51,55,56,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,133,134,135,136,137,138];
    var parser = {trace: function trace () { },
    yy: {},
    symbols_: {"error":2,"prog_start":3,"translation_unit":4,"EOF":5,"external_declaration":6,"function_definition":7,"declaration":8,"composite_definition":9,"declaring_list":10,";":11,"stream_declaring_list":12,"type_specifier":13,"init_declarator_list":14,"init_declarator":15,",":16,"declarator":17,"=":18,"initializer":19,"IDENTIFIER":20,"(":21,")":22,"[":23,"constant_expression":24,"]":25,"identifier_list":26,"stream_type_specifier":27,"assignment_expression":28,"{":29,"initializer_list":30,"}":31,"parameter_type_list":32,"compound_statement":33,"parameter_declaration":34,"composite_head":35,"composite_body":36,"COMPOSITE":37,"composite_head_inout":38,"INPUT":39,"composite_head_inout_member_list":40,"OUTPUT":41,"composite_head_inout_member":42,"STREAM":43,"<":44,"stream_declaration_list":45,">":46,"composite_body_param_opt":47,"statement_list":48,"PARAM":49,"operator_add":50,"ADD":51,"operator_pipeline":52,"operator_splitjoin":53,"operator_default_call":54,"PIPELINE":55,"SPLITJOIN":56,"split_statement":57,"join_statement":58,"SPLIT":59,"duplicate_statement":60,"roundrobin_statement":61,"ROUNDROBIN":62,"argument_expression_list":63,"DUPLICATE":64,"exp":65,"JOIN":66,"statement":67,"labeled_statement":68,"expression_statement":69,"selection_statement":70,"iteration_statement":71,"jump_statement":72,"CASE":73,":":74,"DEFAULT":75,"expression":76,"IF":77,"ELSE":78,"SWITCH":79,"WHILE":80,"DO":81,"FOR":82,"CONTINUE":83,"BREAK":84,"RETURN":85,"primary_expression":86,"NUMBER":87,"STRING_LITERAL":88,"operator_arguments":89,"postfix_expression":90,".":91,"++":92,"--":93,"FILEREADER":94,"stringConstant":95,"operator_selfdefine_body":96,"unary_expression":97,"unary_operator":98,"basic_type_name":99,"+":100,"-":101,"~":102,"!":103,"*":104,"/":105,"%":106,"^":107,"|":108,"&":109,"<=":110,">=":111,"==":112,"!=":113,"<<":114,">>":115,"||":116,"&&":117,"conditional_expression":118,"?":119,"assignment_operator":120,"ASSIGNMENT_OPERATOR":121,"operator_selfdefine_body_init":122,"operator_selfdefine_body_work":123,"operator_selfdefine_body_window_list":124,"INIT":125,"WORK":126,"WINDOW":127,"operator_selfdefine_window_list":128,"operator_selfdefine_window":129,"window_type":130,"SLIDING":131,"TUMBLING":132,"CONST":133,"INT":134,"LONG":135,"FLOAT":136,"DOUBLE":137,"STRING":138,"$accept":0,"$end":1},
    terminals_: {2:"error",5:"EOF",11:";",16:",",18:"=",20:"IDENTIFIER",21:"(",22:")",23:"[",25:"]",29:"{",31:"}",37:"COMPOSITE",39:"INPUT",41:"OUTPUT",43:"STREAM",44:"<",46:">",49:"PARAM",51:"ADD",55:"PIPELINE",56:"SPLITJOIN",59:"SPLIT",62:"ROUNDROBIN",64:"DUPLICATE",66:"JOIN",73:"CASE",74:":",75:"DEFAULT",77:"IF",78:"ELSE",79:"SWITCH",80:"WHILE",81:"DO",82:"FOR",83:"CONTINUE",84:"BREAK",85:"RETURN",87:"NUMBER",88:"STRING_LITERAL",91:".",92:"++",93:"--",94:"FILEREADER",95:"stringConstant",100:"+",101:"-",102:"~",103:"!",104:"*",105:"/",106:"%",107:"^",108:"|",109:"&",110:"<=",111:">=",112:"==",113:"!=",114:"<<",115:">>",116:"||",117:"&&",119:"?",121:"ASSIGNMENT_OPERATOR",125:"INIT",126:"WORK",127:"WINDOW",131:"SLIDING",132:"TUMBLING",133:"CONST",134:"INT",135:"LONG",136:"FLOAT",137:"DOUBLE",138:"STRING"},
    productions_: [0,[3,2],[4,1],[4,2],[6,1],[6,1],[6,1],[8,2],[8,2],[10,2],[14,1],[14,3],[15,1],[15,3],[17,1],[17,3],[17,4],[17,3],[26,1],[26,3],[12,2],[12,3],[19,1],[19,3],[19,4],[30,1],[30,3],[7,6],[7,5],[32,1],[32,3],[34,2],[9,2],[35,5],[38,0],[38,2],[38,5],[38,2],[38,5],[40,1],[40,3],[42,2],[27,4],[45,2],[45,4],[36,4],[47,0],[47,3],[50,2],[50,2],[50,2],[52,4],[53,6],[53,7],[57,2],[57,2],[61,4],[61,5],[60,4],[60,5],[58,2],[54,4],[54,5],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[68,4],[68,3],[33,2],[33,3],[48,1],[48,2],[69,1],[69,2],[70,5],[70,7],[70,5],[71,5],[71,7],[71,6],[71,7],[72,2],[72,2],[72,2],[72,3],[86,1],[86,1],[86,1],[86,3],[89,2],[89,3],[90,1],[90,4],[90,2],[90,3],[90,2],[90,2],[90,6],[90,3],[90,9],[90,10],[90,7],[63,1],[63,3],[97,1],[97,2],[97,2],[97,2],[97,4],[98,1],[98,1],[98,1],[98,1],[65,1],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[118,1],[118,5],[28,1],[28,3],[120,1],[120,1],[76,1],[76,3],[24,1],[96,5],[96,6],[122,0],[122,2],[123,2],[124,0],[124,4],[128,1],[128,2],[129,3],[130,3],[130,3],[130,4],[130,4],[13,1],[13,2],[99,1],[99,1],[99,2],[99,1],[99,1],[99,1]],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
    /* this == yyval */

    var $0 = $$.length - 1;
    switch (yystate) {
    case 1:
     return $$[$0-1] 
    break;
    case 2: case 10: case 18:
     this.$ = [$$[$0]]; 
    break;
    case 3: case 11: case 30: case 40: case 108: case 154:
     this.$.push($$[$0]); 
    break;
    case 7: case 8: case 23: case 42: case 78: case 95: case 152:
     this.$ = $$[$0-1]; 
    break;
    case 9:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 12:
     this.$ = $$[$0];      
    break;
    case 13:
     this.$ = new declarator(this._$,$$[$0-2],$$[$0]); 
    break;
    case 14:
     this.$ = new idNode(this._$,$$[$0]);                     
    break;
    case 15:
     error("暂未支持该种declarator的写法");         
    break;
    case 16:
     $$[$0-3].arg_list.push($$[$0-1]);                       
    break;
    case 17:
     $$[$0-2].arg_list.push(0);                        
    break;
    case 19:
     this.$ = $$[$0-2].concat($$[$0]); 
    break;
    case 20:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]);  
    break;
    case 21:
     this.$.init_declarator_list.push($$[$0]);
    break;
    case 24:
     this.$ = $$[$0-2]; 
    break;
    case 25: case 143: case 149: case 150:
     this.$ = $$[$0]; 
    break;
    case 26:
     this.$ = $$[$0-2] instanceof Array ? $$[$0-2].concat($$[$0]) : [$$[$0-2],$$[$0]];
    break;
    case 27:
     this.$ = new function_definition(this._$,$$[$0-5],$$[$0-4],$$[$0-2],$$[$0]); 
    break;
    case 28:
     this.$ = new function_definition(this._$,$$[$0-4],$$[$0-3],[],$$[$0]); 
    break;
    case 29: case 39: case 107: case 153:
     this.$ = [$$[$0]];   
    break;
    case 31:
     this.$ = new parameter_declaration(this._$,$$[$0-1],$$[$0]); 
    break;
    case 32:
     this.$ = new compositeNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 33:
     this.$ = new compHeadNode(this._$,$$[$0-3],$$[$0-1]);  
    break;
    case 34: case 46: case 77: case 94:
     this.$ = undefined; 
    break;
    case 35:
     this.$ = new ComInOutNode(this._$,$$[$0]);          
    break;
    case 36:
     this.$ = new ComInOutNode(this._$,$$[$0-3],$$[$0]);       
    break;
    case 37:
     this.$ = new ComInOutNode(this._$,undefined,$$[$0]);
    break;
    case 38:
     this.$ = new ComInOutNode(this._$,$$[$0],$$[$0-3]);       
    break;
    case 41:
     this.$ = new inOutdeclNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 43:
     this.$ = new strdclNode(this._$,$$[$0-1],$$[$0]);              
    break;
    case 44:
     this.$.id_list.push({ type:$$[$0-1],identifier:$$[$0] }); 
    break;
    case 45:
     this.$ = new compBodyNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 47:
     this.$ = new paramNode(this._$,$$[$0-1]);       
    break;
    case 48: case 49: case 50:
      this.$ = new addNode(this._$,$$[$0]); 
    break;
    case 51:

                                                                    this.$ = new pipelineNode(this._$,{
                                                                        compName: 'pipeline',
                                                                        inputs: undefined,
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 52:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: undefined,
                                                                        stmt_list: undefined,
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 53:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: undefined,
                                                                        stmt_list: $$[$0-4],
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 54: case 55:
     this.$ = new splitNode(this._$,$$[$0]);     
    break;
    case 56:
     this.$ = new roundrobinNode(this._$);   
    break;
    case 57:
     this.$ = new roundrobinNode(this._$,$$[$0-2]);
    break;
    case 58:
     this.$ = new duplicateNode(this._$);    
    break;
    case 59:
     this.$ = new duplicateNode(this._$,$$[$0-2]); 
    break;
    case 60:
     this.$ = new joinNode(this._$,$$[$0]);      
    break;
    case 61:
     this.$ = new compositeCallNode(this._$,$$[$0-3]);    
    break;
    case 62:
     this.$ = new compositeCallNode(this._$,$$[$0-4],$$[$0-2]); 
    break;
    case 71:
     this.$ = new labeled_statement(this._$,$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);
    break;
    case 72:
     this.$ = new labeled_statement(this._$,$$[$0-2],undefined,$$[$0-1],$$[$0]);
    break;
    case 73:
     this.$ = new blockNode(this._$,$$[$0-1],undefined,$$[$0]); 
    break;
    case 74:
     this.$ = new blockNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 75:
     this.$ = $$[$0] ? [$$[$0]] : [];   
    break;
    case 76:
     if($$[$0]) this.$.push($$[$0]);    
    break;
    case 79: case 81:
     this.$ = new selection_statement(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);        
    break;
    case 80:
     this.$ = new selection_statement(this._$,$$[$0-6],$$[$0-5],$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);  
    break;
    case 82:
     this.$ = new whileNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 83:
     this.$ = new doNode(this._$,$$[$0-2],$$[$0-5]);    
    break;
    case 84:
     this.$ = new forNode(this._$,$$[$0-3],$$[$0-2],undefined,$$[$0]);    
    break;
    case 85:
     this.$ = new forNode(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0]); 
    break;
    case 86: case 87: case 88:
     this.$ = new jump_statement(this._$,$$[$0-1]); 
    break;
    case 89:
     this.$ = new jump_statement(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 91: case 92:
     this.$ = new constantNode(this._$,$$[$0]); 
    break;
    case 93:
     this.$ = new parenNode(this._$,$$[$0-1]);    
    break;
    case 97:
     this.$ = new arrayNode(this._$,$$[$0-3],$$[$0-1]);    
    break;
    case 98:
     
                                                                    if(this.$ instanceof callNode){
                                                                        this.$ = new compositeCallNode(this._$,$$[$0-1].name,$$[$0-1].arg_list,$$[$0]);
                                                                    }         
                                                                    else{
                                                                        this.$ = new callNode(this._$,$$[$0-1],$$[$0]);
                                                                    }
                                                                
    break;
    case 99: case 119: case 120: case 121: case 122: case 123: case 124: case 125: case 126: case 127: case 128: case 129: case 130: case 131: case 132: case 133: case 134: case 135: case 136:
     this.$ = new binopNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 100: case 101:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]);    
    break;
    case 102:
     error("暂不支持FILEREADER");      
    break;
    case 103:

                                                                    this.$ = new operatorNode(this._$,$$[$0-2],$$[$0-1],$$[$0]);
                                                                
    break;
    case 104:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-6],
                                                                        stmt_list: undefined,
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 105:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-7],
                                                                        stmt_list: $$[$0-4],
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 106:

                                                                    this.$ = new pipelineNode(this._$,{
                                                                        compName: 'pipeline',
                                                                        inputs: $$[$0-4],
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 110: case 111: case 112:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 113:
     this.$ = new castNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 138:
     this.$ = new ternaryNode(this._$,$$[$0-4],$$[$0-2],$$[$0]); 
    break;
    case 140:

              if([splitjoinNode,pipelineNode,compositeCallNode,operatorNode].some(x=> $$[$0] instanceof x)){
                  if($$[$0-2] instanceof parenNode){
                      $$[$0].outputs = $$[$0-2].exp.slice();
                  }else if(typeof $$[$0-2] == "string"){
                      $$[$0].outputs = [$$[$0-2]];
                  }else{
                      error("只支持 S = oper()() 或 (S1,S2) = oper()() 两种方式",$$[$0-2],$$[$0]); 
                  }
              }
              this.$ = new binopNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
          
    break;
    case 144:

             if($$[$0-2] instanceof Array) this.$.push($$[$0]);
             else if($$[$0-2] !== undefined) this.$ = [$$[$0-2],$$[$0]];
             else error("error at `expression ','` ",$$[$0-2],$$[$0]); 
          
    break;
    case 146:

               this.$ = new operBodyNode(this._$,undefined,$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 147:

               this.$ = new operBodyNode(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 155:
     this.$ = new winStmtNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 156: case 157:
     this.$ = { type:$$[$0-2] }; 
    break;
    case 158: case 159:
     this.$ = { type:$$[$0-3], arg_list: $$[$0-1]}; 
    break;
    case 161:
     this.$ = "const "+$$[$0]; 
    break;
    case 164:
     this.$ = "long long"; 
    break;
    }
    },
    table: [{3:1,4:2,6:3,7:4,8:5,9:6,10:8,12:9,13:7,27:13,35:10,37:$V0,43:$V1,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{1:[3]},{5:[1,21],6:22,7:4,8:5,9:6,10:8,12:9,13:7,27:13,35:10,37:$V0,43:$V1,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V8,[2,2]),o($V8,[2,4]),o($V8,[2,5]),o($V8,[2,6]),{14:24,15:27,17:23,20:$V9,21:$Va},{11:[1,28]},{11:[1,29],16:[1,30]},{29:[1,32],36:31},o($Vb,[2,160]),{99:33,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:[1,34]},{20:[1,35]},o($Vc,[2,162]),o($Vc,[2,163],{135:[1,36]}),o($Vc,[2,165]),o($Vc,[2,166]),o($Vc,[2,167]),{44:[1,37]},{1:[2,1]},o($V8,[2,3]),o($Vd,$Ve,{18:$Vf,21:[1,38],23:$Vg}),{11:[2,9],16:[1,41]},o($Vh,[2,14]),{17:42,20:$V9,21:$Va},o($Vd,[2,10]),o($Vi,[2,7]),o($Vi,[2,8]),{20:[1,43]},o($V8,[2,32]),o($Vj,[2,46],{47:44,49:[1,45]}),o($Vb,[2,161]),o($Vd,[2,20]),{21:[1,46]},o($Vc,[2,164]),{13:48,45:47,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{13:52,22:[1,50],32:49,34:51,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vk,21:$Vl,24:53,25:[1,54],55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:55},{19:74,20:$Vk,21:$Vl,28:75,29:$Vx,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{15:79,17:80,20:$V9,21:$Va},{22:[1,81],23:$Vg},o($Vd,[2,21]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:82,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{13:52,32:108,34:51,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{22:[2,34],38:109,39:[1,110],41:[1,111]},{16:[1,113],46:[1,112]},{20:[1,114]},{16:$VL,22:[1,115]},{29:$Vz,33:117},o($VM,[2,29]),{17:118,20:$V9,21:$Va},{25:[1,119]},o($Vh,[2,17]),o([25,74],[2,145]),o($VN,[2,137],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,107:$VV,108:$VW,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11,116:$V21,117:$V31,119:[1,120]}),o($V41,$V51),o($V61,[2,109],{89:140,21:[1,144],23:[1,139],91:[1,141],92:[1,142],93:[1,143]}),{20:$Vk,21:$Vl,55:$Vm,56:$Vn,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:145,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:146,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:147,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:149,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:148,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V71,[2,96]),{21:[1,150]},{21:[1,151]},{21:[1,152]},o($V81,[2,114]),o($V81,[2,115]),o($V81,[2,116]),o($V81,[2,117]),o($V71,[2,90]),o($V71,[2,91]),o($V71,[2,92]),o($Vd,[2,13]),o($V91,[2,22]),{19:154,20:$Vk,21:$Vl,28:75,29:$Vx,30:153,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($VN,[2,139]),o($V41,$V51,{120:155,18:[1,156],121:[1,157]}),o($Vd,[2,11]),o($Vd,$Ve,{18:$Vf,23:$Vg}),o($Vh,[2,15]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,31:[1,158],33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Va1,[2,75]),o($Vb1,[2,63]),o($Vb1,[2,64]),o($Vb1,[2,65]),o($Vb1,[2,66]),o($Vb1,[2,67]),o($Vb1,[2,68]),o($Vb1,[2,69]),o($Vb1,[2,70]),{20:$Vk,21:$Vl,24:160,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:55},{74:[1,161]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,31:[1,162],33:85,43:$V1,48:163,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vc1,[2,77]),{11:[1,164],16:$Vd1},{21:[1,166]},{21:[1,167]},{21:[1,168]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:169,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{21:[1,170]},{11:[1,171]},{11:[1,172]},{11:[1,173],20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:174,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:[1,180],52:175,53:176,54:177,55:[1,178],56:[1,179]},o($Ve1,[2,143]),{14:24,15:27,17:80,20:$V9,21:$Va},{11:[1,181],16:$VL},{22:[1,182]},{27:185,40:183,42:184,43:$V1},{27:185,40:186,42:184,43:$V1},{20:[2,42]},{13:187,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vf1,[2,43]),{29:$Vz,33:188},{13:52,34:189,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V8,[2,28]),o($VM,[2,31],{23:$Vg}),o($Vh,[2,16]),{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:190,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:191,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:192,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:193,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:194,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:195,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:196,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:197,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:198,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:199,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:200,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:201,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:202,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:203,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:204,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:205,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:206,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:207,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:208,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:209,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($V71,[2,98],{96:210,29:[1,211]}),{20:[1,212]},o($V71,[2,100]),o($V71,[2,101]),{20:$Vk,21:$Vl,22:[1,213],28:215,55:$Vm,56:$Vn,63:214,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($V61,[2,110]),o($V61,[2,111]),o($V61,[2,112]),{22:[1,216]},{16:$Vd1,22:[1,217]},{22:[1,218]},{20:$Vk,21:$Vl,28:215,55:$Vm,56:$Vn,63:219,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,28:215,55:$Vm,56:$Vn,63:220,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{16:[1,222],31:[1,221]},o($Vg1,[2,25]),{20:$Vk,21:$Vl,28:223,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($V81,[2,141]),o($V81,[2,142]),o($V8,[2,45]),o($Va1,[2,76]),{74:[1,224]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:225,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vh1,[2,73]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,31:[1,226],33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vc1,[2,78]),{20:$Vk,21:$Vl,28:227,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:228,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:229,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:230,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{80:[1,231]},{11:$Vy,20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,69:232,76:96,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($Vb1,[2,86]),o($Vb1,[2,87]),o($Vb1,[2,88]),{11:[1,233],16:$Vd1},o($Vb1,[2,48]),o($Vb1,[2,49]),o($Vb1,[2,50]),{29:[1,234]},{29:[1,235]},{21:[1,236]},o($Vj,[2,47]),{29:[2,33]},{16:[1,237],22:[2,35]},o($Vi1,[2,39]),{20:[1,238]},{16:[1,239],22:[2,37]},{20:[1,240]},o($V8,[2,27]),o($VM,[2,30]),{16:$Vd1,74:[1,241]},o($V41,[2,119]),o($V41,[2,120]),o($Vj1,[2,121],{104:$VS,105:$VT,106:$VU}),o($Vj1,[2,122],{104:$VS,105:$VT,106:$VU}),o($V41,[2,123]),o([11,16,22,25,31,74,107,108,116,117,119],[2,124],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11}),o([11,16,22,25,31,74,108,116,117,119],[2,125],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,107:$VV,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11}),o([11,16,22,25,31,74,107,108,109,116,117,119],[2,126],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11}),o($Vk1,[2,127],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,114:$V01,115:$V11}),o($Vk1,[2,128],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,114:$V01,115:$V11}),o($Vk1,[2,129],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,114:$V01,115:$V11}),o($Vk1,[2,130],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,114:$V01,115:$V11}),o($Vl1,[2,131],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,110:$VY,111:$VZ,114:$V01,115:$V11}),o($Vl1,[2,132],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,110:$VY,111:$VZ,114:$V01,115:$V11}),o($Vm1,[2,133],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU}),o($Vm1,[2,134],{100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU}),o([11,16,22,25,31,74,116,119],[2,135],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,107:$VV,108:$VW,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11,117:$V31}),o([11,16,22,25,31,74,116,117,119],[2,136],{44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,107:$VV,108:$VW,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11}),{16:$Vd1,25:[1,242]},o($V71,[2,103]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:244,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,122:243,125:$Vn1,126:$Vo1,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V71,[2,99]),o($Vp1,[2,94]),{16:$Vq1,22:[1,246]},o($Vi1,[2,107]),{20:$Vk,21:$Vl,55:$Vm,56:$Vn,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:248,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},o($V71,[2,93]),{21:[1,249]},{16:$Vq1,22:[1,250]},{16:$Vq1,22:[1,251]},o($V91,[2,23]),{19:253,20:$Vk,21:$Vl,28:75,29:$Vx,31:[1,252],55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($VN,[2,140]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:254,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vb1,[2,72]),o($Vh1,[2,74]),o($Ve1,[2,144]),{16:$Vd1,22:[1,255]},{16:$Vd1,22:[1,256]},{16:$Vd1,22:[1,257]},{21:[1,258]},{11:$Vy,20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,69:259,76:96,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($Vb1,[2,89]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:260,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:262,50:91,51:$VA,55:$Vm,56:$Vn,57:261,59:$Vr1,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vk,21:$Vl,22:[1,264],28:215,55:$Vm,56:$Vn,63:265,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{27:185,41:[1,266],42:267,43:$V1},o($Vi1,[2,41]),{27:185,39:[1,268],42:267,43:$V1},o($Vf1,[2,44]),{20:$Vk,21:$Vl,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:269},o($V71,[2,97]),{123:270,126:$Vs1},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,122:272,125:$Vn1,126:$Vo1,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{29:$Vz,33:273},o($Vp1,[2,95]),{20:$Vk,21:$Vl,28:274,55:$Vm,56:$Vn,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($V61,[2,113]),{95:[1,275]},{29:[1,276]},{29:[1,277]},o($V91,[2,24]),o($Vg1,[2,26]),o($Vb1,[2,71]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:278,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:279,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:280,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vk,21:$Vl,28:106,55:$Vm,56:$Vn,65:56,76:281,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,22:[1,282],28:106,55:$Vm,56:$Vn,65:56,76:283,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,31:[1,284],33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:285,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,57:286,59:$Vr1,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{60:287,61:288,62:$Vt1,64:[1,289]},{11:[1,291]},{16:$Vq1,22:[1,292]},{27:185,40:293,42:184,43:$V1},o($Vi1,[2,40]),{27:185,40:294,42:184,43:$V1},o($VN,[2,138]),{31:$Vu1,124:295,127:$Vv1},{29:$Vz,33:297},{123:298,126:$Vs1},{126:[2,149]},o($Vi1,[2,108]),{22:[1,299]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:301,50:91,51:$VA,55:$Vm,56:$Vn,57:300,59:$Vr1,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:302,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Va1,[2,79],{78:[1,303]}),o($Vb1,[2,81]),o($Vb1,[2,82]),{16:$Vd1,22:[1,304]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:305,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{16:$Vd1,22:[1,306]},o($Vb1,[2,51]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,58:307,65:56,66:$Vw1,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:309,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vj,[2,54]),o($Vj,[2,55]),{21:[1,310]},{21:[1,311]},o($Vb1,[2,61]),{11:[1,312]},{16:$Vx1,22:[2,36]},{16:$Vx1,22:[2,38]},{31:[1,314]},{29:[1,315]},o([31,127],[2,150]),{31:$Vu1,124:316,127:$Vv1},o($V71,[2,102]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:317,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,57:318,59:$Vr1,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,31:[1,319],33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:320,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{11:[1,321]},o($Vb1,[2,84]),{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:322,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{31:[1,323]},{61:324,62:$Vt1},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,58:325,65:56,66:$Vw1,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vk,21:$Vl,22:[1,326],55:$Vm,56:$Vn,65:327,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:57,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw},{20:$Vk,21:$Vl,22:[1,328],28:215,55:$Vm,56:$Vn,63:329,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($Vb1,[2,62]),{27:185,42:267,43:$V1},o($V71,[2,146]),{20:$Vy1,128:330,129:331},{31:[1,333]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,58:334,65:56,66:$Vw1,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,48:335,50:91,51:$VA,55:$Vm,56:$Vn,65:56,67:83,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V71,[2,106]),o($Vb1,[2,80]),o($Vb1,[2,83]),o($Vb1,[2,85]),o($Vb1,[2,52]),{31:[2,60]},{31:[1,336]},{11:[1,337]},{22:[1,338],44:$VO,46:$VP,100:$VQ,101:$VR,104:$VS,105:$VT,106:$VU,107:$VV,108:$VW,109:$VX,110:$VY,111:$VZ,112:$V_,113:$V$,114:$V01,115:$V11,116:$V21,117:$V31},{11:[1,339]},{16:$Vq1,22:[1,340]},{20:$Vy1,31:[1,341],129:342},o($Vz1,[2,153]),{130:343,131:[1,344],132:[1,345]},o($V71,[2,147]),{31:[1,346]},{8:90,10:8,11:$Vy,12:9,13:107,20:$Vk,21:$Vl,27:13,28:106,29:$Vz,33:85,43:$V1,50:91,51:$VA,55:$Vm,56:$Vn,58:347,65:56,66:$Vw1,67:159,68:84,69:86,70:87,71:88,72:89,73:$VB,75:$VC,76:96,77:$VD,79:$VE,80:$VF,81:$VG,82:$VH,83:$VI,84:$VJ,85:$VK,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,99:11,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vb1,[2,53]),o($Vj,[2,58]),{11:[1,348]},o($VA1,[2,56]),{11:[1,349]},{31:[2,152]},o($Vz1,[2,154]),{11:[1,350]},{21:[1,351]},{21:[1,352]},o($V71,[2,104]),{31:[1,353]},o($Vj,[2,59]),o($VA1,[2,57]),o($Vz1,[2,155]),{20:$Vk,21:$Vl,22:[1,354],28:215,55:$Vm,56:$Vn,63:355,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},{20:$Vk,21:$Vl,22:[1,356],28:215,55:$Vm,56:$Vn,63:357,65:56,86:63,87:$Vo,88:$Vp,90:58,92:$Vq,93:$Vr,94:$Vs,97:78,98:61,100:$Vt,101:$Vu,102:$Vv,103:$Vw,118:77},o($V71,[2,105]),{11:[2,156]},{16:$Vq1,22:[1,358]},{11:[2,157]},{16:$Vq1,22:[1,359]},{11:[2,158]},{11:[2,159]}],
    defaultActions: {21:[2,1],112:[2,42],182:[2,33],273:[2,149],324:[2,60],341:[2,152],354:[2,156],356:[2,157],358:[2,158],359:[2,159]},
    parseError: function parseError (str, hash) {
        if (hash.recoverable) {
            this.trace(str);
        } else {
            var error = new Error(str);
            error.hash = hash;
            throw error;
        }
    },
    parse: function parse(input) {
        var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, TERROR = 2, EOF = 1;
        var args = lstack.slice.call(arguments, 1);
        var lexer = Object.create(this.lexer);
        var sharedState = { yy: {} };
        for (var k in this.yy) {
            if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
                sharedState.yy[k] = this.yy[k];
            }
        }
        lexer.setInput(input, sharedState.yy);
        sharedState.yy.lexer = lexer;
        sharedState.yy.parser = this;
        if (typeof lexer.yylloc == 'undefined') {
            lexer.yylloc = {};
        }
        var yyloc = lexer.yylloc;
        lstack.push(yyloc);
        var ranges = lexer.options && lexer.options.ranges;
        if (typeof sharedState.yy.parseError === 'function') {
            this.parseError = sharedState.yy.parseError;
        } else {
            this.parseError = Object.getPrototypeOf(this).parseError;
        }
        _token_stack:
            var lex = function () {
                var token;
                token = lexer.lex() || EOF;
                if (typeof token !== 'number') {
                    token = self.symbols_[token] || token;
                }
                return token;
            };
        var symbol, preErrorSymbol, state, action, r, yyval = {}, p, len, newState, expected;
        while (true) {
            state = stack[stack.length - 1];
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol == 'undefined') {
                    symbol = lex();
                }
                action = table[state] && table[state][symbol];
            }
                        if (typeof action === 'undefined' || !action.length || !action[0]) {
                    var errStr = '';
                    expected = [];
                    for (p in table[state]) {
                        if (this.terminals_[p] && p > TERROR) {
                            expected.push('\'' + this.terminals_[p] + '\'');
                        }
                    }
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                    }
                    this.parseError(errStr, {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected
                    });
                }
            if (action[0] instanceof Array && action.length > 1) {
                throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
            }
            switch (action[0]) {
            case 1:
                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]);
                symbol = null;
                if (!preErrorSymbol) {
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                } else {
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;
            case 2:
                len = this.productions_[action[1]][1];
                yyval.$ = vstack[vstack.length - len];
                yyval._$ = {
                    first_line: lstack[lstack.length - (len || 1)].first_line,
                    last_line: lstack[lstack.length - 1].last_line,
                    first_column: lstack[lstack.length - (len || 1)].first_column,
                    last_column: lstack[lstack.length - 1].last_column
                };
                if (ranges) {
                    yyval._$.range = [
                        lstack[lstack.length - (len || 1)].range[0],
                        lstack[lstack.length - 1].range[1]
                    ];
                }
                r = this.performAction.apply(yyval, [
                    yytext,
                    yyleng,
                    yylineno,
                    sharedState.yy,
                    action[1],
                    vstack,
                    lstack
                ].concat(args));
                if (typeof r !== 'undefined') {
                    return r;
                }
                if (len) {
                    stack = stack.slice(0, -1 * len * 2);
                    vstack = vstack.slice(0, -1 * len);
                    lstack = lstack.slice(0, -1 * len);
                }
                stack.push(this.productions_[action[1]][0]);
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                break;
            case 3:
                return true;
            }
        }
        return true;
    }};
    /* generated by jison-lex 0.3.4 */
    var lexer = (function(){
    var lexer = ({

    EOF:1,

    parseError:function parseError(str, hash) {
            if (this.yy.parser) {
                this.yy.parser.parseError(str, hash);
            } else {
                throw new Error(str);
            }
        },

    // resets the lexer, sets new input
    setInput:function (input, yy) {
            this.yy = yy || this.yy || {};
            this._input = input;
            this._more = this._backtrack = this.done = false;
            this.yylineno = this.yyleng = 0;
            this.yytext = this.matched = this.match = '';
            this.conditionStack = ['INITIAL'];
            this.yylloc = {
                first_line: 1,
                first_column: 0,
                last_line: 1,
                last_column: 0
            };
            if (this.options.ranges) {
                this.yylloc.range = [0,0];
            }
            this.offset = 0;
            return this;
        },

    // consumes and returns one char from the input
    input:function () {
            var ch = this._input[0];
            this.yytext += ch;
            this.yyleng++;
            this.offset++;
            this.match += ch;
            this.matched += ch;
            var lines = ch.match(/(?:\r\n?|\n).*/g);
            if (lines) {
                this.yylineno++;
                this.yylloc.last_line++;
            } else {
                this.yylloc.last_column++;
            }
            if (this.options.ranges) {
                this.yylloc.range[1]++;
            }

            this._input = this._input.slice(1);
            return ch;
        },

    // unshifts one char (or a string) into the input
    unput:function (ch) {
            var len = ch.length;
            var lines = ch.split(/(?:\r\n?|\n)/g);

            this._input = ch + this._input;
            this.yytext = this.yytext.substr(0, this.yytext.length - len);
            //this.yyleng -= len;
            this.offset -= len;
            var oldLines = this.match.split(/(?:\r\n?|\n)/g);
            this.match = this.match.substr(0, this.match.length - 1);
            this.matched = this.matched.substr(0, this.matched.length - 1);

            if (lines.length - 1) {
                this.yylineno -= lines.length - 1;
            }
            var r = this.yylloc.range;

            this.yylloc = {
                first_line: this.yylloc.first_line,
                last_line: this.yylineno + 1,
                first_column: this.yylloc.first_column,
                last_column: lines ?
                    (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                     + oldLines[oldLines.length - lines.length].length - lines[0].length :
                  this.yylloc.first_column - len
            };

            if (this.options.ranges) {
                this.yylloc.range = [r[0], r[0] + this.yyleng - len];
            }
            this.yyleng = this.yytext.length;
            return this;
        },

    // When called from action, caches matched text and appends it on next action
    more:function () {
            this._more = true;
            return this;
        },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject:function () {
            if (this.options.backtrack_lexer) {
                this._backtrack = true;
            } else {
                return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                    text: "",
                    token: null,
                    line: this.yylineno
                });

            }
            return this;
        },

    // retain first n characters of the match
    less:function (n) {
            this.unput(this.match.slice(n));
        },

    // displays already matched input, i.e. for error messages
    pastInput:function () {
            var past = this.matched.substr(0, this.matched.length - this.match.length);
            return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
        },

    // displays upcoming input, i.e. for error messages
    upcomingInput:function () {
            var next = this.match;
            if (next.length < 20) {
                next += this._input.substr(0, 20-next.length);
            }
            return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
        },

    // displays the character position where the lexing error occurred, i.e. for error messages
    showPosition:function () {
            var pre = this.pastInput();
            var c = new Array(pre.length + 1).join("-");
            return pre + this.upcomingInput() + "\n" + c + "^";
        },

    // test the lexed token: return FALSE when not a match, otherwise return token
    test_match:function(match, indexed_rule) {
            var token,
                lines,
                backup;

            if (this.options.backtrack_lexer) {
                // save context
                backup = {
                    yylineno: this.yylineno,
                    yylloc: {
                        first_line: this.yylloc.first_line,
                        last_line: this.last_line,
                        first_column: this.yylloc.first_column,
                        last_column: this.yylloc.last_column
                    },
                    yytext: this.yytext,
                    match: this.match,
                    matches: this.matches,
                    matched: this.matched,
                    yyleng: this.yyleng,
                    offset: this.offset,
                    _more: this._more,
                    _input: this._input,
                    yy: this.yy,
                    conditionStack: this.conditionStack.slice(0),
                    done: this.done
                };
                if (this.options.ranges) {
                    backup.yylloc.range = this.yylloc.range.slice(0);
                }
            }

            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) {
                this.yylineno += lines.length;
            }
            this.yylloc = {
                first_line: this.yylloc.last_line,
                last_line: this.yylineno + 1,
                first_column: this.yylloc.last_column,
                last_column: lines ?
                             lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                             this.yylloc.last_column + match[0].length
            };
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._backtrack = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
            if (this.done && this._input) {
                this.done = false;
            }
            if (token) {
                return token;
            } else if (this._backtrack) {
                // recover context
                for (var k in backup) {
                    this[k] = backup[k];
                }
                return false; // rule action called reject() implying the next rule should be tested instead.
            }
            return false;
        },

    // return next match in input
    next:function () {
            if (this.done) {
                return this.EOF;
            }
            if (!this._input) {
                this.done = true;
            }

            var token,
                match,
                tempMatch,
                index;
            if (!this._more) {
                this.yytext = '';
                this.match = '';
            }
            var rules = this._currentRules();
            for (var i = 0; i < rules.length; i++) {
                tempMatch = this._input.match(this.rules[rules[i]]);
                if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                    match = tempMatch;
                    index = i;
                    if (this.options.backtrack_lexer) {
                        token = this.test_match(tempMatch, rules[i]);
                        if (token !== false) {
                            return token;
                        } else if (this._backtrack) {
                            match = false;
                            continue; // rule action called reject() implying a rule MISmatch.
                        } else {
                            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                            return false;
                        }
                    } else if (!this.options.flex) {
                        break;
                    }
                }
            }
            if (match) {
                token = this.test_match(match, rules[index]);
                if (token !== false) {
                    return token;
                }
                // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                return false;
            }
            if (this._input === "") {
                return this.EOF;
            } else {
                return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                    text: "",
                    token: null,
                    line: this.yylineno
                });
            }
        },

    // return next match that has a token
    lex:function lex () {
            var r = this.next();
            if (r) {
                return r;
            } else {
                return this.lex();
            }
        },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    begin:function begin (condition) {
            this.conditionStack.push(condition);
        },

    // pop the previously active lexer condition state off the condition stack
    popState:function popState () {
            var n = this.conditionStack.length - 1;
            if (n > 0) {
                return this.conditionStack.pop();
            } else {
                return this.conditionStack[0];
            }
        },

    // produce the lexer rule set which is active for the currently active lexer condition state
    _currentRules:function _currentRules () {
            if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
                return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
            } else {
                return this.conditions["INITIAL"].rules;
            }
        },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState:function topState (n) {
            n = this.conditionStack.length - 1 - Math.abs(n || 0);
            if (n >= 0) {
                return this.conditionStack[n];
            } else {
                return "INITIAL";
            }
        },

    // alias for begin(condition)
    pushState:function pushState (condition) {
            this.begin(condition);
        },

    // return the number of states currently on the stack
    stateStackSize:function stateStackSize() {
            return this.conditionStack.length;
        },
    options: {},
    performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
    switch($avoiding_name_collisions) {
    case 0:/* skip whitespace */
    break;
    case 1:/* skip Annotation */
    break;
    case 2:/* ignore comment */
    break;
    case 3:return 87
    break;
    case 4:return 88
    break;
    case 5:return 138
    break;
    case 6:return 134
    break;
    case 7:return 137
    break;
    case 8:return 136
    break;
    case 9:return 135
    break;
    case 10:return 133
    break;
    case 11:return 'DEFINE'
    break;
    case 12:return 80
    break;
    case 13:return 82
    break;
    case 14:return 84
    break;
    case 15:return 83
    break;
    case 16:return 79
    break;
    case 17:return 73
    break;
    case 18:return 75
    break;
    case 19:return 77
    break;
    case 20:return 78
    break;
    case 21:return 81
    break;
    case 22:return 85
    break;
    case 23:return 37
    break;
    case 24:return 39
    break;
    case 25:return 41
    break;
    case 26:return 43
    break;
    case 27:return 94
    break;
    case 28:return 'FILEWRITER'
    break;
    case 29:return 51
    break;
    case 30:return 49
    break;
    case 31:return 125
    break;
    case 32:return 126
    break;
    case 33:return 127
    break;
    case 34:return 132
    break;
    case 35:return 131
    break;
    case 36:return 56
    break;
    case 37:return 55
    break;
    case 38:return 59
    break;
    case 39:return 66
    break;
    case 40:return 64
    break;
    case 41:return 62
    break;
    case 42:return 20
    break;
    case 43:return 121
    break;
    case 44:return yy_.yytext
    break;
    case 45:return yy_.yytext
    break;
    case 46:return 5
    break;
    case 47:return 'INVALID'
    break;
    }
    },
    rules: [/^(?:\s+)/,/^(?:\/\*([^\*]|(\*)*[^\*\/])*(\*)*\*\/)/,/^(?:\/\/.*)/,/^(?:(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b)/,/^(?:('[^']*'|"[^\"]*"))/,/^(?:string\b)/,/^(?:int\b)/,/^(?:double\b)/,/^(?:float\b)/,/^(?:long\b)/,/^(?:const\b)/,/^(?:define\b)/,/^(?:while\b)/,/^(?:for\b)/,/^(?:break\b)/,/^(?:continue\b)/,/^(?:switch\b)/,/^(?:case\b)/,/^(?:default\b)/,/^(?:if\b)/,/^(?:else\b)/,/^(?:do\b)/,/^(?:return\b)/,/^(?:composite\b)/,/^(?:input\b)/,/^(?:output\b)/,/^(?:stream\b)/,/^(?:FileReader\b)/,/^(?:FileWriter\b)/,/^(?:add\b)/,/^(?:param\b)/,/^(?:init\b)/,/^(?:work\b)/,/^(?:window\b)/,/^(?:tumbling\b)/,/^(?:sliding\b)/,/^(?:splitjoin\b)/,/^(?:pipeline\b)/,/^(?:split\b)/,/^(?:join\b)/,/^(?:duplicate\b)/,/^(?:roundrobin\b)/,/^(?:[a-zA-Z_][a-zA-Z0-9_]*)/,/^(?:\*=|\/=|\+=|-=|<<=|>>=|&=|\^=|\|=)/,/^(?:##|\+\+|--|>>|>>|<=|>=|==|!=|&&|\|\|)/,/^(?:[-*+\/%&|~!()\[\]{}'"#,\.?:;<>=])/,/^(?:$)/,/^(?:.)/],
    conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47],"inclusive":true}}
    });
    return lexer;
    })();
    parser.lexer = lexer;
    function Parser () {
      this.yy = {};
    }
    Parser.prototype = parser;parser.Parser = Parser;
    return new Parser;
    })();


    if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
    exports.parser = parser;
    exports.Parser = parser.Parser;
    exports.parse = function () { return parser.parse.apply(parser, arguments); };
    exports.main = function commonjsMain (args) {
        if (!args[1]) {
            console.log('Usage: '+args[0]+' FILE');
            process.exit(1);
        }
        var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
        return exports.parser.parse(source);
    };
    if (typeof module !== 'undefined' && require.main === module) {
      exports.main(process.argv.slice(1));
    }
    }

    /**
     * 加载常量传播插件后,表达式 node 可以计算数值
     */

    expNode.prototype.getValue = function () {
        //异步计算 value 值, 为了常量传播保留这个接口
        Object.defineProperty(this, 'value', {
            enumerable: false,
            get: function () {
                return this.getValue()
            },
            set: function () {
                error$1("请不要手动给 value 赋值.", this);
            }
        });
    };
    ternaryNode.prototype.getValue = function () {
        return this.first.value ? this.second.value : this.third.value
    };
    parenNode.prototype.getValue = function () {
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

    arrayNode.prototype.getValue = function () {
        return NaN
    };
    callNode.prototype.getValue = function () {
        return NaN
    };

    constantNode.prototype.getValue = function(){
        return Number(this.source)
    };

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
    * 执行下列代码后, statement 类型的节点可以执行 toString 用于代码生成或调试
    */

    declarator.prototype.toString = function () {
        var str = this.identifier.toString() + '';
        str += this.op ? this.op : '';
        if (this.initializer instanceof Array) {
            str += list2String(this.initializer, ',', '{', '}');
        } else {
            str += this.initializer ? this.initializer.toString() : '';
        }
        return str
    };
    idNode.prototype.toString = function(){
        return this.name + (this.arg_list.length > 0? list2String(this.arg_list, '][','[',']') :'').replace(/\[0]/g,'[]')
    };
    declareNode.prototype.toString = function () {
        return this.type + ' ' + list2String(this.init_declarator_list, ', ')
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
        return this.strType.toString() + this.id
    };
    strdclNode.prototype.toString = function () {
        var str = 'stream<';
        this.id_list.forEach(({ type, identifier }) => {
            str += type + ' ' + identifier + ',';
        });
        return str.slice(0, -1) + '>'
    };
    compBodyNode.prototype.toString = function () {
        var str = '{\n';
        str += this.param ? this.param.toString() : '';
        str += list2String(this.stmt_list, ';\n') + ';\n}\n';
        return str
    };
    paramNode.prototype.toString = function () {
        return 'param\n  ' + list2String(this.param_list, ',') + ';\n'
    };
    parameter_declaration.prototype.toString = function () {
        return this.type + ' ' + this.declarator.toString()
    };
    //将每一行 statement 的';'上提至 blockNode 处理
    blockNode.prototype.toString = function () {
        var str = '{\n';
        str += list2String(this.stmt_list, ';\n') + ';\n';
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
        let value = this.value;
        return Number.isNaN(value) ? this.source : value
    };
    castNode.prototype.toString = function () {
        return '(' + this.type + ')' + this.exp
    };
    parenNode.prototype.toString = function () {
        return '(' + this.exp + ')'
    };
    unaryNode.prototype.toString = function () {
        return '' + this.first + this.second
    };
    operatorNode.prototype.toString = function () {
        var str = this.operName + '(';
        str += this.inputs ? this.inputs : '';
        return str + ')' + this.operBody
    };
    operBodyNode.prototype.toString = function () {
        var str = '{\n';
        str += this.stmt_list ? list2String(this.stmt_list, ';\n') + ';\n' : '';
        str += this.init ? 'init' + this.init : '';
        str += this.work ? 'work' + this.work : '';
        str += this.win ? 'window{' + list2String(this.win, ';\n') + ';\n' + '}' : '';
        return str + '\n}\n'
    };
    winStmtNode.prototype.toString = function () {
        return this.winName + ' ' + this.type + '(' + list2String(this.arg_list, ',') + ')'
    };
    forNode.prototype.toString = function () {
        var str = 'for(';
        str += this.init ? this.init.toString() + ';' : ';';
        str += this.cond ? this.cond.toString() + ';' : ';';
        str += this.next ? this.next.toString() : '';
        str += ')' + this.statement.toString();
        return str
    };
    selection_statement.prototype.toString = function () {
        if (this.op1 === 'if') {
            var str = 'if(' + this.exp + ')' + this.statement;
            str += this.op4 === 'else' ? ('else' + this.else_statement) : '';
            return str
        } else if (this.op1 == 'switch') ;
    };
    callNode.prototype.toString = function () {
        var str = this.name + '(';
        str += list2String(this.arg_list, ',');
        return str + ')'
    };
    compositeCallNode.prototype.toString = function () {
        var str = this.compName + '(';
        str += this.inputs ? list2String(this.inputs, ',') : '';
        str += ')(';
        str += this.params ? list2String(this.params, ',') : '';
        return str + ')'
    };

    class SemCheck {
        constructor(){

        }
    }
    /*
    * 功能：找到Main composite
    * 输入参数：语法树单元program
    * 输出：返回 Main Composite
    */
    SemCheck.findMainComposite = function(program){
        var isMain = (node) => node instanceof compositeNode && node.compName == "Main" ;
        var main_composites = program.filter(node => isMain(node));
        if (main_composites.length != 1){
            throw new Error("the program should have one && more than one composite entrance")
        }
        return main_composites[0]
    };

    class FlatNode {
        constructor(/* operatorNode */ node) {
            this.name = node.operName;       // opeator名字
            this.PreName = node.operName;    // cwb记录Operator被重命名前的名字
            this.visitTimes = 0;             // 表示该结点是否已经被访问过,与dumpdot有关

            /** @type {operatorNode} 指向operator(经常量传播后的) */
            this.contents = node;
            // 指向原始operator
            this.oldContents = node;

            this.nOut = 0; // 输 出 边个数
            this.nIn = 0;  // 输 入 边个数

            //两级划分算法中,actor所在的place号、thread号、thread中的序列号
            this.place_id = 0;
            this.thread_id = 0;
            this.post_thread_id = 0;
            this.serial_id = 0;

            //节点work函数的静态工作量
            this.work_estimate = 0;
            // opeator在ssg的flatnodes中的顺序编号
            this.num = 0;

            /** @type {FlatNode[]} 输出边各operator */
            this.outFlatNodes = [];  
            /** @type {FlatNode[]} 输入边各operator */
            this.inFlatNodes = [];

            /** @type {number[]} */
            this.outPushWeights = []; // 输 出 边各权重
            this.inPopWeights = [];   // 输 入 边各权重
            this.inPeekWeights = [];  // 输 入 边各权重

            /** @type {string[]} */
            this.outPushString = [];
            this.inPopString = [];
            this.inPeekString = [];

            /** init调度次数 */
            this.initCount = 0;
            /** 稳态调度次数 */
            this.steadyCount = 0;
            /** 阶段号 */
            this.stageNum = 0;
        }

        AddOutEdges(/*FlatNode */ dest) {
            this.outFlatNodes.push(dest);
            this.nOut++;
        }
        AddInEdges(/*FlatNode */ src) {
            this.inFlatNodes.push(src);
            this.nIn++;
        }
        // 访问该结点
        VisitNode() {
            this.visitTimes++;
        }
        ResetVisitTimes() {
            this.visitTimes = 0;
        }

    }

    class StaticStreamGraph {
        constructor() {
            /** @type {FlatNode} SDF图的起始节点，假设只有一个输入为0的节点 */
            this.topNode = null; 

            /** @type {FlatNode[]} 静态数据流图所有节点集合 */
            this.flatNodes = [];

            /** @type {Map<string, FlatNode>} 将有向边与其上端绑定*/   
            this.mapEdge2UpFlatNode = new Map();
            /** @type {Map<string, FlatNode>}将有向边与其下端绑定*/   
            this.mapEdge2DownFlatNode = new Map();

            /** @type {Map<FlatNode,number>}  存放各个operator的workestimate（稳态工作量估计) */
            this.mapSteadyWork2FlatNode = new Map();

            /** @type {Ma<FlatNode,number>}    存放各个operator的workestimate初态）*/
            this.mapInitWork2FlatNode = new Map();

        };

        //给静态数据流图中所有的 FlatNode 加上数字后缀来表达顺序, 如 Source => Source_0
        ResetFlatNodeNames() {
            this.flatNodes.forEach((flat, idx) => flat.name = flat.name + '_' + idx);
        }

        /*重置ssg结点flatnodes内所有flatnode内的visitimes*/
        ResetFlatNodeVisitTimes() {
            this.flatNodes.forEach(flat => flat.ResetVisitTimes());
        }

        AddSteadyWork(/*FlatNode * */flat, work) {
            this.mapSteadyWork2FlatNode.set(flat, work);
        }
        // 存放初态调度工作量
        AddInitWork(flat, work) {
            this.mapInitWork2FlatNode.set(flat, work);
        }
    }

    /**
     * 创建一个新的 FlatNode, 例如对 out = operator(in){ init work window } , 
     * 标记 out 的 up 指向 flat, 同时标记 in 的 down 指向 flat,
     * 如果 in 是由 parent 产生的, 则 parent 指向 flat
     */
    StaticStreamGraph.prototype.GenerateFlatNodes = function (/* operatorNode* */ u) {

        const flat = new FlatNode(u);

        /* 寻找输出流  建立节点的输入输出流关系
         * 例如 out = call(in) 对 edgeName:out 来说, call 是它的"上端"节点, 所以插入 mapEdge2UpFlatNode */
        if (u.outputs) u.outputs.forEach(edgeName => this.mapEdge2UpFlatNode.set(edgeName, flat));

        this.flatNodes.push(flat);

        /* 例如 out = call(in), 对 in 来说, call 是它的"下端"节点, 所以插入 mapEdge2DownFlatNode */
        if (u.inputs) {
            u.inputs.forEach(inEdgeName => {
                this.mapEdge2DownFlatNode.set(inEdgeName, flat);

                /* 同时还要找找看 in 是由哪个 operator 输出的, 如果找得到则建立连接*/
                if (this.mapEdge2UpFlatNode.has(inEdgeName)) {
                    var parent = this.mapEdge2UpFlatNode.get(inEdgeName);
                    parent.AddOutEdges(flat);
                    flat.AddInEdges(parent);
                }
            });
        }
    };


    /**
     * 设置 flatNode 的边的 weight
     * @eaxmple
     * window{
     *   In  sliding(1,2); //则分别设置inPeekWeights 为1, inPopWeights 为2
     *   Out tumbling(2);  //设置 outPushWeights 为2
     * }
     */
    StaticStreamGraph.prototype.SetFlatNodesWeights = function () {
        for (let flat of this.flatNodes) {
            let oper = flat.contents;
            let win_stmts = oper.operBody.win;
            for(let it of win_stmts){
                let edgeName = it.winName;
                if(it.type === "sliding"){
                    flat.inPeekString.push(edgeName);
                    flat.inPopString.push(edgeName);
                    flat.inPeekWeights.push(it.arg_list[0].value);
                    flat.inPopWeights.push(it.arg_list[1].value);
                }else if(it.type === "tumbling"){
                    flat.outPushString.push(edgeName);
                    flat.outPushWeights.push(it.arg_list[0].value);
                }
            }
        }
    };

    //对外的包装对象
    var COStreamJS = {
        S : null,
        gMainComposite : null
    }; 
    COStreamJS.__proto__ = {};
    //vector<Node *> compositeCall_list; 存储splitjoin/pipeline中的compositeCall调用
    var compositeCall_list = [];

    class UnfoldComposite {
        constructor() {
            this.num = 0;
        }
        /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
        MakeCompositeName(/*string*/ name) {
            return name + "_" + this.num++;
        }
    }
    var unfold = new UnfoldComposite();

    /**
     * @description 对于composite节点内的operatorNode进行流替换
     * 只替换第一个和最后一个oper 的原因是: 对第一个修改 IN, 对最后一个修改 Out, 对简单串行的 comp 是没问题的
     * @param {compositeNode} comp
     * @param {void|string[]} inputs
     * @param {void|string[]} outputs
     * @param { bool } flag - flag 为1则同时替换内部的 work 和 win 的 stream 变量名, 为0则说明之前已调用过 modifyStreamName
     * @example
     * 例如对于 
     * composite SecondSource(input Source,output S0){
     *    Out = AssignmentX(In){ }
     * }
     * 将其替换为
     * composite SecondSource(input Source,output S0){
     *    S0 = AssignmentX(Source){ }
     * }
     */
    UnfoldComposite.prototype.streamReplace = function (comp,inputs, outputs, flag) {
        let stmt_list = comp.body.stmt_list;
        inputs && operatorStreamReplace(stmt_list[0], inputs, 'inputs');
        outputs && operatorStreamReplace(stmt_list[stmt_list.length - 1], outputs, 'outputs');
        return comp

        function operatorStreamReplace(stmt, streamNames, tag) {
            let oper = stmt instanceof binopNode ? stmt.right : stmt;
            if (oper instanceof operatorNode) {
                if (flag) {
                    UnfoldComposite.prototype.modifyStreamName(oper, streamNames, tag=="inputs");
                }
                oper[tag] = streamNames;
            } else if (oper instanceof splitjoinNode || oper instanceof pipelineNode) {
                oper[tag] = streamNames;
            }
        }
    };

    /**
     * 用于splitjoin或者pipeline中展开流的替换，这些compositeCall可以指向相同的init，work
     * FIXME: 这个函数假设被 add 的 composite 中的第一个 binop operator 为有效 operator, 实际上这种假设并不严谨,容易被测试出BUG
     */
    UnfoldComposite.prototype.compositeCallStreamReplace = function (/*compositeNode **/ comp, inputs, outputs) {
        let copy;
        let inout = new ComInOutNode(null, inputs, outputs);
        let head = new compHeadNode(null, comp.compName, inout);

        for (let it of comp.body.stmt_list) {
            if (it instanceof binopNode) {
                let exp = it.right;
                if (exp instanceof operatorNode) {
                    let oper = getCopyOperInStreamReplace(exp, inputs, outputs);
                    let comp_body = new compBodyNode(null, null, [oper]);
                    copy = new compositeNode(null, head, comp_body);
                } else if (exp instanceof pipelineNode || exp instanceof splitjoinNode) {
                    copy = comp;
                }
            } else {
                throw new Error("未定义的分支. 前面假设 pipeline 中 add call()的 call 只有 binop 节点是否太片面了")
            }
        }
        this.streamReplace(copy, inputs, outputs, 0);
        return copy


        function getCopyOperInStreamReplace(exp, inputs, outputs) {
            /* 除了window都可以指向一块内存 对于window动态分配一块内存，替换window中的名字，再函数的结尾将流进行替换*/
            let work = deepCloneWithoutCircle(exp.operBody.work);
            /*动态分配生成新的windowNode*/
            let win = [];
            for (let win_stmt of exp.operBody.win) {
                let stmt = new winStmtNode(null, win_stmt.winName, {
                    type: win_stmt.type,
                    arg_list: win_stmt.arg_list
                });
                win.push(stmt);
            }
            let body = new operBodyNode(null, exp.operBody.stmt_list, exp.operBody.init, work, win);
            let oper = new operatorNode(null, exp.operName, exp.inputs, body);
            oper.outputs = exp.outputs;
            UnfoldComposite.prototype.modifyStreamName(oper, inputs, true);
            UnfoldComposite.prototype.modifyStreamName(oper, outputs, false);
            return oper
        }
    };

    /**
     * 对oper进行修改: 用输入的 stream 流名来替换 work 和 win 中对应的流名
     * @param {boolean} style -标识输入流还是输出流,true: 输入流, false: 输出流
     * @description FIXME 与杨飞的 modifyStreamName 不一致: 因为这里的 work 简化为了字符串, 所以直接进行了字符串替换. win 的处理基本一致
     */
    UnfoldComposite.prototype.modifyStreamName = function (/*operatorNode **/ oper, stream, style) {
        var newName = stream[0];
        var oldName = style ? oper.inputs[0] : oper.outputs[0];
        let reg = new RegExp(oldName, 'g');
        oper.operBody.work = (oper.operBody.work + '').replace(reg, newName);
        oper.operBody.win.forEach(winStmt => {
            if (winStmt.winName == oldName) {
                winStmt.winName = newName;
            }
        });
    };


    UnfoldComposite.prototype.UnfoldPipeline = function (/* pipelineNode */ node) {
        compositeCallFlow(node.body_stmts);
        let compName = this.MakeCompositeName("pipeline");
        let inout = new ComInOutNode(null, node.inputs, node.outputs);
        let head = new compHeadNode(null, compName, inout);
        let stmt_list = generateBodyStmts();
        let body = new compBodyNode(null, null, stmt_list);
        let pipeline = new compositeNode(null, head, body);
        compositeCall_list.length = 0; //清空该数组
        return pipeline

        /**
         * 对于如下形式的 pipeline
         * out = pipeline(in) { 
         *   add A(); 
         *   add B(); 
         *   add C();
         * } 
         * 我们要生成的 stmt_list 的格式为{
         *   //stream<type x>S0_0,S0_1; 理想状态这里应该生成一个 strdcl 语句, 但实际上并没生成
         *   S0_0 = A(in);
         *   S0_1 = B(S0_0);
         *   out= C(S0_1);
         * }
         */
        function generateBodyStmts() {
            let result = [];
            for (let i = 0; i < compositeCall_list.length; i++) {
                let inputs = i == 0 ? node.inputs : [compName + '_' + (i - 1)];
                let outputs = i != compositeCall_list.length - 1 ? [compName + '_' + i] : node.outputs;

                let compCall = compositeCall_list[i];
                let call = new compositeCallNode(null, compCall.compName, inputs);
                call.outputs = outputs;
                //TODO: 符号表修改后要修改对应的这个地方
                let comp = COStreamJS.S.LookUpCompositeSymbol(compCall.compName);
                comp = deepCloneWithoutCircle(comp); //对 compositeNode 执行一次 copy 来避免静态流变量名替换时的重复写入
                call.actual_composite = UnfoldComposite.prototype.compositeCallStreamReplace(comp, inputs, outputs);

                let binop = new binopNode(null, outputs, '=', call);
                result.push(binop);
            }
            return result
        }

    };

    /**
     *  遍历splitjoin/pipeline结构中的statement，将compositecallNode加入到compositeCall_list中
     */
    function compositeCallFlow(/*list<Node *> */ stmts) {
        if (!stmts || stmts.length == 0) throw new Error("compositeCallFlow Error")
        stmts.forEach(stmt => {
            stmt instanceof addNode ? handlerAdd(stmt) : '';
            stmt instanceof forNode ? handlerFor(stmt) : '';
        });
        return

        function handlerAdd(add) {
            if (add.content instanceof compositeCallNode) {
                compositeCall_list.push(add.content);

            } else if (add.content instanceof splitjoinNode || add.content instanceof pipelineNode) {
                let copy = deepCloneWithoutCircle(add.content);
                compositeCall_list.push(copy);
            }
        }
        /**
         * 对一个静态 for 循环做循环展开, 目前没有符号表, 所以只考虑如下简单例子
         * for(j= 1;j<10;i+=2) //对该例子会将其内部语句展开5次
         * @warning 得益于 js 的字符串转函数能力, 我们能以一种 hacker 的方式来获取循环次数. 而 C++ 中的做法并非如此
         */
        function handlerFor(for_stmt) {
            /*获得for循环中的init，cond和next值 目前只处理for循环中数据是整型的情况 */
            let forStr = for_stmt.toString();
            forStr.match(/([^\{]*)\{/);
            forStr = RegExp.$1;
            let evalStr = `
            var count = 0;
            ${forStr}{
                count++
            }
            return count` ;
            let count = (new Function(evalStr))();  //得到了 for 循环的实际执行次数
            //现在需要展开循环的次数 count 和展开循环的循环体都已准备好, 则递归调用.
            for (let i = 0; i < count; i++) {
                compositeCallFlow(for_stmt.statement.stmt_list);
            }
        }
    }

    /**
     * @param {splitjoinNode} node - 待展开的 splitjoinNode
     * @returns {compositeNode} 展开完成的 actual_composite
     */
    UnfoldComposite.prototype.UnfoldSplitJoin = function (node) {
        let compName = this.MakeCompositeName("splitjoin");
        compositeCallFlow(node.body_stmts);
        let inout = new ComInOutNode(null, node.inputs, node.outputs);
        let head = new compHeadNode(null, compName, inout);

        var stmt_list = this.generateDuplicateOrRoundrobinBodyStmts(compName, node, node.split.type);

        let body = new compBodyNode(null, null, stmt_list);
        let actual_composite = new compositeNode(null, head, body);
        compositeCall_list.length = 0;
        return actual_composite
    };

    /**
     * 对于如下形式的 split duplicateOrRoundrobin
     * split duplicateOrRoundrobin();
     *   add A();
     *   add B();
     *   add pipeline();
     * join  roundrobin();
     * 我们要生成的 stmt_list 的格式为{
     *   (dup_0,dup_1,dup_2) = duplicateOrRoundrobinOper(In)
     *   S0_0 = A(dup_0)
     *   S0_1 = B(dup_1)
     *   S0_2 = pipeline(dup_2)
     *   Out = join(S0_0, S0_1, S0_2)
     * }
     * @param {splitjoinNode} node
     * @returns {statement[]}
     */
    UnfoldComposite.prototype.generateDuplicateOrRoundrobinBodyStmts = function (compName, node, type = "duplicate") {
        let result = [];

        //0.先提前设置好流变量名
        let splitStreams = Array.from({ length: compositeCall_list.length }).map((_, idx) => compName + "_split_" + idx);
        let joinStreams = Array.from({ length: compositeCall_list.length }).map((_, idx) => compName + "_join_" + idx);

        //1.构建 duplicateOrRoundrobin  节点
        let duplicateOrRoundrobinOper = type === "duplicate"
            ? this.MakeDuplicateOperator(node.inputs, node.split.arg_list, splitStreams)
            : this.MakeRoundrobinOperator(node.inputs, node.split.arg_list, splitStreams);
        result.push(duplicateOrRoundrobinOper);

        //2.构建 body 中的对输入流的处理
        for (let i = 0; i < compositeCall_list.length; i++) {
            let it = compositeCall_list[i];

            if (it instanceof compositeCallNode) {
                let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName);
                comp = deepCloneWithoutCircle(comp); //对 compositeNode 执行一次 copy 来避免静态流变量名替换时的重复写入
                let call = new compositeCallNode(null, it.compName, [splitStreams[i]], null);
                call.outputs = joinStreams[i];
                call.actual_composite = this.compositeCallStreamReplace(comp, [splitStreams[i]], [joinStreams[i]]);
                result.push(call);

            } else if (it instanceof splitjoinNode || it instanceof pipelineNode) {
                /* 若为splitjoin或者pipeline结构，赋予其输入和输出流 */
                /* NOTE: 这里的it 可能都为 splitjoinNode, 但是它们在 handlerAdd 中被 clone 过,所以不会有 重赋值 的问题 */
                it.inputs = [splitStreams[i]];
                it.outputs = [joinStreams[i]];
                result.push(it);
            }
        }
        //3.构建 join 节点
        result.push(this.MakeJoinOperator(joinStreams, node.split.arg_list, node.outputs));
        return result
    };


    /**
     * 构建出一个真实的 roundrobin 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
     * 例如
     * roundrobin(In) {
     *   work{
     *       int i=0,j=0;
     *		 for(i=0;i<1;++i)		round2_0[i]=dup0_1[j++];
     *		 for(i=0;i<1;++i)		round2_1[i]=dup0_1[j++];
     *   }
     *   window{
     *       dup0_1 sliding(2,2);
     *       round2_0 tumbling(1);
     *       round2_1 tumbling(1);
     *   }
     * }
     * @returns {operatorNode}
     */
    UnfoldComposite.prototype.MakeRoundrobinOperator = function (inputs, args, outputs) {
        /* duplicate  的参数被文法手册规定为全为1
         * Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
         * 如果不指定参数, 则默认都为1 */
        args = args || Array.from({ length: outputs.length }).fill(1);

        let work = MakeRoundrobinWork(inputs, args, outputs);
        let window = MakeRoundrobinWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let res = new operatorNode(null, "roundrobin", inputs, body);
        res.outputs = outputs;
        return res

        /**
         * 构建 Roundrobin 的 work 部分
         * FIXME:此处实现和杨飞不同, 仅仅是为了简单而对 work 使用字符串
         */
        function MakeRoundrobinWork(inputs, args, outputs) {
            let stmts = ["int i=0,j=0;"];
            outputs.forEach((name, idx) => {
                stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[j++];`);
            });
            let work = '{\n' + stmts.join('\n') + '\n}\n';
            return work
        }
        function MakeRoundrobinWindow(inputs, args, outputs) {
            //1. 构建 In sliding(2,2);
            let sum = args.reduce((a, b) => a + b);
            let arg_list = [sum, sum].map(num => new constantNode(null, num)); //Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
            let winStmts = [new winStmtNode(null, inputs[0], { type: 'sliding', arg_list })];

            //2. 循环构建 Out tumbling(1);
            outputs.forEach((name, idx) => {
                let arg_list = [new constantNode(null, args[idx])];
                winStmts.push(new winStmtNode(null, name, { type: 'tumbling', arg_list }));
            });
            return winStmts
        }
    };


    /**
     * 构建出一个真实的 duplicate 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
     * 例如
     * duplicate(In) {
     *   work{
     *       int i=0;
     *		 for(i=0;i<1;++i)		Out1[i]=In[i];
     *		 for(i=0;i<1;++i)		Out2[i]=In[i];
     *		 for(i=0;i<1;++i)		Out3[i]=In[i];
     *   }
     *   window{
     *       In sliding(1,1);
     *       Out1 tumbling(1);
     *       Out2 tumbling(1);
     *       Out3 tumbling(1);
     *   }
     * }
     * @returns {operatorNode}
     */
    UnfoldComposite.prototype.MakeDuplicateOperator = function (inputs, args, outputs) {
        args = args || Array.from({ length: outputs.length }).fill(1); //使用默认全都是1 , 实际上split duplicate()在小括号中不允许输入参数
        let work = MakeDuplicateWork(inputs, args, outputs);
        let window = MakeDuplicateWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let res = new operatorNode(null, "duplicate", inputs, body);
        res.outputs = outputs;
        return res

        /**
         * 构建 duplicate 的 work 部分
         * FIXME:此处实现和杨飞不同, 仅仅是为了简单而对 work 使用字符串
         */
        function MakeDuplicateWork(inputs, args, outputs) {
            let stmts = ["int i=0;"];
            outputs.forEach((name, idx) => {
                stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[i];`);
            });
            let work = '{\n' + stmts.join('\n') + '\n}\n';
            return work
        }
        function MakeDuplicateWindow(inputs, args, outputs) {
            //1. 构建 In sliding(1,1);
            let arg_list = [1, 1].map(num => new constantNode(null, num)); //duplicate 的参数被文法手册规定为1
            let winStmts = [new winStmtNode(null, inputs[0], { type: 'sliding', arg_list })];

            //2. 循环构建 Out1 tumbling(1);
            outputs.forEach(name => {
                winStmts.push(new winStmtNode(null, name, { type: 'tumbling', arg_list: arg_list.slice(1) }));
            });
            return winStmts
        }
    };


    /**
     * 构建出一个真实的 join 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
     * 例如
     * join(In1,In2) {
     *   work{
     *       int i=0;
     *		 int j=0;
     *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_0[i];
     *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_1[i];
     *		 for(i=0;i<1;++i)		Out[j++]=Dstream0_2[i];
     *   }
     *   window{
     *       Dstream0_0 sliding(1,1);
     *       Dstream0_1 sliding(1,1);
     *       Dstream0_2 sliding(1,1);
     *       Out tumbling(3);
     *   }
     * }
     * @returns {operatorNode} 
     */
    UnfoldComposite.prototype.MakeJoinOperator = function (inputs, args, outputs) {
        args = args || Array.from({ length: inputs.length }).fill(1); //join roundrobin()在小括号中不输入参数的话默认全都是1

        let work = MakeJoinWork(inputs, args, outputs);
        let window = MakeJoinWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let res = new operatorNode(null, "join", inputs, body);
        res.outputs = outputs;
        return res

        /**
         * 构建 join 的 work 部分
         * FIXME:此处实现和杨飞不同, 仅仅是为了简单而对 work 使用字符串
         */
        function MakeJoinWork(inputs, args, outputs) {
            let stmts = ["int i=0,j=0;"];
            inputs.forEach((name, idx) => {
                stmts.push(`for(i=0;i<${args[idx]};++i)  ${outputs[0]}[j++] = ${name}[i];`);
            });
            let work = '{\n' + stmts.join('\n') + '\n}\n';
            return work
        }
        function MakeJoinWindow(inputs, args, outputs) {
            //每行一个形如 In sliding(1,1) 的 winStmt
            let winStmts = inputs.map((name, idx) => {
                let arg_list = [args[idx], args[idx]].map(num => new constantNode(null, num)); //一般情况下为 sliding(1,1), 也兼容其它 arg. 转为 constantNode 为后续SetFlatNodesWeights做准备
                return new winStmtNode(null, name, { type: 'sliding', arg_list })
            });
            //加入末尾的输出, 形如 Out tumbling(3) 其中的数字是 args 的总和
            let sum = args.reduce((a, b) => a + b);
            winStmts.push(new winStmtNode(
                null,
                outputs[0],
                { type: 'tumbling', arg_list: [new constantNode(null, sum)] })
            );
            return winStmts
        }
    };

    function streamFlow(/* compositeNode */ main) {
        var body_stmt = main.body.stmt_list;

        for (var stmt of body_stmt) {
            let it = stmt instanceof binopNode ? stmt.right : stmt; //获取到要处理的 operator(){}
          
            if (it instanceof compositeCallNode) {
                let comp = COStreamJS.S.LookUpCompositeSymbol(it.compName);
                comp = deepCloneWithoutCircle(comp);
                it.actual_composite = unfold.streamReplace(comp,it.inputs,it.outputs, 1);
            }

        }
    }

    /*
     *  功能：将抽象语法树转为平面图
     *  输入参数：gMaincomposite
     *  streamFlow：对所有Main composite的composite调用进行实际流边量名的替换
     *  GraphToOperators：递归的调用，完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
     *  SetTopNode：设置顶层节点
     *  ResetFlatNodeNames：给所有的图节点重命名
     *  SetFlatNodesWeights：设置静态数据流图的peek，pop，push值
     *  输出：静态数据流图ssg
     */
    function AST2FlatStaticStreamGraph(mainComposite,unfold){
        var ssg = new StaticStreamGraph();
        streamFlow(mainComposite);
        debug$1("--------- 执行GraphToOperators, 逐步构建FlatNode ---------------\n");
        GraphToOperators(mainComposite, ssg, unfold);
        ssg.topNode = ssg.flatNodes[0];
        /* 将每个composite重命名 */
        ssg.ResetFlatNodeNames();
        ssg.SetFlatNodesWeights();
        debug$1("--------- 执行AST2FlatStaticStreamGraph后, 查看静态数据流图 ssg 的结构中的全部 FlatNode ---------\n",ssg);
        return ssg
    }

    /*
    * 功能：递归的调用，
    * 完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
    * 输入参数：composite
    * 输出：设置静态数据流图的对应flatNode节点，完成数据流边到flatNode节点的映射
    */

    /**
     * 1.遇到 out = call(in){ int / work / window } 形式的 operatorNode, 则在 ssg 中创建该 flatNode 并连接Edge
     * 2.遇到 pipeline 或 splitjoin , 则将其展开为一个真正的 composite 并挂载至 exp.replace_composite
     * 
     * @param {StaticStreamGraph} ssg
     */
    function GraphToOperators(/*compositeNode*/composite, ssg, unfold){
        for (let it of composite.body.stmt_list){
            
            let exp = it instanceof binopNode ? it.right : it; //获取到要处理的 operator(){}或 pipeline()或其他,无论是直接调用还是通过 binopNode 的 right 来调用

            if(exp instanceof operatorNode){
                ssg.GenerateFlatNodes(exp);

            }else if(exp instanceof compositeCallNode){
                GraphToOperators(exp.actual_composite, ssg, unfold);

            }else if(exp instanceof splitjoinNode){
                exp.replace_composite = unfold.UnfoldSplitJoin(exp);
                GraphToOperators(exp.replace_composite, ssg, unfold);

            }else if(exp instanceof pipelineNode){
                exp.replace_composite = unfold.UnfoldPipeline(exp);
                GraphToOperators(exp.replace_composite, ssg, unfold);
            }
        }
    }

    class SymbolTable{
        constructor(program){
            this.compTable = new Map();
            program.filter(node=> node instanceof compositeNode).forEach(node=>{
                this.compTable.set(node.compName,node);
            });
        }
        LookUpCompositeSymbol(name){
            return this.compTable.get(name)
        }
    }

    /**
     * 对 ssg 中的 flatNode 进行工作量估计
     * @param {StaticStreamGraph} ssg
     */
    function WorkEstimate(ssg)
    {
        for (let flat of ssg.flatNodes)
        {
            /* 检查每一个operatorNode的body（包括init，work和window)*/
            var body = flat.contents.operBody;
            var w_init = 0;//body.init ? body.init.WorkEstimate(): 0 ;
            var w_steady = (body.work + '').match(/\w+|[-+*/=<>?:]/g).length *10; //body.work ? body.work.WorkEstimate() : 0;
            w_steady += (flat.outFlatNodes.length + flat.inFlatNodes.length) * 20; //多核下调整缓冲区head和tail
            ssg.mapInitWork2FlatNode.set(flat, w_init);
            ssg.mapSteadyWork2FlatNode.set(flat, w_steady);
        }
    }

    /**
     * 数据流图调度
     * @param {StaticStreamGraph} - ssg
     */
    function ShedulingSSG(ssg){
        InitScheduling(ssg);
        SteadyScheduling(ssg);
        debug$1("---稳态调度序列---\n");
        console.log(ssg.flatNodes.map(n=>({ name: n.name, steadyCount: n.steadyCount})));
    }
    function InitScheduling(ssg){
        ssg.flatNodes.forEach(n => n.initCount = 0);
    }
    function SteadyScheduling(ssg){
        // 默认第一个节点是源，也就是说peek和pop均为0,在图的表示上暂不允许有多个源，但可以有多个peek = pop = 0节点
        var up = ssg.topNode, down , flats = [up];
        up.steadyCount = 1;
        //BFS 遍历 ssg.flatNodes
        while(flats.length !== 0){
            up = flats.shift();  
            for(let i = 0 ;i < up.outFlatNodes.length; i++){
                let nPush = up.outPushWeights[i];    // 上端节点的push值
                down = up.outFlatNodes[i];           // 找到下端节点
                let j = down.inFlatNodes.indexOf(up);    // 下端节点找到与上端节点对应的标号
                let nPop = down.inPopWeights[j];     // 下端节点取出对应的pop值

                // 检查down节点是否已进行稳态调度
                if( !down.steadyCount ){
                    //若 down 之前未调度过
                    let x = up.steadyCount;
                    nPush *= x;
                    if(nPush !== 0){
                        let scale = lcm(nPush,nPop) / nPush; //放大倍数
                        ssg.flatNodes.forEach(n=>{
                            if(n.steadyCount) n.steadyCount *= scale;
                        });
                        down.steadyCount = lcm(nPush, nPop) / nPop;
                    }else{
                        throw new Error("一般的 up 节点的 push 值不会为0")
                    }
                }else{
                    //若 down 节点已进行稳态调度，检查SDF图是否存在稳态调度系列，一般不存在的话表明程序有误
                    if(nPush * up.steadyCount !== nPop * down.steadyCount){
                        throw new Error("调度算法出错, 请检查")
                    }
                }
                flats.push(down);
            }
        }
    }

    //求a,b的最大公约数
    function gcd(a,b){
        return b ? gcd(b, a%b ) : a
    }
    //求a,b的最小公倍数
    function lcm(a,b){
        return a*b / gcd(a,b)
    }

    var dotString = '';


    /**
     * 用XML文本的形式描述SDF图
     * @param { StaticStreamGraph } ssg
     * @param { Partition } mp
     * @returns { String }
     */
    function DumpStreamGraph(ssg, mp) {
        dotString = "digraph Flattend {\n";
        let isVisited = new Map();
        toBuildOutPutString(ssg.topNode, ssg,isVisited,mp);
        dotString += "\n\n}\n";
        return dotString.beautify()
    }

    function toBuildOutPutString(/*FlatNode*/ node,ssg, isVisited, mp) {
        isVisited.set(node, true);
        dotString += MyVisitNode(node,ssg,mp);
        node.outFlatNodes.filter(out => !isVisited.get(out)).forEach(out => {
            toBuildOutPutString(out, ssg,isVisited, mp);
        });
    }

    const colors = ["aliceblue", "antiquewhite", "yellowgreen", "aquamarine",
        "azure", "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid"];

    function MyVisitNode(node,ssg,mp){
        let str = `name[ label = "name \\n init Mult: initMult steady Mult: steadyMult \\n init work: initWork steady work:steadyWork \\n  PPP \\n" color="azure" style="filled"  ]\n\n`;
        str = str.replace(/name/g,node.name);
        str = str.replace(/initMult/,node.initCount);
        str = str.replace(/steadyMult/, node.steadyCount);
        str = str.replace(/initWork/, ssg.mapInitWork2FlatNode.get(node));
        str = str.replace(/steadyWork/, ssg.mapSteadyWork2FlatNode.get(node));

        let peek = node.inPeekWeights.map(w => " peek: "+w);
        let pop  = node.inPopWeights.map(w => " pop: " + w);
        let push = node.outPushWeights.map(w => " push: " + w);
        let ppp = [peek,pop,push].filter(s=>s.length>0).join('\\n');
        str = str.replace(/PPP/,ppp);

        if(mp){
            let id = mp.findPartitionNumForFlatNode(node);
            str = str.replace(/azure/,colors[id]);
        }

        //链接输出边
        node.outFlatNodes.forEach((out,idx) =>{
            str += node.name + '->' + out.name + `[label="${node.outPushWeights[idx]}"];\n\n`;
        });
        return str
    }

    /**
     * SDF 图划分算法的基类, 子类需要继承此类并实现对应方法
     */
    class Partition {
        constructor() {
            /** @type {map<FlatNode,number>} 节点到划分编号的映射 */
            this.FlatNode2PartitionNum = new Map();

            /** @type {map<number,FlatNode[]>} 划分编号到节点集合的映射 */
            this.PartitonNum2FlatNode = new Map();

            /** @type {map<number, number>} 划分编号到通信量的映射 */
            this.PartitonNum2Communication = new Map();

            /** @type {number} 核数 */
            this.mnparts = 1;

            /** @type {number} 最终划分的份数,因为划分算法的极端情况下可能用不完全部的核 */
            this.finalParts = 0;

            /** @type { number } 总工作量 */
            this.totalWork = 0;
        }
        /**
         * 划分成员方法，具体实现由子类实现
         */
        SssgPartition(ssg, level) {
            throw new Error("不能调用基类的 SssgPartition 算法, 请在子类中实现该算法")
        }
        /**
         * 根据flatnode找到其下标号 如source_0中的0
         */
        findID(/* FlatNode */ flat) {
            return flat.name.match(/\d+$/g)[0]
        }
        /**
         * 根据编号num查找其中的节点，将节点集合返回给PartitonNumSet(编号->节点)
         */
        findNodeSetInPartition(num) {
            return this.PartitonNum2FlatNode.get(num)
        }
        /**
         * 根据节点返回其所在划分区的编号(节点->编号) for dot
         */
        findPartitionNumForFlatNode(/* FlatNode */ flat) {
            return this.FlatNode2PartitionNum.get(flat)
        }
        /**
         * 划分完毕后计算通信量
         */
        computeCommunication() {
            for (let [core, Xi] of this.PartitonNum2FlatNode) {
                let communication = 0;
                for (let flat of Xi) {
                    //如果flat的上端节点不在此Xi中则累计通信量
                    flat.inFlatNodes.forEach((src, idx) => {
                        if (!Xi.includes(src)) {
                            communication += flat.inPopWeights[idx] * flat.steadyCount;
                        }
                    });
                    //如果flat的下端节点不在此Xi中则累计通信量
                    flat.outFlatNodes.forEach((out, idx) => {
                        if (!Xi.includes(out)) {
                            communication += flat.outPushWeights[idx] * flat.steadyCount;
                        }
                    });
                }
                //将该子图的通信量保存下来
                this.PartitonNum2Communication.set(core, communication);
            }
        }
    }

    class GreedyPartition extends Partition {
        constructor() {
            super();

            /** @type { vector<vector<FlatNode *>> }  划分的结果 */
            this.X = [];

            /** @type { number[] } 划分的K个子图每个子图的总工作量 */
            this.w = [];

            /** @type { number[] } 划分的K个子图每个子图的通信边的权重 */
            this.edge = [];

            /** @type { number[] } 每个顶点的权重(总工作量) */
            this.vwgt = [];

            /** @type { FlatNode[] } 候选节点的集合 */
            this.S = [];

            /** @type { number } 节点的个数 */
            this.nvtxs = 0;

            /** @type { number } 平衡因子 */
            this.ee = 1.1;

            /** @type { Map<FlatNode,string> } 每个节点对应的状态 */
            this.FlatNodeToState = new Map();
        }
        /**
         * 输入一个 flat, 返回该 flat 被 GAP 划分到的核号
         */
        getPart(flat) {
            return this.X.findIndex(nodes => nodes.includes(flat))
        }
        /**
         * 输入 i, 返回 i 号子图的总工作量
         */
        getPartWeight(i) {
            return this.w[i]
        }
        /**
         * 输入 i,返回 i 号子图总通信量
         */
        getPartEdge(i) {
            return this.edge[i]
        }
        setCpuCoreNum(num) {
            this.mnparts = num;
            this.X = Array.from({ length: num }).map(_ => []);
            this.w = Array.from({ length: num }).fill(0);
        }
    }

    /**
     * 执行划分算法, 统计 ssg 中 flatNode 的工作量,作初始划分, 并计算通信量等数据, 最终将划分结果存入 this.X 中
     * @param { StaticStreamGraph } ssg
     */
    GreedyPartition.prototype.SssgPartition = function (ssg) {
        if (this.mnparts == 1) {
            this.X = [ssg.flatNodes]; // 此时 X 的长度为1, 下标0对应了全部的 flatNodes
        } else {
            this.nvtxs = ssg.flatNodes.length;
            this.setActorWorkload(ssg);
            this.doPartition(ssg);
            this.orderPartitionResult();
        }
        //将 X 的信息保存至 Partion 基类的两个 map 中
        this.X.forEach((flatNodes, coreNum) => {
            flatNodes.forEach(flat => {
                this.FlatNode2PartitionNum.set(flat, coreNum);
            });
            this.PartitonNum2FlatNode.set(coreNum, flatNodes);
        });
    };
    /**
     * 设置每个节点的权重(实际上对每个节点: 权重 = 工作量*调度次数)
     */
    GreedyPartition.prototype.setActorWorkload = function (ssg) {
        ssg.flatNodes.forEach((flat, idx) => {
            this.vwgt[idx] = flat.steadyCount * ssg.mapSteadyWork2FlatNode.get(flat);
            flat.vwgt = this.vwgt[idx];
            this.totalWork += this.vwgt[idx];
        });
    };
    /**
     * 正式的划分过程
     */
    GreedyPartition.prototype.doPartition = function (ssg) {
        this.X[0] = ssg.flatNodes.slice(); //首先划分全部点到0号核上
        let we = this.totalWork / this.mnparts; //每个子图平均工作量
        let e = 2 - this.ee;                //满足系数（2-ee）即可 
        this.w[0] = this.totalWork;

        for (let i = 1; i < this.mnparts; i++) {
            //开始构造子图 X[1] ~ X[n-1]
            this.S.length = 0;
            while (this.w[i] < we * e && this.X[0].length > 0) {
                if (this.S.length === 0) {
                    //如果候选集合为空,选择X[0]中顶点权重最大的节点
                    var chooseFlat = this.X[0].reduce((a, b) => a.vwgt >= b.vwgt ? a : b);
                } else {
                    //如果候选集合 S 不为空, 则选择 S 中收益函数值最大的节点
                    var chooseFlat = this.chooseMaxGain(this.X[i]);
                    this.S.splice(this.S.indexOf(chooseFlat), 1); //从 S 中删除
                }
                this.w[0] -= chooseFlat.vwgt;
                this.X[0].splice(this.X[0].indexOf(chooseFlat), 1);
                this.X[i].push(chooseFlat);  //将该节点加入 X[i]子图
                this.w[i] += chooseFlat.vwgt; //维护 X[i]子图的工作量
                this.updateCandidate(ssg, chooseFlat);
            }
        }
    };

    /**
     * 移动一个节点后更新 候选节点集合S.
     * @summary 遍历chooseFlat 的所有上端节点&&下端节点, 如果该节点 在X[0]中 && 不在 S 中,则将它加入 S
     * @param { FlatNode } chooseFlat
     */
    GreedyPartition.prototype.updateCandidate = function (ssg, chooseFlat) {
        let srcs = chooseFlat.inFlatNodes.filter(flat => this.X[0].includes(flat) && !this.S.includes(flat));
        let dests = chooseFlat.outFlatNodes.filter(flat => this.X[0].includes(flat) && !this.S.includes(flat));
        this.S = this.S.concat(srcs, dests);
    };

    /**
     * 选择 S 中增益函数最大的节点
     * @description 增益函数 : 用 increase 表示减少与 Xi 子图通信带来的增益 ,
     *                        用 decrease 表示增加与 X[0] 的通信来带的损失,
     *                        则 increase - decrease 就是增益函数
     */
    GreedyPartition.prototype.chooseMaxGain = function (Xi) {
        let gains = [];
        for (let i in this.S) {
            let flat = this.S[i];
            let increase = 0, decrease = 0;

            flat.inFlatNodes.forEach((src, idx) => {
                if (this.X[0].includes(src)) decrease += flat.steadyCount * flat.inPopWeights[idx];
                if (Xi.includes(src)) increase += flat.steadyCount * flat.inPopWeights[idx];
            });
            flat.outFlatNodes.forEach((out, idx) => {
                if (this.X[0].includes(out)) decrease += flat.steadyCount * flat.outPushWeights[idx];
                if (Xi.includes(out)) increase += flat.steadyCount * flat.outPushWeights[idx];
            });
            gains[i] = increase - decrease;
        }
        let max = gains.indexOf(Math.max(...gains));
        return this.S[max]
    };

    /**
     * 按子图负载由大到小排序,选择排序算法
     */
    GreedyPartition.prototype.orderPartitionResult = function () {
        this.X.forEach((flats, idx) => flats.w = this.w[idx]);
        this.X.sort((a, b) => b.w - a.w);
        this.w.sort((a, b) => b - a);
        this.X = this.X.filter(flats => flats.length != 0); //过滤掉不含节点的子图
        this.finalParts = this.X.length;
    };

    /**
     * 计算加速比信息, 返回一个格式化的 Object
     */
    function GetSpeedUpInfo(ssg, mp, sourceFileName = "default.cos", pSelected = "GAPartition") {
        let SpeedUpInfo = { pSelected, sourceFileName, finalParts: mp.finalParts };
        SpeedUpInfo.date = new Date().toLocaleString();

        let PartitionInfo = [];
        for (var [core, communication] of mp.PartitonNum2Communication) {
            let info = {
                part: core,
                workload: mp.w[core],
                percent: (100 * mp.w[core] / mp.totalWork).toFixed(2) + '%',
                communication: communication
            };
            PartitionInfo.push(info);
        }

        let Detail = [];
        ssg.flatNodes.forEach((flat, idx) => {
            let workload = ssg.mapSteadyWork2FlatNode.get(flat) * flat.steadyCount;
            Detail.push({
                part: idx,
                actor: flat.name,
                workload: workload,
                percent: (workload * 100 / mp.totalWork).toFixed(2) + '%'
            });
        });

        let TotalInfo = {
            totalWorkload: mp.totalWork,
        };
        TotalInfo.totalCommunication = PartitionInfo.reduce((sum,info) => sum + info.communication, 0);
        TotalInfo.maxWorkload = PartitionInfo.reduce((max,info) => info.workload > max.workload ? info : max).workload;
        TotalInfo.maxSpeedUp = (TotalInfo.totalWorkload / TotalInfo.maxWorkload).toFixed(2);

        Object.assign(SpeedUpInfo, { PartitionInfo, Detail, TotalInfo });
        return SpeedUpInfo
    }
    /**
     * 输入一个加速比信息的 Object, 返回它的格式化字符串
     */
    function PrintSpeedUpInfo(SpeedUpInfo) {
        if (!SpeedUpInfo) console.warn("SpeedUpInfo 为空");

        let header =`-------- default.cos - GAPartition(4) DATE -----------\n`;
        header = header.replace("default.cos", SpeedUpInfo.sourceFileName);
        header = header.replace("GAPartition", SpeedUpInfo.pSelected);
        header = header.replace("4", SpeedUpInfo.finalParts);
        header = header.replace("DATE", SpeedUpInfo.date);

        let partitionStr =
            `#######################  Partition info  ##########################
part            workload             percent      communication\n`;
        SpeedUpInfo.PartitionInfo.forEach(info=>{
            let line = info.part + setw(info.workload,23) + setw(info.percent,19);
            line += setw(info.communication,20);
            partitionStr += line +'\n';
        });

        let detailStr = `######################## Detail ###################################
part               actor             workload           percent\n`;
        SpeedUpInfo.Detail.forEach(info=>{
            let line = info.part + setw(info.actor, 23) + setw(info.workload, 19);
            line += setw(info.percent, 20);
            detailStr += line + '\n';
        });

        let totalStr = `##################### total info ###############################\n`;
        for(let key in SpeedUpInfo.TotalInfo){
            totalStr += key.padEnd(20) + '=    ' + SpeedUpInfo.TotalInfo[key] + '\n';
        }

        return header+ partitionStr + '\n' + detailStr + '\n' + totalStr
    }

    /**
     * 在字符串 str 左边填充空格使得整个字符串具有 num 指定的长度
     */
    function setw(str = '', num = 20) {
        str = str + '';
        if (str.length > num) {
            console.warn("[ComputeSpeedUp.js] setw 的 str 字符串较长, 影响排版");
            console.trace();
        }
        return str.padStart(num)
    }

    /**
     * 执行阶段赋值, 为ssg 中的每个 flatNode 添加 stageNum 字段
     * @param { StaticStreamGraph } ssg
     * @param { Partition } mp
     * @returns { number } MaxStageNum - 最大阶段号
     */
    function StageAssignment(ssg, mp) {
        //第一步根据SDF图的输入边得到拓扑序列，并打印输出
        COStreamJS.topologic = actorTopologicalorder(ssg.flatNodes);
        //第二步根据以上步骤的节点划分结果，得到阶段赋值结果
        return actorStageMap(mp.FlatNode2PartitionNum, COStreamJS.topologic);
    }

    /**
     * 拓扑排序算法, 输入一组 flatNode 的 list, 在不改变其中数据的情况下, 返回拓扑排序后的 list
     */
    function actorTopologicalorder(flatNodes) {
        let flats = flatNodes.slice();   //初始 flatNode 集合
        let topologic = new Set(); //拓扑排序集合, 使用 Set 是为了判断 has 的时候更快

        while (flats.length) {
            //寻找没有前驱的节点(入度为0, 或它的上端节点都已经被拓扑过了)
            let head = flats.find(flat => {
                return flat.inFlatNodes.length == 0 ||
                    flat.inFlatNodes.every(src => topologic.has(src))
            });
            if (!head) {
                throw new Error("[StageAssignment.js] 算法或SDF图出错,这里 head 不应该为空")
            }
            //找到该前驱节点后,将它加入 topologic 拓扑排序序列,并从初始集合中移出
            topologic.add(head);
            flats.splice(flats.indexOf(head), 1);

        }

        return [...topologic]
    }

    /**
     * 根据拓扑排序结果、获得阶段赋值结果
     * 若节点和其输入节点在一个划分子图，则其阶段号一致; 否则阶段号=上端最大阶段号+1
     * @param { map<FlatNode,int> } map - mp.FlatNode2PartitionNum
     */
    function actorStageMap(map, topologic) {
        let maxstage = 0; //初始阶段号
        topologic.forEach(flat => {
            //判断该节点是否和其输入节点都在一个划分子图
            let isInSameSubGraph = flat.inFlatNodes.every(src => map.get(src) == map.get(flat));

            //获取它的入节点的最大阶段号
            maxstage = flat.inFlatNodes.length > 0 ? Math.max(...flat.inFlatNodes.map(f => f.stageNum)) : 0;

            //如果有上端和自己不在同一子图的话,就要让阶段号+1
            flat.stageNum = isInSameSubGraph ? maxstage : maxstage + 1;
        });

        //返回总共有几个阶段, 例如阶段号分别是0,1,2,3,那么要返回一共有"4"个阶段
        return maxstage + 1
    }

    var str1 =`
struct source{
	int buffer[workLen];
};
RingBuffer<source> ringBuffer(1024,sizeof(source));
int workExecuteTimes=0;

void* thread_io_fun_start(void *arg)
{
	source iobuff;
	ifstream inSource("input.bin",ios::binary);
	for(int i=0;i<workExecuteTimes;i++)
	{
		inSource.read((char*)iobuff.buffer,sizeof(int)* workLen);
		while(!ringBuffer.write((char*)&iobuff));
	}
	return 0;
}`;
    var str2 = `
ifstream in("input.bin",ios::binary);
in.seekg(0,ios::end);
int length = in.tellg();
in.seekg(0,ios::beg);
workExecuteTimes=length/(sizeof(int)*workLen);
MAX_ITER = (workExecuteTimes-initworkcount)/steadyworkcount;
`;
    var str3=`
if(!ringBuffer.Initialize())
{
    return -1;
}
pthread_t th;
int ret = pthread_create (&th, NULL, thread_io_fun_start, (void*)NULL);
`;
    var str4 = `
ret = pthread_join(th,NULL);
if(ret!=0)
{
    cout<<"join error"<<endl;
    return -1;
}
`;
    function getIOHandlerStrings(workLen,initworkcount,steadyworkcount){
        str1 = str1.replace(/workLen/g, workLen);
        str1 = str1.replace(/initworkcount/, initworkcount).replace(/steadyworkcount/, steadyworkcount);
        str2 = str2.replace(/workLen/g, workLen);
        return [str1,str2,str3,str4]
    }

    class X86CodeGeneration {

        constructor(nCpucore, ssg, mp) {

            this.nCpucore = nCpucore;
            /**@type {StaticStreamGraph} */
            this.ssg = ssg;
            /**@type {Partition} */
            this.mp = mp;

            /** @type {Map<string,bufferSpace>} 字符串到对应的缓冲区的映射 */
            this.bufferMatch = new Map();

            /** @type {Map<string,int>} 缓冲区到对应缓冲区类型的映射，通过这个来判断调用consumer和producer哪种方法 */
            this.bufferType = new Map();

            /** @type {Map<number,number[]>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
            this.mapNum2Stage = new Map();
        }
    }

    class bufferSpace {
        constructor(original, instance, buffersize, buffertype, copySize = 0, copyStartPos = 0) {
            /** @type {string} 原始缓冲区的名称 */
            this.original = original;
            /** @type {string} 实际对应的缓冲区名称 */
            this.instance = instance;
            /** @type {int} 分配缓冲区的大小 */
            this.buffersize = buffersize;
            /** @type {int} 分配缓冲区的类型，是否可复用，0代表未分配，1代表不可复用，2代表可复用 */
            this.buffertype = buffertype;
            /** FIXME用来标识流的类型,未完成 */
            this.classification = 'int_x';
            this.copySize = copySize;
            this.copyStartPos = copyStartPos;
        }
    }

    X86CodeGeneration.prototype.CGMakefile = function () {
        var buf = `
    PROGRAM := a.out
    SOURCES := $(wildcard ./*.cpp)
    SOURCES += $(wildcard ./src/*.cpp)
    OBJS    := $(patsubst %.cpp,%.o,$(SOURCES))
    CC      := g++
    CFLAGS  := -ggdb -Wall 
    INCLUDE := -I .
    LIB     := -lpthread -ldl

    .PHONY: clean install
    $(PROGRAM): $(OBJS)
    \t$(CC) -o $@ $^ $(LIB)
    %.o: %.c
    \t$(CC) -o $@ -c $< $(CFLAGS) $(INCLUDE)
    clean:
    \trm $(OBJS) $(PROGRAM) -f
    install: $(PROGRAM)
    \tcp $(PROGRAM) ./bin/
    `;
        COStreamJS.files['Makefile'] = buf;
    };

    X86CodeGeneration.prototype.CGGlobalvar = function () {
        var buf = `#include "GlobalVar.h" \n`;
        for (let node of COStreamJS.ast) {
            if (node instanceof declareNode) {
                buf += node.toString() + ';\n';
            }
        }
        COStreamJS.files['GlobalVar.cpp'] = buf;
    };

    X86CodeGeneration.prototype.CGGlobalvarHeader = function () {
        var buf = `#ifndef GLOBALVAL_H\n`;
        buf += `#define GLOBALVAL_H\n`;
        for (let node of COStreamJS.ast) {
            if (node instanceof declareNode) {
                let str = node.toString().replace(/=\s*\{[^}]*}/g, ''); //去除 a[3] = {1,2,3} 的赋值部分
                str = str.replace(/=[^,]+/g, '');            //去除 a = 2 的赋值部分
                buf += "extern " + str + ';\n';
            }
        }
        COStreamJS.files['GlobalVar.h'] = buf + `#endif`;
    };

    /**
     * 生成stream流类型和全局数据流缓存区的声明
     * @description 边的命名规则：A_B,其中A->B
     */
    X86CodeGeneration.prototype.CGGlobalHeader = function () {
        var buf = `
    #ifndef _GLOBAL_H
    #define _GLOBAL_H
    #include "Buffer.h"
    #include <math.h>
    #include <string>
    using namespace std;
    `;

        //遍历所有compositeNode的streamType，找到流中所有包含的数据类型，作为结构体streamData中的数据
        //FIXME: 目前符号表未完成, 所以暂时假设所有的流都是同一种数据类型,因此只取一个 streamDcl 来填充至 streamData
        var typeSet = [];
        for (let comp of COStreamJS.ast.filter(node => node instanceof compositeNode)) {
            for (let stmt of comp.body.stmt_list) {
                if (stmt instanceof declareNode && stmt.type instanceof strdclNode) {
                    typeSet = typeSet.concat(stmt.type.id_list);
                }
            }
        }
        //数组去重 由[{type:'int', identifier:'x'}] 先转为字符串形式的 [ 'int x' ] 来完成去重, 再给后面调用
        typeSet = typeSet.map(o => o.type + ' ' + o.identifier);
        typeSet = [...new Set(typeSet)];
        typeSet = typeSet.map(str => ({ type: str.match(/\S+/g)[0], identifier: str.match(/\S+/g)[1] }));
        //写入数据流数据类型结构体
        buf += "struct streamData{\n";
        for (let it of typeSet) {
            buf += it.type + ' ' + it.identifier + ';';
        }
        buf += "};\n\n";
        //声明流边
        for (let flat of this.ssg.flatNodes) {
            for (let nextFlat of flat.outFlatNodes) {
                var edgename = flat.name + '_' + nextFlat.name;
                buf += `extern Buffer<streamData>${edgename};\n`;
            }
        }
        buf += `\n#endif\n`;
        COStreamJS.files['Global.h'] = buf.beautify();
    };

    /**
     * 生成 Global.cpp  用于存储边的信息
     */
    X86CodeGeneration.prototype.CGGlobal = function () {
        var buf = `
#include "Buffer.h"
#include "Global.h"
#include <vector>
using namespace std;\n
    `;
        for (let flat of this.ssg.flatNodes) {
            for (let out of flat.outFlatNodes) {
                let stageminus = out.stageNum - flat.stageNum; //发送方和接受方的软件流水阶段差
                let edgePos = flat.outFlatNodes.indexOf(out); // out 在 flat 的输出边的序号
                let perSteadyPushCount = flat.steadyCount * flat.outPushWeights[edgePos];//发送actor每次调用steadywork需要push的个数
                let copySize = 0, copyStartPos = 0;    //拷贝的数据大小，copy存放的开始位置

                let inEdgeIndex = out.inFlatNodes.indexOf(flat); // out节点中 flat 对应的这条边的下标
                let perWorkPeekCount = out.inPeekWeights[inEdgeIndex]; //接收边actor每次peek的个数,b
                let perWorkPopCount = out.inPopWeights[inEdgeIndex];  //接收边actor每次调用work需要pop的个数
                let init1 = flat.initCount * flat.outPushWeights[edgePos]; //发送actor调用initwork产生的数据量
                let init2 = out.initCount * perWorkPopCount; //接受actor的数据量
                let size = init1 + perSteadyPushCount * (stageminus + 2); //缓冲区的大小
                if (perWorkPeekCount === perWorkPopCount) {
                    if (perSteadyPushCount) {
                        copySize = (init1 - init2) % perSteadyPushCount;
                        copyStartPos = init2 % perSteadyPushCount;
                    }
                } else {
                    //peek != pop 情况的特殊处理, 目前测试用例无此种情况, 需对这方面单独测试, 目前不保证下面5代码的正确性 FIXME
                    let leftnum = ((init1 - init2) % perSteadyPushCount + perSteadyPushCount - (perWorkPeekCount - perWorkPopCount) % perSteadyPushCount) % perSteadyPushCount;
                    copySize = leftnum + perWorkPeekCount - perWorkPopCount;
                    let addtime = copySize % perSteadyPushCount ? copySize / perSteadyPushCount + 1 : copySize / perSteadyPushCount;
                    copyStartPos = init2 % perSteadyPushCount;
                    size += addtime * perSteadyPushCount;
                }

                /* 优先构建那些很明显不能被复用的边:
                 * 1. peak != pop 的
                 * 2. copySize 或 copyStartPos 不为0的 
                 * 3. 上下游有阶段差的 */
                if (perWorkPeekCount != perWorkPopCount || copySize || copyStartPos || stageminus) {
                    let edgename = flat.name + '_' + out.name; //边的名称
                    this.bufferMatch.set(edgename, new bufferSpace(edgename, edgename, size, 1,copySize,copyStartPos));
                }
            }
        }

        //为同一核上可以共享内存的缓冲区分配内存
        this.shareBuffers();

        //检查是否有缓冲区没有分配, 若分配了, 则加入返回字符串中
        for (let flat of this.ssg.flatNodes) {
            for (let out of flat.outFlatNodes) {
                let edgename = flat.name + '_' + out.name;
                if (!this.bufferMatch.has(edgename)) {
                    throw new Error('有缓冲区未分配, 程序异常, 请联系管理员')
                } else {
                    let b = this.bufferMatch.get(edgename);
                    let str = `Buffer<streamData>${edgename}(${b.buffersize},${b.copySize},${b.copyStartPos});`;
                    if (b.original !== b.instance) {
                        str = '//' + str + `  该缓冲区复用了${b.instance}的内存`;
                    }
                    buf += str + '\n';
                }
            }
        }
        COStreamJS.files['Global.cpp'] = buf.beautify();
        debugger

    };

    /**
     * 为同一核上可以共享内存的缓冲区分配内存
     * @description 根据拓扑排序模拟运行各个CPU上的计算节点找出可以被复用的缓冲区
     */
    X86CodeGeneration.prototype.shareBuffers = function () {
        //获取 核号 => 该核上所有节点的拓扑排序 的 Map
        let processor2topoactors = this.GetProcessor2topoactors(this.mp.FlatNode2PartitionNum);
        for (let nodes of processor2topoactors.values()) {
            let vb = []; //用来存储在一次稳态调度中已经使用完的缓冲区

            //按拓扑排序访问各个节点
            nodes.forEach(flat => {
                flat.outFlatNodes.forEach((out, edgePos) => {
                    let edgename = flat.name + '_' + out.name;
                    if (this.bufferMatch.has(edgename)) { return }//如果该边为特殊缓冲区在之前已经分配完成则进入下一条边的分配

                    //计算所需要占用的缓冲区大小
                    let stageminus = out.stageNum - flat.stageNum;
                    let perSteadyPushCount = flat.steadyCount * flat.outPushWeights[edgePos];//稳态时产生的数据量
                    let size = perSteadyPushCount * (stageminus + 2);

                    //分配时首先搜索队列中是否有已经使用完的缓冲区,没有再自己分配内存，使用队列中的缓冲区要将其从队列中删除
                    if (vb.length) {
                        let sameClassification = vb.filter(b => b.classification === 'int_x');
                        if (sameClassification) {
                            let availableBuffer = sameClassification.find(b => b.buffersize >= size);
                            if (availableBuffer) {
                                //对当前可用缓冲区中最小的进行内存共享
                                let buffer = new bufferSpace();
                                buffer.original = edgename;
                                buffer.instance = availableBuffer.instance;
                                buffer.buffersize = availableBuffer.buffersize;
                                buffer.buffertype = 2;
                                this.bufferMatch.set(edgename, buffer);
                                vb.splice(vb.indexOf(availableBuffer), 1);
                            } else {
                                //若当前可用缓冲区大小都不符合要求则对最大缓冲区进行扩容
                                let maxBuffer = sameClassification.pop();
                                this.bufferMatch.get(maxBuffer.instance).buffersize = size;
                                this.bufferMatch.get(maxBuffer.original).buffersize = size;

                                let buffer = new bufferSpace();
                                buffer.original = edgename;
                                buffer.instance = maxBuffer.instance;
                                buffer.buffersize = size;
                                buffer.buffertype = 2;
                                this.bufferMatch.set(edgename, buffer);
                                vb.splice(vb.indexOf(availableBuffer), 1);
                            }
                        }
                    } else {
                        //找不到可以复用的缓冲区，自己进行分配
                        let buffer = new bufferSpace(edgename, edgename, size, 2);
                        this.bufferMatch.set(edgename, buffer);
                    }
                });

                //由于空闲缓冲区队列中的缓冲区与原始缓冲区存在映射关系，所以要更新其缓冲区大小
                vb.forEach(v => v.buffersize = this.bufferMatch.get(v.instance).buffersize);

                //当该节点内存分配完之后说明该节点执行完毕，可以将节点上游能够复用的缓冲区加入到队列中
                flat.inFlatNodes.forEach(src => {
                    let buffer = this.bufferMatch.get(src.name + '_' + flat.name);
                    if (buffer.buffertype == 2) {
                        vb.push(buffer);
                    }
                });

                //对 vb 进行排序, 按照 buffersize  升序排列
                vb.sort((a, b) => a.buffersize - b.buffersize);
            });
        }
    };

    /**
     * 输入一个保存了 FlatNode => 划分核号 的 Map, 返回 核号 => 该核上所有节点的拓扑排序 的 Map
     * @param {Map<FlatNode,number>} map 
     * @return {Map<number,FlatNode[]} processor2topoactors
     */
    X86CodeGeneration.prototype.GetProcessor2topoactors = function (map) {
        var processor2topoactors = new Map();
        for (let flat of COStreamJS.topologic) {
            let coreNum = map.get(flat);
            let set = processor2topoactors.get(coreNum) || [];
            processor2topoactors.set(coreNum, set.concat(flat));
        }
        return processor2topoactors
    };

    /**
     * 循环渲染一段字符串, 用 i 替换 $
     * 例如输入 str='extern_$' , start =0, end=3, 则渲染为 'extern_0 \n extern_1 \n extern_2'
     */
    function circleRender(str, start, end) {
        let result = '';
        for (let i = start; i < end; i++) {
            result += str.replace(/\$/g, i) + '\n';
        }
        return result
    }

    const workLen = 262144;
    X86CodeGeneration.prototype.CGMain = function () {
        var buf = `
#include <iostream>
#include <fstream>
#include <stdlib.h>
#include <pthread.h>
#include "setCpu.h"
#include "lock_free_barrier.h"	//包含barrier函数
#include "Global.h"
#include "RingBuffer.h"
using namespace std;
int MAX_ITER=1;//默认的执行次数是1

#SLOT1

${circleRender('extern void thread_$_func();', 0, this.nCpucore)}
${circleRender(`
void* thread_$_fun_start(void *)
{
	set_cpu($);
	thread_$_fun();
	return 0;
}
`, 1, this.nCpucore)}

int main(int argc,char **argv)
{
	void setRunIterCount(int,char**);
    setRunIterCount(argc,argv);
    #SLOT2
	set_cpu(0);
	allocBarrier(2);
	pthread_t tid[1];
    pthread_create (&tid[0], NULL, thread_1_fun_start, (void*)NULL);
    #SLOT3
    thread_0_fun();
    #SLOT4
	return 0;
}
//设置运行次数
void setRunIterCount(int argc,char **argv)
{
	int oc;
	char *b_opt_arg;
	while((oc=getopt(argc,argv,"i:"))!=-1)
	{
		switch(oc)
		{
			case 'i':
				MAX_ITER=atoi(optarg);
				break;
		}
	}
}
`;
        {
            let workcount = this.ssg.flatNodes[0].steadyCount;
            let IOHandler_strings = getIOHandlerStrings(workLen, 0, workcount);
            buf = buf.replace(/#SLOT1/, IOHandler_strings[0]);
            buf = buf.replace(/#SLOT2/, IOHandler_strings[1]);
            buf = buf.replace(/#SLOT3/, IOHandler_strings[2]);
            buf = buf.replace(/#SLOT4/, IOHandler_strings[3]);
        }
        COStreamJS.files['main.cpp'] = buf.beautify();
    };

    function codeGeneration(nCpucore, ssg, mp){
        var X86Code = new X86CodeGeneration(nCpucore, ssg, mp);
        X86Code.CGMakefile();        //生成Makefile文件
        X86Code.CGGlobalvar();       //生成流程序引入的全局变量定义文件 GlobalVar.cpp
        X86Code.CGGlobalvarHeader(); //生成流程序引入的全局变量的声明文件 GlobalVar.h
        X86Code.CGGlobalHeader();    //生成流程序的所有缓冲区声明Global.h
        X86Code.CGGlobal();          //生成流程序的所有缓冲区信息Global.cpp
        // X86Code.CGactors();          //生成以类表示的计算单元actor
        // X86Code.CGAllActorHeader();  //生成所有actor节点头文件
        // X86Code.CGThreads();         //生成所有线程
        X86Code.CGMain();            //生成线程启动的main文件
        //X86Code.CGFunctionHeader();  //生成function头文件
        //X86Code.CGFunction();        //生成function定义

        /* 拷贝程序运行所需要的库文件 */
        //string command = "cp " + origin_path + "/lib/* .";
        //system(command.c_str());
    }

    Object.assign(COStreamJS.__proto__, {
        parser,
        AST2FlatStaticStreamGraph,
        unfold,
        SemCheck,
        DumpStreamGraph,
        GreedyPartition,
        GetSpeedUpInfo,
        PrintSpeedUpInfo,
        StageAssignment,
        codeGeneration
    });
    COStreamJS.main = function(str){
        debugger
        this.ast = COStreamJS.parser.parse(str);
        this.S = new SymbolTable(this.ast);
        this.gMainComposite = this.SemCheck.findMainComposite(this.ast);
        this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold);
        WorkEstimate(this.ssg);
        ShedulingSSG(this.ssg);
        this.mp = new this.GreedyPartition(this.ssg);
        this.mp.setCpuCoreNum(4);
        this.mp.SssgPartition(this.ssg);
        this.mp.computeCommunication();
        let SI = this.GetSpeedUpInfo(this.ssg,this.mp);
        debug(this.PrintSpeedUpInfo(SI));
        this.MaxStageNum = this.StageAssignment(this.ssg,this.mp);
        this.files = {};
        this.codeGeneration(this.mp.finalParts,this.ssg,this.mp);
    };

    //下面代码是为了在浏览器的 window 作用域下调试而做的妥协
    COStreamJS.global = typeof window === "object" ? window : global;
    Object.assign(COStreamJS.global, utils);
    Object.assign(COStreamJS.global, NodeTypes, {
        ast2String,
        COStreamJS
    });

    return COStreamJS;

}());
