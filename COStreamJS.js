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
    var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,14],$V1=[1,20],$V2=[1,12],$V3=[1,15],$V4=[1,16],$V5=[1,17],$V6=[1,18],$V7=[1,19],$V8=[5,37,43,133,134,135,136,137,138],$V9=[1,25],$Va=[1,26],$Vb=[20,21],$Vc=[20,21,22],$Vd=[11,16],$Ve=[2,12],$Vf=[1,41],$Vg=[1,40],$Vh=[1,39],$Vi=[1,42],$Vj=[11,16,18,21,22,23,30],$Vk=[5,11,20,21,30,32,37,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vl=[11,20,21,30,43,51,55,56,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,133,134,135,136,137,138],$Vm=[1,69],$Vn=[1,60],$Vo=[1,64],$Vp=[1,63],$Vq=[1,70],$Vr=[1,71],$Vs=[1,57],$Vt=[1,58],$Vu=[1,62],$Vv=[1,65],$Vw=[1,66],$Vx=[1,67],$Vy=[1,68],$Vz=[1,80],$VA=[1,96],$VB=[1,106],$VC=[1,94],$VD=[1,95],$VE=[1,98],$VF=[1,99],$VG=[1,100],$VH=[1,101],$VI=[1,102],$VJ=[1,103],$VK=[1,104],$VL=[1,105],$VM=[11,16,22,25,32,74],$VN=[1,130],$VO=[1,131],$VP=[1,124],$VQ=[1,125],$VR=[1,122],$VS=[1,123],$VT=[1,126],$VU=[1,127],$VV=[1,128],$VW=[1,129],$VX=[1,132],$VY=[1,133],$VZ=[1,134],$V_=[1,135],$V$=[1,136],$V01=[1,137],$V11=[1,138],$V21=[1,139],$V31=[11,16,22,25,32,44,46,74,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119],$V41=[2,120],$V51=[11,16,18,22,25,32,44,46,74,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$V61=[11,16,18,21,22,23,25,32,44,46,74,91,92,93,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$V71=[20,21,55,56,87,88,92,93,94,100,101,102,103],$V81=[1,155],$V91=[11,16,22],$Va1=[16,22],$Vb1=[11,16,32],$Vc1=[5,11,20,21,30,32,37,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,127,133,134,135,136,137,138],$Vd1=[11,20,21,30,32,43,51,55,56,59,66,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Ve1=[11,20,21,30,32,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vf1=[11,20,21,22,30,32,43,51,55,56,59,66,73,75,77,78,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,125,126,133,134,135,136,137,138],$Vg1=[1,169],$Vh1=[11,16,22,25,74],$Vi1=[16,46],$Vj1=[16,32],$Vk1=[11,16,22,25,32,44,46,74,100,101,107,108,109,110,111,112,113,114,115,116,117,119],$Vl1=[11,16,22,25,32,44,46,74,107,108,109,110,111,112,113,116,117,119],$Vm1=[11,16,22,25,32,74,107,108,109,112,113,116,117,119],$Vn1=[11,16,22,25,32,44,46,74,107,108,109,110,111,112,113,114,115,116,117,119],$Vo1=[1,249],$Vp1=[2,150],$Vq1=[11,16,18,21,22,23,25,30,32,44,46,74,91,92,93,100,101,104,105,106,107,108,109,110,111,112,113,114,115,116,117,119,121],$Vr1=[1,251],$Vs1=[1,267],$Vt1=[1,275],$Vu1=[1,294],$Vv1=[2,153],$Vw1=[1,300],$Vx1=[1,312],$Vy1=[1,317],$Vz1=[1,336],$VA1=[20,32],$VB1=[11,20,21,30,32,43,51,55,56,73,75,77,79,80,81,82,83,84,85,87,88,92,93,94,100,101,102,103,133,134,135,136,137,138];
    var parser = {trace: function trace () { },
    yy: {},
    symbols_: {"error":2,"prog_start":3,"translation_unit":4,"EOF":5,"external_declaration":6,"function_definition":7,"declaration":8,"composite_definition":9,"declaring_list":10,";":11,"stream_declaring_list":12,"type_specifier":13,"init_declarator_list":14,"init_declarator":15,",":16,"declarator":17,"=":18,"initializer":19,"IDENTIFIER":20,"(":21,")":22,"[":23,"constant_expression":24,"]":25,"parameter_type_list":26,"identifier_list":27,"stream_type_specifier":28,"assignment_expression":29,"{":30,"initializer_list":31,"}":32,"compound_statement":33,"parameter_declaration":34,"composite_head":35,"composite_body":36,"COMPOSITE":37,"composite_head_inout":38,"INPUT":39,"composite_head_inout_member_list":40,"OUTPUT":41,"composite_head_inout_member":42,"STREAM":43,"<":44,"stream_declaration_list":45,">":46,"composite_body_param_opt":47,"statement_list":48,"PARAM":49,"operator_add":50,"ADD":51,"operator_pipeline":52,"operator_splitjoin":53,"operator_default_call":54,"PIPELINE":55,"SPLITJOIN":56,"split_statement":57,"join_statement":58,"SPLIT":59,"duplicate_statement":60,"roundrobin_statement":61,"ROUNDROBIN":62,"argument_expression_list":63,"DUPLICATE":64,"exp":65,"JOIN":66,"statement":67,"labeled_statement":68,"expression_statement":69,"selection_statement":70,"iteration_statement":71,"jump_statement":72,"CASE":73,":":74,"DEFAULT":75,"expression":76,"IF":77,"ELSE":78,"SWITCH":79,"WHILE":80,"DO":81,"FOR":82,"CONTINUE":83,"BREAK":84,"RETURN":85,"primary_expression":86,"NUMBER":87,"STRING_LITERAL":88,"operator_arguments":89,"postfix_expression":90,".":91,"++":92,"--":93,"FILEREADER":94,"stringConstant":95,"operator_selfdefine_body":96,"unary_expression":97,"unary_operator":98,"basic_type_name":99,"+":100,"-":101,"~":102,"!":103,"*":104,"/":105,"%":106,"^":107,"|":108,"&":109,"<=":110,">=":111,"==":112,"!=":113,"<<":114,">>":115,"||":116,"&&":117,"conditional_expression":118,"?":119,"assignment_operator":120,"ASSIGNMENT_OPERATOR":121,"operator_selfdefine_body_init":122,"operator_selfdefine_body_work":123,"operator_selfdefine_body_window_list":124,"INIT":125,"WORK":126,"WINDOW":127,"operator_selfdefine_window_list":128,"operator_selfdefine_window":129,"window_type":130,"SLIDING":131,"TUMBLING":132,"CONST":133,"INT":134,"LONG":135,"FLOAT":136,"DOUBLE":137,"STRING":138,"$accept":0,"$end":1},
    terminals_: {2:"error",5:"EOF",11:";",16:",",18:"=",20:"IDENTIFIER",21:"(",22:")",23:"[",25:"]",30:"{",32:"}",37:"COMPOSITE",39:"INPUT",41:"OUTPUT",43:"STREAM",44:"<",46:">",49:"PARAM",51:"ADD",55:"PIPELINE",56:"SPLITJOIN",59:"SPLIT",62:"ROUNDROBIN",64:"DUPLICATE",66:"JOIN",73:"CASE",74:":",75:"DEFAULT",77:"IF",78:"ELSE",79:"SWITCH",80:"WHILE",81:"DO",82:"FOR",83:"CONTINUE",84:"BREAK",85:"RETURN",87:"NUMBER",88:"STRING_LITERAL",91:".",92:"++",93:"--",94:"FILEREADER",95:"stringConstant",100:"+",101:"-",102:"~",103:"!",104:"*",105:"/",106:"%",107:"^",108:"|",109:"&",110:"<=",111:">=",112:"==",113:"!=",114:"<<",115:">>",116:"||",117:"&&",119:"?",121:"ASSIGNMENT_OPERATOR",125:"INIT",126:"WORK",127:"WINDOW",131:"SLIDING",132:"TUMBLING",133:"CONST",134:"INT",135:"LONG",136:"FLOAT",137:"DOUBLE",138:"STRING"},
    productions_: [0,[3,2],[4,1],[4,2],[6,1],[6,1],[6,1],[8,2],[8,2],[10,2],[14,1],[14,3],[15,1],[15,3],[17,1],[17,3],[17,4],[17,3],[17,4],[17,4],[17,3],[27,1],[27,3],[12,2],[12,3],[19,1],[19,3],[19,4],[31,1],[31,3],[7,3],[26,1],[26,3],[34,2],[9,2],[35,5],[38,0],[38,2],[38,5],[38,2],[38,5],[40,1],[40,3],[42,2],[28,4],[45,2],[45,4],[36,4],[47,0],[47,3],[50,2],[50,2],[50,2],[52,4],[53,6],[53,7],[57,2],[57,2],[61,4],[61,5],[60,4],[60,5],[58,2],[54,4],[54,5],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[67,1],[68,4],[68,3],[33,2],[33,3],[48,1],[48,2],[69,1],[69,2],[70,5],[70,7],[70,5],[71,5],[71,7],[71,6],[71,7],[72,2],[72,2],[72,2],[72,3],[86,1],[86,1],[86,1],[86,3],[89,2],[89,3],[90,1],[90,4],[90,2],[90,3],[90,2],[90,2],[90,6],[90,3],[90,9],[90,10],[90,7],[63,1],[63,3],[97,1],[97,2],[97,2],[97,2],[97,4],[98,1],[98,1],[98,1],[98,1],[65,1],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[65,3],[118,1],[118,5],[29,1],[29,3],[120,1],[120,1],[76,1],[76,3],[24,1],[96,5],[96,6],[122,0],[122,2],[123,2],[124,0],[124,4],[128,1],[128,2],[129,3],[130,3],[130,3],[130,4],[130,4],[13,1],[13,2],[99,1],[99,1],[99,2],[99,1],[99,1],[99,1]],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
    /* this == yyval */

    var $0 = $$.length - 1;
    switch (yystate) {
    case 1:
     return $$[$0-1] 
    break;
    case 2: case 10:
     this.$ = [$$[$0]]; 
    break;
    case 3: case 11: case 32: case 42: case 110: case 156:
     this.$.push($$[$0]); 
    break;
    case 7: case 8: case 26: case 44: case 80: case 97: case 154:
     this.$ = $$[$0-1]; 
    break;
    case 9:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 12:
     this.$ = $$[$0];      
    break;
    case 13:
     this.$ = new declarator(this._$,$$[$0-2],$$[$0-1]);this.$.initializer = $$[$0]; 
    break;
    case 14:
     this.$ = $$[$0];                                                 
    break;
    case 15:
     error("暂未支持该种declarator的写法");                      
    break;
    case 16: case 18: case 19:
     this.$ = new declarator(this._$,$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);        
    break;
    case 17: case 20:
     this.$ = new declarator(this._$,$$[$0-2],$$[$0-1],undefined,$$[$0]); 
    break;
    case 21: case 28: case 145: case 151: case 152:
     this.$ = $$[$0]; 
    break;
    case 22:
     this.$ = $$[$0-2] instanceof Array ? $$[$0-2].concat($$[$0]) : [$$[$0-2],$$[$0]]; 
    break;
    case 23:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]);  
    break;
    case 24:
     this.$.init_declarator_list.push($$[$0]);
    break;
    case 27:
     this.$ = $$[$0-2]; 
    break;
    case 29:
     this.$ = $$[$0-2] instanceof Array ? $$[$0-2].concat($$[$0]) : [$$[$0-2],$$[$0]];
    break;
    case 30:
     this.$ = new function_definition(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 31: case 41: case 109: case 155:
     this.$ = [$$[$0]];   
    break;
    case 33:
     this.$ = new parameter_declaration(this._$,$$[$0-1],$$[$0]); 
    break;
    case 34:
     this.$ = new compositeNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 35:
     this.$ = new compHeadNode(this._$,$$[$0-3],$$[$0-1]);  
    break;
    case 36: case 48: case 79: case 96:
     this.$ = undefined; 
    break;
    case 37:
     this.$ = new ComInOutNode(this._$,$$[$0]);          
    break;
    case 38:
     this.$ = new ComInOutNode(this._$,$$[$0-3],$$[$0]);       
    break;
    case 39:
     this.$ = new ComInOutNode(this._$,undefined,$$[$0]);
    break;
    case 40:
     this.$ = new ComInOutNode(this._$,$$[$0],$$[$0-3]);       
    break;
    case 43:
     this.$ = new inOutdeclNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 45:
     this.$ = new strdclNode(this._$,$$[$0-1],$$[$0]);              
    break;
    case 46:
     this.$.id_list.push({ type:$$[$0-1],identifier:$$[$0] }); 
    break;
    case 47:
     this.$ = new compBodyNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 49:
     this.$ = new paramNode(this._$,$$[$0-1]);       
    break;
    case 50: case 51: case 52:
      this.$ = new addNode(this._$,$$[$0]); 
    break;
    case 53:

                                                                    this.$ = new pipelineNode(this._$,{
                                                                        compName: 'pipeline',
                                                                        inputs: undefined,
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 54:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: undefined,
                                                                        stmt_list: undefined,
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 55:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: undefined,
                                                                        stmt_list: $$[$0-4],
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 56: case 57:
     this.$ = new splitNode(this._$,$$[$0]);     
    break;
    case 58:
     this.$ = new roundrobinNode(this._$);   
    break;
    case 59:
     this.$ = new roundrobinNode(this._$,$$[$0-2]);
    break;
    case 60:
     this.$ = new duplicateNode(this._$);    
    break;
    case 61:
     this.$ = new duplicateNode(this._$,$$[$0-2]); 
    break;
    case 62:
     this.$ = new joinNode(this._$,$$[$0]);      
    break;
    case 63:
     this.$ = new compositeCallNode(this._$,$$[$0-3]);    
    break;
    case 64:
     this.$ = new compositeCallNode(this._$,$$[$0-4],$$[$0-2]); 
    break;
    case 73:
     this.$ = new labeled_statement(this._$,$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);
    break;
    case 74:
     this.$ = new labeled_statement(this._$,$$[$0-2],undefined,$$[$0-1],$$[$0]);
    break;
    case 75:
     this.$ = new blockNode(this._$,$$[$0-1],undefined,$$[$0]); 
    break;
    case 76:
     this.$ = new blockNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 77:
     this.$ = $$[$0] ? [$$[$0]] : [];   
    break;
    case 78:
     if($$[$0]) this.$.push($$[$0]);    
    break;
    case 81: case 83:
     this.$ = new selection_statement(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);        
    break;
    case 82:
     this.$ = new selection_statement(this._$,$$[$0-6],$$[$0-5],$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);  
    break;
    case 84:
     this.$ = new whileNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 85:
     this.$ = new doNode(this._$,$$[$0-2],$$[$0-5]);    
    break;
    case 86:
     this.$ = new forNode(this._$,$$[$0-3],$$[$0-2],undefined,$$[$0]);    
    break;
    case 87:
     this.$ = new forNode(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0]); 
    break;
    case 88: case 89: case 90:
     this.$ = new jump_statement(this._$,$$[$0-1]); 
    break;
    case 91:
     this.$ = new jump_statement(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 93: case 94:
     this.$ = new constantNode(this._$,$$[$0]); 
    break;
    case 95:
     this.$ = new parenNode(this._$,$$[$0-1]);    
    break;
    case 99:
     this.$ = new arrayNode(this._$,$$[$0-3],$$[$0-1]);    
    break;
    case 100:
     
                                                                    if(this.$ instanceof callNode){
                                                                        this.$ = new compositeCallNode(this._$,$$[$0-1].name,$$[$0-1].arg_list,$$[$0]);
                                                                    }         
                                                                    else{
                                                                        this.$ = new callNode(this._$,$$[$0-1],$$[$0]);
                                                                    }
                                                                
    break;
    case 101: case 121: case 122: case 123: case 124: case 125: case 126: case 127: case 128: case 129: case 130: case 131: case 132: case 133: case 134: case 135: case 136: case 137: case 138:
     this.$ = new binopNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 102: case 103:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]);    
    break;
    case 104:
     error("暂不支持FILEREADER");      
    break;
    case 105:

                                                                    this.$ = new operatorNode(this._$,$$[$0-2],$$[$0-1],$$[$0]);
                                                                
    break;
    case 106:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-6],
                                                                        stmt_list: undefined,
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 107:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-7],
                                                                        stmt_list: $$[$0-4],
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 108:

                                                                    this.$ = new pipelineNode(this._$,{
                                                                        compName: 'pipeline',
                                                                        inputs: $$[$0-4],
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 112: case 113: case 114:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 115:
     this.$ = new castNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 140:
     this.$ = new ternaryNode(this._$,$$[$0-4],$$[$0-2],$$[$0]); 
    break;
    case 142:

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
    case 146:

             if($$[$0-2] instanceof Array) this.$.push($$[$0]);
             else if($$[$0-2] !== undefined) this.$ = [$$[$0-2],$$[$0]];
             else error("error at `expression ','` ",$$[$0-2],$$[$0]); 
          
    break;
    case 148:

               this.$ = new operBodyNode(this._$,undefined,$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 149:

               this.$ = new operBodyNode(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 157:
     this.$ = new winStmtNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 158: case 159:
     this.$ = { type:$$[$0-2] }; 
    break;
    case 160: case 161:
     this.$ = { type:$$[$0-3], arg_list: $$[$0-1]}; 
    break;
    case 163:
     this.$ = "const "+$$[$0]; 
    break;
    case 166:
     this.$ = "long long"; 
    break;
    }
    },
    table: [{3:1,4:2,6:3,7:4,8:5,9:6,10:8,12:9,13:7,28:13,35:10,37:$V0,43:$V1,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{1:[3]},{5:[1,21],6:22,7:4,8:5,9:6,10:8,12:9,13:7,28:13,35:10,37:$V0,43:$V1,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V8,[2,2]),o($V8,[2,4]),o($V8,[2,5]),o($V8,[2,6]),{14:24,15:27,17:23,20:$V9,21:$Va},{11:[1,28]},{11:[1,29],16:[1,30]},{30:[1,32],36:31},o($Vb,[2,162]),{99:33,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:[1,34]},{20:[1,35]},o($Vc,[2,164]),o($Vc,[2,165],{135:[1,36]}),o($Vc,[2,167]),o($Vc,[2,168]),o($Vc,[2,169]),{44:[1,37]},{1:[2,1]},o($V8,[2,3]),o($Vd,$Ve,{33:38,18:$Vf,21:$Vg,23:$Vh,30:$Vi}),{11:[2,9],16:[1,43]},o($Vj,[2,14]),{17:44,20:$V9,21:$Va},o($Vd,[2,10]),o($Vk,[2,7]),o($Vk,[2,8]),{20:[1,45]},o($V8,[2,34]),o($Vl,[2,48],{47:46,49:[1,47]}),o($Vb,[2,163]),o($Vd,[2,23]),{21:[1,48]},o($Vc,[2,166]),{13:50,45:49,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V8,[2,30]),{20:$Vm,21:$Vn,24:51,25:[1,52],55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:53},{13:77,20:[1,76],22:[1,74],26:72,27:73,34:75,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{19:78,20:$Vm,21:$Vn,29:79,30:$Vz,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,32:[1,83],33:87,43:$V1,48:84,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{15:109,17:110,20:$V9,21:$Va},{21:$Vg,22:[1,111],23:$Vh},o($Vd,[2,24]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:112,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{13:77,26:113,34:75,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{22:[2,36],38:114,39:[1,115],41:[1,116]},{16:[1,118],46:[1,117]},{20:[1,119]},{25:[1,120]},o($Vj,[2,17]),o([25,74],[2,147]),o($VM,[2,139],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,107:$VU,108:$VV,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01,116:$V11,117:$V21,119:[1,121]}),o($V31,$V41),o($V51,[2,111],{89:141,21:[1,145],23:[1,140],91:[1,142],92:[1,143],93:[1,144]}),{20:$Vm,21:$Vn,55:$Vo,56:$Vp,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:146,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:147,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:148,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:150,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:149,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V61,[2,98]),{21:[1,151]},{21:[1,152]},{21:[1,153]},o($V71,[2,116]),o($V71,[2,117]),o($V71,[2,118]),o($V71,[2,119]),o($V61,[2,92]),o($V61,[2,93]),o($V61,[2,94]),{16:$V81,22:[1,154]},{16:[1,157],22:[1,156]},o($Vj,[2,20]),o($V91,[2,31]),o($Va1,[2,21]),{17:158,20:$V9,21:$Va},o($Vd,[2,13]),o($Vb1,[2,25]),{19:160,20:$Vm,21:$Vn,29:79,30:$Vz,31:159,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($VM,[2,141]),o($V31,$V41,{120:161,18:[1,162],121:[1,163]}),o($Vc1,[2,75]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,32:[1,164],33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vd1,[2,77]),o($Ve1,[2,65]),o($Ve1,[2,66]),o($Ve1,[2,67]),o($Ve1,[2,68]),o($Ve1,[2,69]),o($Ve1,[2,70]),o($Ve1,[2,71]),o($Ve1,[2,72]),{20:$Vm,21:$Vn,24:166,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:53},{74:[1,167]},o($Vf1,[2,79]),{11:[1,168],16:$Vg1},{21:[1,170]},{21:[1,171]},{21:[1,172]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:173,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{21:[1,174]},{11:[1,175]},{11:[1,176]},{11:[1,177],20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:178,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:[1,184],52:179,53:180,54:181,55:[1,182],56:[1,183]},o($Vh1,[2,145]),{14:24,15:27,17:110,20:$V9,21:$Va},o($Vd,[2,11]),o($Vd,$Ve,{18:$Vf,21:$Vg,23:$Vh}),o($Vj,[2,15]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,32:[1,185],33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{11:[1,186],16:$V81},{22:[1,187]},{28:190,40:188,42:189,43:$V1},{28:190,40:191,42:189,43:$V1},{20:[2,44]},{13:192,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vi1,[2,45]),o($Vj,[2,16]),{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:193,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:194,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:195,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:196,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:197,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:198,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:199,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:200,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:201,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:202,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:203,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:204,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:205,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:206,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:207,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:208,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:209,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:210,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:211,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:212,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($V61,[2,100],{96:213,30:[1,214]}),{20:[1,215]},o($V61,[2,102]),o($V61,[2,103]),{20:$Vm,21:$Vn,22:[1,216],29:218,55:$Vo,56:$Vp,63:217,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($V51,[2,112]),o($V51,[2,113]),o($V51,[2,114]),{22:[1,219]},{16:$Vg1,22:[1,220]},{22:[1,221]},{20:$Vm,21:$Vn,29:218,55:$Vo,56:$Vp,63:222,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,29:218,55:$Vo,56:$Vp,63:223,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($Vj,[2,18]),{13:77,34:224,99:11,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vj,[2,19]),{20:[1,225]},o($V91,[2,33],{21:$Vg,23:$Vh}),{16:[1,227],32:[1,226]},o($Vj1,[2,28]),{20:$Vm,21:$Vn,29:228,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($V71,[2,143]),o($V71,[2,144]),o($Vc1,[2,76]),o($Vd1,[2,78]),{74:[1,229]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:230,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vf1,[2,80]),{20:$Vm,21:$Vn,29:231,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:232,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:233,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:234,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{80:[1,235]},{11:$VA,20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,69:236,76:97,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($Ve1,[2,88]),o($Ve1,[2,89]),o($Ve1,[2,90]),{11:[1,237],16:$Vg1},o($Ve1,[2,50]),o($Ve1,[2,51]),o($Ve1,[2,52]),{30:[1,238]},{30:[1,239]},{21:[1,240]},o($V8,[2,47]),o($Vl,[2,49]),{30:[2,35]},{16:[1,241],22:[2,37]},o($Va1,[2,41]),{20:[1,242]},{16:[1,243],22:[2,39]},{20:[1,244]},{16:$Vg1,74:[1,245]},o($V31,[2,121]),o($V31,[2,122]),o($Vk1,[2,123],{104:$VR,105:$VS,106:$VT}),o($Vk1,[2,124],{104:$VR,105:$VS,106:$VT}),o($V31,[2,125]),o([11,16,22,25,32,74,107,108,116,117,119],[2,126],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01}),o([11,16,22,25,32,74,108,116,117,119],[2,127],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,107:$VU,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01}),o([11,16,22,25,32,74,107,108,109,116,117,119],[2,128],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01}),o($Vl1,[2,129],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,114:$V$,115:$V01}),o($Vl1,[2,130],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,114:$V$,115:$V01}),o($Vl1,[2,131],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,114:$V$,115:$V01}),o($Vl1,[2,132],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,114:$V$,115:$V01}),o($Vm1,[2,133],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,110:$VX,111:$VY,114:$V$,115:$V01}),o($Vm1,[2,134],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,110:$VX,111:$VY,114:$V$,115:$V01}),o($Vn1,[2,135],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT}),o($Vn1,[2,136],{100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT}),o([11,16,22,25,32,74,116,119],[2,137],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,107:$VU,108:$VV,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01,117:$V21}),o([11,16,22,25,32,74,116,117,119],[2,138],{44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,107:$VU,108:$VV,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01}),{16:$Vg1,25:[1,246]},o($V61,[2,105]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:248,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,122:247,125:$Vo1,126:$Vp1,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V61,[2,101]),o($Vq1,[2,96]),{16:$Vr1,22:[1,250]},o($Va1,[2,109]),{20:$Vm,21:$Vn,55:$Vo,56:$Vp,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:252,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},o($V61,[2,95]),{21:[1,253]},{16:$Vr1,22:[1,254]},{16:$Vr1,22:[1,255]},o($V91,[2,32]),o($Va1,[2,22]),o($Vb1,[2,26]),{19:257,20:$Vm,21:$Vn,29:79,30:$Vz,32:[1,256],55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($VM,[2,142]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:258,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Ve1,[2,74]),o($Vh1,[2,146]),{16:$Vg1,22:[1,259]},{16:$Vg1,22:[1,260]},{16:$Vg1,22:[1,261]},{21:[1,262]},{11:$VA,20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,69:263,76:97,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($Ve1,[2,91]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:264,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:266,50:93,51:$VB,55:$Vo,56:$Vp,57:265,59:$Vs1,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vm,21:$Vn,22:[1,268],29:218,55:$Vo,56:$Vp,63:269,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{28:190,41:[1,270],42:271,43:$V1},o($Va1,[2,43]),{28:190,39:[1,272],42:271,43:$V1},o($Vi1,[2,46]),{20:$Vm,21:$Vn,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:273},o($V61,[2,99]),{123:274,126:$Vt1},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,122:276,125:$Vo1,126:$Vp1,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{30:$Vi,33:277},o($Vq1,[2,97]),{20:$Vm,21:$Vn,29:278,55:$Vo,56:$Vp,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($V51,[2,115]),{95:[1,279]},{30:[1,280]},{30:[1,281]},o($Vb1,[2,27]),o($Vj1,[2,29]),o($Ve1,[2,73]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:282,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:283,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:284,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vm,21:$Vn,29:107,55:$Vo,56:$Vp,65:54,76:285,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,22:[1,286],29:107,55:$Vo,56:$Vp,65:54,76:287,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,32:[1,288],33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:289,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,57:290,59:$Vs1,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{60:291,61:292,62:$Vu1,64:[1,293]},{11:[1,295]},{16:$Vr1,22:[1,296]},{28:190,40:297,42:189,43:$V1},o($Va1,[2,42]),{28:190,40:298,42:189,43:$V1},o($VM,[2,140]),{32:$Vv1,124:299,127:$Vw1},{30:$Vi,33:301},{123:302,126:$Vt1},{126:[2,151]},o($Va1,[2,110]),{22:[1,303]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:305,50:93,51:$VB,55:$Vo,56:$Vp,57:304,59:$Vs1,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:306,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vd1,[2,81],{78:[1,307]}),o($Ve1,[2,83]),o($Ve1,[2,84]),{16:$Vg1,22:[1,308]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:309,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{16:$Vg1,22:[1,310]},o($Ve1,[2,53]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,58:311,65:54,66:$Vx1,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:313,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Vl,[2,56]),o($Vl,[2,57]),{21:[1,314]},{21:[1,315]},o($Ve1,[2,63]),{11:[1,316]},{16:$Vy1,22:[2,38]},{16:$Vy1,22:[2,40]},{32:[1,318]},{30:[1,319]},o([32,127],[2,152]),{32:$Vv1,124:320,127:$Vw1},o($V61,[2,104]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:321,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,57:322,59:$Vs1,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,32:[1,323],33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:324,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{11:[1,325]},o($Ve1,[2,86]),{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:326,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{32:[1,327]},{61:328,62:$Vu1},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,58:329,65:54,66:$Vx1,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{20:$Vm,21:$Vn,22:[1,330],55:$Vo,56:$Vp,65:331,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:55,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy},{20:$Vm,21:$Vn,22:[1,332],29:218,55:$Vo,56:$Vp,63:333,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($Ve1,[2,64]),{28:190,42:271,43:$V1},o($V61,[2,148]),{20:$Vz1,128:334,129:335},{32:[1,337]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,58:338,65:54,66:$Vx1,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,48:339,50:93,51:$VB,55:$Vo,56:$Vp,65:54,67:85,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($V61,[2,108]),o($Ve1,[2,82]),o($Ve1,[2,85]),o($Ve1,[2,87]),o($Ve1,[2,54]),{32:[2,62]},{32:[1,340]},{11:[1,341]},{22:[1,342],44:$VN,46:$VO,100:$VP,101:$VQ,104:$VR,105:$VS,106:$VT,107:$VU,108:$VV,109:$VW,110:$VX,111:$VY,112:$VZ,113:$V_,114:$V$,115:$V01,116:$V11,117:$V21},{11:[1,343]},{16:$Vr1,22:[1,344]},{20:$Vz1,32:[1,345],129:346},o($VA1,[2,155]),{130:347,131:[1,348],132:[1,349]},o($V61,[2,149]),{32:[1,350]},{8:92,10:8,11:$VA,12:9,13:108,20:$Vm,21:$Vn,28:13,29:107,30:$Vi,33:87,43:$V1,50:93,51:$VB,55:$Vo,56:$Vp,58:351,65:54,66:$Vx1,67:165,68:86,69:88,70:89,71:90,72:91,73:$VC,75:$VD,76:97,77:$VE,79:$VF,80:$VG,81:$VH,82:$VI,83:$VJ,84:$VK,85:$VL,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,99:11,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81,133:$V2,134:$V3,135:$V4,136:$V5,137:$V6,138:$V7},o($Ve1,[2,55]),o($Vl,[2,60]),{11:[1,352]},o($VB1,[2,58]),{11:[1,353]},{32:[2,154]},o($VA1,[2,156]),{11:[1,354]},{21:[1,355]},{21:[1,356]},o($V61,[2,106]),{32:[1,357]},o($Vl,[2,61]),o($VB1,[2,59]),o($VA1,[2,157]),{20:$Vm,21:$Vn,22:[1,358],29:218,55:$Vo,56:$Vp,63:359,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},{20:$Vm,21:$Vn,22:[1,360],29:218,55:$Vo,56:$Vp,63:361,65:54,86:61,87:$Vq,88:$Vr,90:56,92:$Vs,93:$Vt,94:$Vu,97:82,98:59,100:$Vv,101:$Vw,102:$Vx,103:$Vy,118:81},o($V61,[2,107]),{11:[2,158]},{16:$Vr1,22:[1,362]},{11:[2,159]},{16:$Vr1,22:[1,363]},{11:[2,160]},{11:[2,161]}],
    defaultActions: {21:[2,1],117:[2,44],187:[2,35],277:[2,151],328:[2,62],345:[2,154],358:[2,158],360:[2,159],362:[2,160],363:[2,161]},
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

            //@type {operatorNode} 指向operator(经常量传播后的).
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

            //@type {FlatNode[]}
            this.outFlatNodes = []; // 输 出 边各operator
            this.inFlatNodes = [];  // 输 入 边各operator

            //@type{number[]}
            this.outPushWeights = []; // 输 出 边各权重
            this.inPopWeights = [];   // 输 入 边各权重
            this.inPeekWeights = [];  // 输 入 边各权重

            //@type{string[]}
            this.outPushString = [];
            this.inPopString = [];
            this.inPeekString = [];
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
        VisitNode(){
            this.visitTimes ++;
        }   
        ResetVisitTimes(){
            this.visitTimes = 0;
        }

    }

    class StaticStreamGraph {
        constructor() {
            this.topNode = null; // SDF图的起始节点，假设只有一个输入为0的节点

            //@type {FlatNode[]} 静态数据流图所有节点集合
            this.flatNodes = [];

            // map < string, FlatNode *> mapEdge2UpFlatNode; // 将有向边与其上端绑定
            this.mapEdge2UpFlatNode = new Map();
            // map < string, FlatNode *> mapEdge2DownFlatNode; //将有向边与其下端绑定
            this.mapEdge2DownFlatNode = new Map();

            // map < FlatNode *, int > mapSteadyWork2FlatNode;  // 存放各个operator的workestimate（稳态工作量估计)
            this.mapSteadyWork2FlatNode = new Map();

            //map < FlatNode *, int > mapInitWork2FlatNode;    // 存放各个operator的workestimate（初态）
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

        modifyWorkName(/*Node **/ u,/* string */ replaceName, /* string */ name) { }
    }
    var unfold = new UnfoldComposite();


    /**
     * @description 对于composite节点内的operatorNode进行流替换
     * 只替换第一个和最后一个oper 的原因是: 对第一个修改 IN, 对最后一个修改 Out, 对简单串行的 comp 是没问题的
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
    UnfoldComposite.prototype.streamReplace = function (/*compositeNode **/ comp,/* String[] */ inputs, outputs, flag) {
        let stmt_list = comp.body.stmt_list;
        operatorStreamReplace(stmt_list[0], inputs, 'inputs');
        operatorStreamReplace(stmt_list[stmt_list.length - 1], outputs, 'outputs');
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
            var w_steady = 60; //body.work ? body.work.WorkEstimate() : 0;
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
        console.table(ssg.flatNodes.map(n=>({ name: n.name, steadyCount: n.steadyCount})));
    }
    function InitScheduling(ssg){
        ssg.flatNodes.forEach(n => n.initCount = 1);
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
            debugger
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
        debugger
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
        let topologic = actorTopologicalorder(ssg.flatNodes);
        //第二步根据以上步骤的节点划分结果，得到阶段赋值结果
        return actorStageMap(mp.FlatNode2PartitionNum, topologic);
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
            if(!head){
                throw new Error("[StageAssignment.js] 算法或SDF图出错,这里 head 不应该为空")
            }
            //找到该前驱节点后,将它加入 topologic 拓扑排序序列,并从初始集合中移出
            topologic.add(head);
            flats.splice(flats.indexOf(head),1);
            
        }

        return [...topologic]
    }

    /**
     * 根据拓扑排序结果、获得阶段赋值结果
     * 若节点和其输入节点在一个划分子图，则其阶段号一致; 否则阶段号=上端最大阶段号+1
     * @param { map<FlatNode,int> } map - mp.FlatNode2PartitionNum
     */
    function actorStageMap(map, topologic){
        let stage = 0; //初始阶段号
        topologic.forEach(flat=>{
            //判断该节点是否和其输入节点都在一个划分子图
            let isInSameSubGraph = flat.inFlatNodes.every(src=> map.get(src) == map.get(flat));

            //如果有上端和自己不在同一子图的话,就要让阶段号+1
            flat.stageNum = isInSameSubGraph ? stage : ++stage;
        });

        //返回总共有几个阶段, 例如阶段号分别是0,1,2,3,那么要返回一共有"4"个阶段
        return stage + 1
    }

    Object.assign(COStreamJS, {
        parser,
        AST2FlatStaticStreamGraph,
        unfold,
        SemCheck,
        DumpStreamGraph,
        GreedyPartition,
        GetSpeedUpInfo,
        PrintSpeedUpInfo,
        StageAssignment
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