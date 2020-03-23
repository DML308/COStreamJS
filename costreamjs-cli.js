#!/usr/bin/env node
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
    const errors = [];
    function error$1(...args) {
        const error_obj = { msg:'', other:[] };
        args.forEach(arg =>{
            if(typeof arg === "string"){
                error_obj.msg += arg;
            }else if(typeof arg === 'object' && arg !== null && arg.first_line !== undefined){
                error_obj.loc = arg;
            }else {
                error_obj.other.push(arg);
            }
        });
        errors.push(error_obj);
        console.log("%c " + error_obj.msg, "color: #cd3131", ...error_obj.other);
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
                }else {
                    return ast2dot.count++
                }
            }else {
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
         * 输入 node 为 object 或 string 或 number,创建一行格式为 
         * 6 [label="<1> int |<2> 2"] 的 dot 字符串
         * 返回该节点的序号, 例如6
         */
        function newNode(node){
            var line = `    ${ast2dot.count} [label = "`;
            if (typeof node === 'string' || typeof node === 'number'){
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
                }else {
                    line+= ' ';
                }
            }
            line += `"];\n`;
            body += line;
            return ast2dot.count++
        }
    }

    /**
     * 深拷贝一个数据结构, 包括其原型链, 但以下滑线_开头的属性名浅拷贝, 例如 _symbol_table
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
                        if(key.startsWith('_')){
                            obj[key] = node[key];
                        }else {
                            obj[key] = deepClone(node[key]);
                        }
                    });
                    return obj
                }
            }
        }
    }

    function checkBraceMatching(str = ''){
        let stack = [], line = 0;
        let symmetry = { '[':']', '(':')', '{':'}' };
        for(let s of str){
            if(s == '(' || s == '[' || s == '{'){
                stack.push(s);
            }else if( s == ')' || s == ']' || s == '}'){
                let top = stack.pop();
                if(symmetry[top] !== s){
                    error$1({first_line:line}, `括号不匹配`);
                    return false
                }
            }else if( s == '\n'){
                line++;
            }
        }
        return true
    }

    var utils = /*#__PURE__*/Object.freeze({
        __proto__: null,
        checkBraceMatching: checkBraceMatching,
        debug: debug$1,
        line: line,
        error: error$1,
        green: green,
        errors: errors,
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
            definePrivate(this, 'type');
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
        constructor(loc, input_list = [], output_list = []) {
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
                stmt_list: stmt_list || [] ,
                op1: 'init', init,
                op2: 'work', work,
                op3: 'window', win
            });
        }
    }
    class winStmtNode extends Node {
        constructor(loc, winName, options = {}) {
            super(loc);
            Object.assign(this, {
                winName,
                type: options.type,
                arg_list: options.arg_list || []
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
            this.source = sourceStr.toString();
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
        constructor(loc, compName, inputs, params = []) {
            super(loc);
            Object.assign(this, {
                compName,
                op1: '(',
                inputs,
                op2: ')',
                op3: '(',
                params,
                op4: ')'
            });
        }
    }
    class operatorNode extends operNode {
        constructor(loc, operName, inputs, operBody) {
            super(loc);
            Object.assign(this, { operName, inputs: inputs ||[], operBody });
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
        }
    }
    class pipelineNode extends operNode {
        constructor(loc, options = {}) {
            super(loc);
            this.compName = options.compName;
            this.inputs = options.inputs;
            this.body_stmts = options.body_stmts;
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

    /********************************************************/
    /* 矩阵相关 node                       */
    /********************************************************/
    class matrix_constant extends Node{
        constructor(loc, rawData){
            super(loc);
            this.rawData = rawData.map(x => (
                x instanceof matrix_constant ? x.rawData : x
            ));
            this.shape = [];
            /** 下面代码逐层深入一个多维数组, 计算它的 shape */
            let currentArray = this.rawData;
            while (currentArray instanceof Array){
                this.shape.push(rawData.length);
                currentArray = currentArray[0];
            }
        }
    }

    /* 存放矩阵切片的下标, 例如 vector[0:5] 表示 下标[0,5) 即0~5不含5 
       兼容多重格式(_表示 undefined), 例如
       * [1:5] --- { start: 1, op:':', end: 5 }
       * [1:]  --- { start: 1, op:':', end: _ }
       * [:5]  --- { start: _, op:':', end: 5 }
       * [:]   --- { start: _, op:':', end: _ }
       * [0]   --- { start: 0, op: _ , end: _ }   */
    class matrix_slice_pair extends Node {
        constructor(loc, start, op, end) {
            super(loc);
            this.start = start;
            this.op = op;
            this.end = end;
        }
    }

    /** 存放 name[1:4, 2:5] 的结构, 寓意为矩阵切片结果 */
    class matrix_section extends expNode{
        constructor(loc, exp, slice_pair_list){
            super(loc);
            this.exp = exp;
            this.slice_pair_list = slice_pair_list;
        }
    }

    class lib_binopNode extends Node{
        constructor(loc, lib_name,function_name){
            super(loc);
            this.lib_name = lib_name;
            this.function_name = function_name;
        }
    }

    /** 神经网络相关 node */
    class sequentialNode extends operNode {
        constructor(loc, options = {}) {
          super(loc);
          this.compName = options.compName;
          this.inputs = options.inputs;
          this.arg_list = options.arg_list;
          this.body_stmts = options.body_stmts;
        }
    }class layerNode$1 extends Node {
        constructor(loc, layerName, arg_list) {
          super(loc);
          this.layerName = layerName;
          this.arg_list = arg_list;
          this.prevLayer = null;
          this.nextLayer = null;
          this.inputSize = [];
          /** 神经网络层级 */
          this.level = 0;
        }
        /** @returns {number[]} */
        getInputSize(/** @type {sequentialNode} */ sequential){
            if(this.prevLayer){
                if(this.prevLayer instanceof denseLayerNode){
                    return [1, this.prevLayer.cols, 1] // 设置本层的输入数据规模, 用一个三维向量描述: [depth, rows, cols]
                }else {
                    error$1("未识别的 layer 类型:", this.prevLayer);
                }
            }else {
                if(sequential.arg_list[0] instanceof matrix_constant){
                    return sequential.arg_list[0].rawData
                }
                return [1, sequential.arg_list[0].value, 1] // [depth, rows, cols]
            }
        }
    }class denseLayerNode extends layerNode$1 {
        constructor(loc, layerName, arg_list = [0]) {
            super(loc, layerName, arg_list);
            /** 权值矩阵输入 */
            this.rows = 0;
            /** 权值矩阵输出 */
            this.cols = arg_list[0].value; // FIXME: 这里简单起见直接拿到数字. 应该放到 ast2ssg 中的
        }
        init(/** @type {sequentialNode} */ sequential){
            this.inputSize = this.getInputSize(sequential);
            this.rows = this.inputSize.reduce((a,b)=>a*b); // 求得所有维度的乘积, 例如[1,100,1] 返回 1*100*1 = 100
        }
    }

    class averagePooling2DLayerNode extends layerNode$1 {
        constructor(loc, layerName, arg_list){
            super(loc, layerName, arg_list);
        }
    }

    var NodeTypes = /*#__PURE__*/Object.freeze({
        __proto__: null,
        Node: Node,
        declareNode: declareNode,
        idNode: idNode,
        declarator: declarator,
        function_definition: function_definition,
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
        addNode: addNode,
        matrix_constant: matrix_constant,
        matrix_slice_pair: matrix_slice_pair,
        matrix_section: matrix_section,
        lib_binopNode: lib_binopNode,
        sequentialNode: sequentialNode,
        layerNode: layerNode$1,
        denseLayerNode: denseLayerNode,
        averagePooling2DLayerNode: averagePooling2DLayerNode
    });

    var version = "0.8.4";

    //对外的包装对象
    var COStreamJS = {
        S : null,
        gMainComposite : null,
        files: {},
        options: { platform: 'default' },
        plugins: { matrix: false, image: false },
        version
    }; 
    COStreamJS.__proto__ = {};

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
    var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,7],$V1=[1,21],$V2=[1,15],$V3=[1,22],$V4=[1,13],$V5=[1,16],$V6=[1,17],$V7=[1,18],$V8=[1,19],$V9=[1,20],$Va=[5,10,11,38,44,143,144,145,146,147,148],$Vb=[1,28],$Vc=[1,29],$Vd=[22,23],$Ve=[22,23,24],$Vf=[2,183],$Vg=[12,18],$Vh=[2,13],$Vi=[1,44],$Vj=[1,43],$Vk=[12,18,20,23,24,25],$Vl=[5,10,11,12,22,23,25,30,32,38,44,52,57,58,61,68,77,79,81,83,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,135,136,143,144,145,146,147,148],$Vm=[11,12,22,23,25,30,44,52,57,58,77,79,81,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,143,144,145,146,147,148],$Vn=[1,68],$Vo=[1,77],$Vp=[1,66],$Vq=[1,81],$Vr=[1,71],$Vs=[1,70],$Vt=[1,78],$Vu=[1,79],$Vv=[1,63],$Vw=[1,64],$Vx=[1,69],$Vy=[1,72],$Vz=[1,73],$VA=[1,74],$VB=[1,75],$VC=[1,76],$VD=[1,84],$VE=[1,117],$VF=[1,103],$VG=[1,102],$VH=[1,113],$VI=[1,100],$VJ=[1,101],$VK=[1,105],$VL=[1,106],$VM=[1,107],$VN=[1,108],$VO=[1,109],$VP=[1,110],$VQ=[1,111],$VR=[1,112],$VS=[1,126],$VT=[12,18,24],$VU=[12,18,24,27,32,78],$VV=[2,153],$VW=[1,139],$VX=[1,140],$VY=[1,133],$VZ=[1,134],$V_=[1,131],$V$=[1,132],$V01=[1,135],$V11=[1,136],$V21=[1,137],$V31=[1,138],$V41=[1,141],$V51=[1,142],$V61=[1,143],$V71=[1,144],$V81=[1,145],$V91=[1,146],$Va1=[1,147],$Vb1=[1,148],$Vc1=[1,130],$Vd1=[12,18,24,27,32,45,47,78,110,111,114,115,116,117,118,119,120,121,122,123,124,125,126,127,129],$Ve1=[2,134],$Vf1=[12,18,20,24,27,32,45,47,78,110,111,114,115,116,117,118,119,120,121,122,123,124,125,126,127,129,131],$Vg1=[12,18,20,23,24,25,27,32,45,47,78,100,101,102,110,111,114,115,116,117,118,119,120,121,122,123,124,125,126,127,129,131],$Vh1=[1,161],$Vi1=[11,22,23,25,57,58,96,97,101,102,103,106,110,111,112,113],$Vj1=[12,18,32],$Vk1=[11,12,22,23,25,30,32,44,52,57,58,61,68,77,79,81,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,135,136,143,144,145,146,147,148],$Vl1=[11,12,22,23,25,30,32,44,52,57,58,61,68,77,79,81,83,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,135,136,143,144,145,146,147,148],$Vm1=[11,12,22,23,24,25,30,32,44,52,57,58,61,68,77,79,81,83,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,135,136,143,144,145,146,147,148],$Vn1=[1,179],$Vo1=[12,18,24,27],$Vp1=[18,47],$Vq1=[1,231],$Vr1=[18,32],$Vs1=[5,10,11,12,22,23,25,30,32,38,44,52,57,58,61,68,77,79,81,83,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,135,136,137,143,144,145,146,147,148],$Vt1=[18,24],$Vu1=[12,18,24,27,32,45,47,78,110,111,117,118,119,120,121,122,123,124,125,126,127,129],$Vv1=[12,18,24,27,32,45,47,78,117,118,119,120,121,122,123,126,127,129],$Vw1=[12,18,24,27,32,78,117,118,119,122,123,126,127,129],$Vx1=[12,18,24,27,32,45,47,78,117,118,119,120,121,122,123,124,125,126,127,129],$Vy1=[1,270],$Vz1=[2,163],$VA1=[18,27],$VB1=[12,18,20,23,24,25,27,30,32,45,47,78,100,101,102,110,111,114,115,116,117,118,119,120,121,122,123,124,125,126,127,129,131],$VC1=[1,276],$VD1=[1,293],$VE1=[1,303],$VF1=[1,325],$VG1=[2,166],$VH1=[1,333],$VI1=[1,346],$VJ1=[1,353],$VK1=[1,373],$VL1=[22,32],$VM1=[11,12,22,23,25,30,32,44,52,57,58,77,79,81,84,85,86,87,88,89,90,96,97,101,102,103,106,110,111,112,113,143,144,145,146,147,148];
    var parser = {trace: function trace () { },
    yy: {},
    symbols_: {"error":2,"prog_start":3,"translation_unit":4,"EOF":5,"external_declaration":6,"function_definition":7,"declaration":8,"composite_definition":9,"IMPORT":10,"MATRIX":11,";":12,"declaring_list":13,"stream_declaring_list":14,"type_specifier":15,"init_declarator_list":16,"init_declarator":17,",":18,"declarator":19,"=":20,"initializer":21,"IDENTIFIER":22,"(":23,")":24,"[":25,"constant_expression":26,"]":27,"stream_type_specifier":28,"assignment_expression":29,"{":30,"initializer_list":31,"}":32,"parameter_type_list":33,"compound_statement":34,"parameter_declaration":35,"composite_head":36,"composite_body":37,"COMPOSITE":38,"composite_head_inout":39,"INPUT":40,"composite_head_inout_member_list":41,"OUTPUT":42,"composite_head_inout_member":43,"STREAM":44,"<":45,"stream_declaration_list":46,">":47,"composite_body_param_opt":48,"statement_list":49,"PARAM":50,"operator_add":51,"ADD":52,"operator_pipeline":53,"operator_splitjoin":54,"operator_layer":55,"operator_default_call":56,"PIPELINE":57,"SPLITJOIN":58,"split_statement":59,"join_statement":60,"SPLIT":61,"duplicate_statement":62,"roundrobin_statement":63,"ROUNDROBIN":64,"argument_expression_list":65,"DUPLICATE":66,"exp":67,"JOIN":68,"DENSE":69,"CONV2D":70,"statement":71,"labeled_statement":72,"expression_statement":73,"selection_statement":74,"iteration_statement":75,"jump_statement":76,"CASE":77,":":78,"DEFAULT":79,"multi_expression":80,"IF":81,"expression":82,"ELSE":83,"SWITCH":84,"WHILE":85,"DO":86,"FOR":87,"CONTINUE":88,"BREAK":89,"RETURN":90,"matrix_slice_pair":91,"matrix_slice_pair_list":92,"matrix_slice":93,"vector_expression":94,"primary_expression":95,"NUMBER":96,"STRING_LITERAL":97,"operator_arguments":98,"postfix_expression":99,".":100,"++":101,"--":102,"FILEREADER":103,"stringConstant":104,"operator_selfdefine_body":105,"SEQUENTIAL":106,"unary_expression":107,"unary_operator":108,"basic_type_name":109,"+":110,"-":111,"~":112,"!":113,"*":114,"/":115,"%":116,"^":117,"|":118,"&":119,"<=":120,">=":121,"==":122,"!=":123,"<<":124,">>":125,"||":126,"&&":127,"conditional_expression":128,"?":129,"assignment_operator":130,"ASSIGNMENT_OPERATOR":131,"operator_selfdefine_body_init":132,"operator_selfdefine_body_work":133,"operator_selfdefine_body_window_list":134,"INIT":135,"WORK":136,"WINDOW":137,"operator_selfdefine_window_list":138,"operator_selfdefine_window":139,"window_type":140,"SLIDING":141,"TUMBLING":142,"CONST":143,"INT":144,"LONG":145,"FLOAT":146,"DOUBLE":147,"STRING":148,"$accept":0,"$end":1},
    terminals_: {2:"error",5:"EOF",10:"IMPORT",11:"MATRIX",12:";",18:",",20:"=",22:"IDENTIFIER",23:"(",24:")",25:"[",27:"]",30:"{",32:"}",38:"COMPOSITE",40:"INPUT",42:"OUTPUT",44:"STREAM",45:"<",47:">",50:"PARAM",52:"ADD",57:"PIPELINE",58:"SPLITJOIN",61:"SPLIT",64:"ROUNDROBIN",66:"DUPLICATE",68:"JOIN",69:"DENSE",70:"CONV2D",77:"CASE",78:":",79:"DEFAULT",81:"IF",83:"ELSE",84:"SWITCH",85:"WHILE",86:"DO",87:"FOR",88:"CONTINUE",89:"BREAK",90:"RETURN",96:"NUMBER",97:"STRING_LITERAL",100:".",101:"++",102:"--",103:"FILEREADER",104:"stringConstant",106:"SEQUENTIAL",110:"+",111:"-",112:"~",113:"!",114:"*",115:"/",116:"%",117:"^",118:"|",119:"&",120:"<=",121:">=",122:"==",123:"!=",124:"<<",125:">>",126:"||",127:"&&",129:"?",131:"ASSIGNMENT_OPERATOR",135:"INIT",136:"WORK",137:"WINDOW",141:"SLIDING",142:"TUMBLING",143:"CONST",144:"INT",145:"LONG",146:"FLOAT",147:"DOUBLE",148:"STRING"},
    productions_: [0,[3,2],[4,1],[4,2],[6,1],[6,1],[6,1],[6,3],[8,2],[8,2],[13,2],[16,1],[16,3],[17,1],[17,3],[19,1],[19,3],[19,4],[19,3],[14,2],[14,3],[21,1],[21,3],[21,4],[31,1],[31,3],[7,6],[7,5],[33,1],[33,3],[35,2],[9,2],[36,5],[39,0],[39,2],[39,5],[39,2],[39,5],[41,1],[41,3],[43,2],[28,4],[46,2],[46,4],[37,4],[48,0],[48,3],[51,2],[51,2],[51,2],[51,2],[53,4],[54,6],[54,7],[59,2],[59,2],[63,4],[63,5],[62,4],[62,5],[60,2],[56,4],[56,5],[55,5],[55,5],[71,1],[71,1],[71,1],[71,1],[71,1],[71,1],[71,1],[71,1],[72,4],[72,3],[34,2],[34,3],[49,1],[49,2],[73,1],[73,2],[74,5],[74,7],[74,5],[75,5],[75,7],[75,6],[75,7],[76,2],[76,2],[76,2],[76,3],[91,1],[91,1],[91,2],[91,2],[91,3],[92,1],[92,3],[93,3],[94,3],[80,1],[80,3],[95,1],[95,1],[95,1],[95,3],[95,1],[98,2],[98,3],[99,1],[99,2],[99,2],[99,3],[99,3],[99,2],[99,2],[99,6],[99,3],[99,9],[99,10],[99,7],[99,10],[65,1],[65,3],[107,1],[107,2],[107,2],[107,2],[107,4],[108,1],[108,1],[108,1],[108,1],[67,1],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[67,3],[128,1],[128,5],[29,1],[29,3],[130,1],[130,1],[82,1],[26,1],[105,5],[105,6],[132,0],[132,2],[133,2],[134,0],[134,4],[138,1],[138,2],[139,3],[140,3],[140,3],[140,4],[140,4],[15,1],[15,2],[109,1],[109,1],[109,2],[109,1],[109,1],[109,1],[109,1]],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
    /* this == yyval */

    var $0 = $$.length - 1;
    switch (yystate) {
    case 1:
     return $$[$0-1] 
    case 2: case 11: case 97:
     this.$ = [$$[$0]]; 
    break;
    case 3: case 12: case 29: case 39: case 124: case 169:
     this.$.push($$[$0]); 
    break;
    case 7:
     COStreamJS.plugins.matrix = true; 
    break;
    case 8: case 9: case 22: case 41: case 80: case 99: case 109: case 167:
     this.$ = $$[$0-1]; 
    break;
    case 10:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]); $$[$0].forEach(d=>d.type=$$[$0-1]); 
    break;
    case 13:
     this.$ = new declarator(this._$,$$[$0],undefined); 
    break;
    case 14:
     this.$ = new declarator(this._$,$$[$0-2],$$[$0]);        
    break;
    case 15:
     this.$ = new idNode(this._$,$$[$0]);                     
    break;
    case 16:
     error("暂未支持该种declarator的写法");         
    break;
    case 17:
     $$[$0-3].arg_list.push($$[$0-1]);                       
    break;
    case 18:
     $$[$0-2].arg_list.push(0);                        
    break;
    case 19:
     this.$ = new declareNode(this._$,$$[$0-1],$$[$0]);  
    break;
    case 20:
     this.$.init_declarator_list.push($$[$0]);
    break;
    case 23:
     this.$ = $$[$0-2]; 
    break;
    case 24: case 101: case 159: case 164: case 165:
     this.$ = $$[$0]; 
    break;
    case 25:
     this.$ = $$[$0-2] instanceof Array ? $$[$0-2].concat($$[$0]) : [$$[$0-2],$$[$0]];
    break;
    case 26:
     this.$ = new function_definition(this._$,$$[$0-5],$$[$0-4],$$[$0-2],$$[$0]); 
    break;
    case 27:
     this.$ = new function_definition(this._$,$$[$0-4],$$[$0-3],[],$$[$0]); 
    break;
    case 28: case 38: case 123: case 168:
     this.$ = [$$[$0]];   
    break;
    case 30:
     this.$ = new declarator(this._$,$$[$0]); this.$.type=$$[$0-1]; 
    break;
    case 31:
     this.$ = new compositeNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 32:
     this.$ = new compHeadNode(this._$,$$[$0-3],$$[$0-1]);  
    break;
    case 33: case 45: case 79:
     this.$ = undefined; 
    break;
    case 34:
     this.$ = new ComInOutNode(this._$,$$[$0]);          
    break;
    case 35:
     this.$ = new ComInOutNode(this._$,$$[$0-3],$$[$0]);       
    break;
    case 36:
     this.$ = new ComInOutNode(this._$,undefined,$$[$0]);
    break;
    case 37:
     this.$ = new ComInOutNode(this._$,$$[$0],$$[$0-3]);       
    break;
    case 40:
     this.$ = new inOutdeclNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 42:
     this.$ = new strdclNode(this._$,$$[$0-1],$$[$0]);              
    break;
    case 43:
     this.$.id_list.push({ type:$$[$0-1],identifier:$$[$0] }); 
    break;
    case 44:
     this.$ = new compBodyNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 46:
     this.$ = new paramNode(this._$,$$[$0-1]);       
    break;
    case 47: case 48: case 49: case 50:
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
     this.$ = new compositeCallNode(this._$,$$[$0-4],[],$$[$0-2]); 
    break;
    case 63:
     this.$ = new denseLayerNode(this._$,"DENSE", $$[$0-2]);
    break;
    case 64:
     debug("暂未支持 conv2D"); /* this.$ = new conv2DLayerNode(this._$,"conv2D", $$[$0-2]); */
    break;
    case 73:
     this.$ = new labeled_statement(this._$,$$[$0-3],$$[$0-2],$$[$0-1],$$[$0]);
    break;
    case 74:
     this.$ = new labeled_statement(this._$,$$[$0-2],undefined,$$[$0-1],$$[$0]);
    break;
    case 75:
     this.$ = new blockNode(this._$,$$[$0-1],[],$$[$0]); 
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
    case 92:
     this.$ = new matrix_slice_pair(this._$,undefined, ':');   
    break;
    case 93:
     this.$ = new matrix_slice_pair(this._$,$$[$0]);               
    break;
    case 94:
     this.$ = new matrix_slice_pair(this._$,$$[$0-1],':');           
    break;
    case 95:
     this.$ = new matrix_slice_pair(this._$,undefined,':',$$[$0]); 
    break;
    case 96:
     this.$ = new matrix_slice_pair(this._$,$$[$0-2],':',$$[$0]);        
    break;
    case 98:
     this.$ = this.$.concat($$[$0]); 
    break;
    case 100:
     this.$ = new matrix_constant(this._$, $$[$0-1]); 
    break;
    case 102:
     this.$ = Array.isArray($$[$0-2]) ? $$[$0-2].concat($$[$0]) : [$$[$0-2],$$[$0]]; 
    break;
    case 104: case 105:
     this.$ = new constantNode(this._$,$$[$0]); 
    break;
    case 106:
     this.$ = new parenNode(this._$,$$[$0-1]);    
    break;
    case 108:
     this.$ = []; 
    break;
    case 111:
     this.$ = new matrix_section(this._$,$$[$0-1],$$[$0]); 
    break;
    case 112:
     
                                                                    if(this.$ instanceof callNode){
                                                                        this.$ = new compositeCallNode(this._$,$$[$0-1].name,$$[$0-1].arg_list,$$[$0]);
                                                                    }         
                                                                    else {
                                                                        this.$ = new callNode(this._$,$$[$0-1],$$[$0]);
                                                                    }
                                                                
    break;
    case 113:
     this.$ = new lib_binopNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 114: case 135: case 136: case 137: case 138: case 139: case 140: case 141: case 142: case 143: case 144: case 145: case 146: case 147: case 148: case 149: case 150: case 151: case 152:
     this.$ = new binopNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
    break;
    case 115: case 116:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]);    
    break;
    case 117:
     error("暂不支持FILEREADER");      
    break;
    case 118:

                                                                    this.$ = new operatorNode(this._$,$$[$0-2],$$[$0-1],$$[$0]);
                                                                
    break;
    case 119:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-6],
                                                                        stmt_list: undefined,
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 120:

                                                                    this.$ = new splitjoinNode(this._$,{
                                                                        compName: 'splitjoin',
                                                                        inputs: $$[$0-7],
                                                                        stmt_list: $$[$0-4],
                                                                        split: $$[$0-3],
                                                                        body_stmts: $$[$0-2],
                                                                        join: $$[$0-1]
                                                                    });
                                                                
    break;
    case 121:

                                                                    this.$ = new pipelineNode(this._$,{
                                                                        compName: 'pipeline',
                                                                        inputs: $$[$0-4],
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 122:

                                                                    this.$ = new sequentialNode(this._$,{
                                                                        compName: 'squential',
                                                                        inputs: $$[$0-7],
                                                                        arg_list: $$[$0-4],
                                                                        body_stmts: $$[$0-1]
                                                                    });
                                                                
    break;
    case 126: case 127: case 128:
     this.$ = new unaryNode(this._$,$$[$0-1],$$[$0]); 
    break;
    case 129:
     this.$ = new castNode(this._$,$$[$0-2],$$[$0]); 
    break;
    case 154:
     this.$ = new ternaryNode(this._$,$$[$0-4],$$[$0-2],$$[$0]); 
    break;
    case 156:

              if([splitjoinNode,pipelineNode,compositeCallNode,operatorNode,sequentialNode].some(x=> $$[$0] instanceof x)){
                  if($$[$0-2] instanceof parenNode){
                      $$[$0].outputs = $$[$0-2].exp.slice();
                  }else if(typeof $$[$0-2] == "string"){
                      $$[$0].outputs = [$$[$0-2]];
                  }else {
                      error("只支持 S = oper()() 或 (S1,S2) = oper()() 两种方式",$$[$0-2],$$[$0]); 
                  }
              }
              this.$ = new binopNode(this._$,$$[$0-2],$$[$0-1],$$[$0]); 
          
    break;
    case 161:

               this.$ = new operBodyNode(this._$,[],$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 162:

               this.$ = new operBodyNode(this._$,$$[$0-4],$$[$0-3],$$[$0-2],$$[$0-1]);
           
    break;
    case 170:
     this.$ = new winStmtNode(this._$,$$[$0-2],$$[$0-1]); 
    break;
    case 171: case 172:
     this.$ = { type:$$[$0-2] }; 
    break;
    case 173: case 174:
     this.$ = { type:$$[$0-3], arg_list: $$[$0-1]}; 
    break;
    case 176:
     this.$ = "const "+$$[$0]; 
    break;
    case 179:
     this.$ = "long long"; 
    break;
    }
    },
    table: [{3:1,4:2,6:3,7:4,8:5,9:6,10:$V0,11:$V1,13:9,14:10,15:8,28:14,36:11,38:$V2,44:$V3,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{1:[3]},{5:[1,23],6:24,7:4,8:5,9:6,10:$V0,11:$V1,13:9,14:10,15:8,28:14,36:11,38:$V2,44:$V3,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Va,[2,2]),o($Va,[2,4]),o($Va,[2,5]),o($Va,[2,6]),{11:[1,25]},{16:27,17:30,19:26,22:$Vb,23:$Vc},{12:[1,31]},{12:[1,32],18:[1,33]},{30:[1,35],37:34},o($Vd,[2,175]),{11:$V1,109:36,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{22:[1,37]},{22:[1,38]},o($Ve,[2,177]),o($Ve,[2,178],{145:[1,39]}),o($Ve,[2,180]),o($Ve,[2,181]),o($Ve,[2,182]),o($Vd,$Vf),{45:[1,40]},{1:[2,1]},o($Va,[2,3]),{12:[1,41]},o($Vg,$Vh,{20:$Vi,23:[1,42],25:$Vj}),{12:[2,10],18:[1,45]},o($Vk,[2,15]),{19:46,22:$Vb,23:$Vc},o($Vg,[2,11]),o($Vl,[2,8]),o($Vl,[2,9]),{22:[1,47]},o($Va,[2,31]),o($Vm,[2,45],{48:48,50:[1,49]}),o($Vd,[2,176]),o($Vg,[2,19]),{23:[1,50]},o($Ve,[2,179]),{11:$V1,15:52,46:51,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Va,[2,7]),{11:$V1,15:56,24:[1,54],33:53,35:55,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,26:57,27:[1,58],57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:59},{11:$Vn,21:82,22:$Vo,23:$Vp,25:$Vq,29:83,30:$VD,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{17:87,19:88,22:$Vb,23:$Vc},{24:[1,89],25:$Vj},o($Vg,[2,20]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:90,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$V1,15:56,33:118,35:55,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{24:[2,33],39:119,40:[1,120],42:[1,121]},{18:[1,123],47:[1,122]},{22:[1,124]},{18:$VS,24:[1,125]},{30:$VG,34:127},o($VT,[2,28]),{19:128,22:$Vb,23:$Vc},{27:[1,129]},o($Vk,[2,18]),o([27,78],[2,160]),o($VU,$VV,{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,126:$Va1,127:$Vb1,129:$Vc1}),o($Vd1,$Ve1),o($Vf1,[2,125],{93:149,98:150,23:[1,155],25:[1,154],100:[1,151],101:[1,152],102:[1,153]}),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:156,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:157,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:158,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$VE,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,80:160,82:114,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:159,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vg1,[2,110]),{100:$Vh1},{23:[1,162]},{23:[1,163]},{23:[1,164]},{23:[1,165]},o($Vi1,[2,130]),o($Vi1,[2,131]),o($Vi1,[2,132]),o($Vi1,[2,133]),o($Vg1,[2,103]),o($Vg1,[2,104]),o($Vg1,[2,105]),o($Vg1,[2,107]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,80:166,82:114,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vg,[2,14]),o($Vj1,[2,21]),{11:$Vn,21:168,22:$Vo,23:$Vp,25:$Vq,29:83,30:$VD,31:167,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($VU,[2,155]),o($Vd1,$Ve1,{130:169,20:[1,170],131:[1,171]}),o($Vg,[2,12]),o($Vg,$Vh,{20:$Vi,25:$Vj}),o($Vk,[2,16]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,172],34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vk1,[2,77]),o($Vl1,[2,65]),o($Vl1,[2,66]),o($Vl1,[2,67]),o($Vl1,[2,68]),o($Vl1,[2,69]),o($Vl1,[2,70]),o($Vl1,[2,71]),o($Vl1,[2,72]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,26:174,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:59},{78:[1,175]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,176],34:93,44:$V3,49:177,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vm1,[2,79]),{12:[1,178],18:$Vn1},{23:[1,180]},{23:[1,181]},{23:[1,182]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:183,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{23:[1,184]},{12:[1,185]},{12:[1,186]},{11:$Vn,12:[1,187],22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:188,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{22:[1,197],53:189,54:190,55:191,56:192,57:[1,193],58:[1,194],69:[1,195],70:[1,196]},o($Vo1,[2,101]),{16:27,17:30,19:88,22:$Vb,23:$Vc},o([12,18,24,27,78],[2,159]),o($Ve,$Vf,{100:$Vh1}),{12:[1,198],18:$VS},{24:[1,199]},{28:202,41:200,43:201,44:$V3},{28:202,41:203,43:201,44:$V3},{22:[2,41]},{11:$V1,15:204,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vp1,[2,42]),{30:$VG,34:205},{11:$V1,15:56,35:206,109:12,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Va,[2,27]),o($VT,[2,30],{25:$Vj}),o($Vk,[2,17]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:207,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:208,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:209,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:210,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:211,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:212,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:213,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:214,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:215,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:216,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:217,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:218,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:219,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:220,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:221,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:222,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:223,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:224,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:225,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},o($Vg1,[2,111]),o($Vg1,[2,112],{105:226,30:[1,227]}),{22:[1,228]},o($Vg1,[2,115]),o($Vg1,[2,116]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:233,78:$Vq1,82:232,91:230,92:229,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,24:[1,234],25:$Vq,29:236,57:$Vr,58:$Vs,65:235,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vf1,[2,126]),o($Vf1,[2,127]),o($Vf1,[2,128]),{24:[1,237]},{18:$Vn1,24:[1,238]},{22:[1,239]},{24:[1,240]},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:241,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:242,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:243,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{18:$Vn1,27:[1,244]},{18:[1,246],32:[1,245]},o($Vr1,[2,24]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:247,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vi1,[2,157]),o($Vi1,[2,158]),o($Va,[2,44]),o($Vk1,[2,78]),{78:[1,248]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:249,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vs1,[2,75]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,250],34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vm1,[2,80]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:251,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:252,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:253,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:254,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{85:[1,255]},{11:$Vn,12:$VF,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,73:256,80:104,82:114,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vl1,[2,88]),o($Vl1,[2,89]),o($Vl1,[2,90]),{12:[1,257]},o($Vl1,[2,47]),o($Vl1,[2,48]),o($Vl1,[2,49]),o($Vl1,[2,50]),{30:[1,258]},{30:[1,259]},{23:[1,260]},{23:[1,261]},{23:[1,262]},o($Vm,[2,46]),{30:[2,32]},{18:[1,263],24:[2,34]},o($Vt1,[2,38]),{22:[1,264]},{18:[1,265],24:[2,36]},{22:[1,266]},o($Va,[2,26]),o($VT,[2,29]),{78:[1,267]},o($Vd1,[2,135]),o($Vd1,[2,136]),o($Vu1,[2,137],{114:$V_,115:$V$,116:$V01}),o($Vu1,[2,138],{114:$V_,115:$V$,116:$V01}),o($Vd1,[2,139]),o([12,18,24,27,32,78,117,118,126,127,129],[2,140],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91}),o([12,18,24,27,32,78,118,126,127,129],[2,141],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91}),o([12,18,24,27,32,78,117,118,119,126,127,129],[2,142],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91}),o($Vv1,[2,143],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,124:$V81,125:$V91}),o($Vv1,[2,144],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,124:$V81,125:$V91}),o($Vv1,[2,145],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,124:$V81,125:$V91}),o($Vv1,[2,146],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,124:$V81,125:$V91}),o($Vw1,[2,147],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,120:$V41,121:$V51,124:$V81,125:$V91}),o($Vw1,[2,148],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,120:$V41,121:$V51,124:$V81,125:$V91}),o($Vx1,[2,149],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01}),o($Vx1,[2,150],{110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01}),o([12,18,24,27,32,78,126,129],[2,151],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,127:$Vb1}),o([12,18,24,27,32,78,126,127,129],[2,152],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91}),o($Vg1,[2,118]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:269,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,132:268,135:$Vy1,136:$Vz1,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vg1,[2,114]),{18:[1,272],27:[1,271]},o($VA1,[2,97]),o($VA1,[2,92],{107:61,99:62,108:65,95:67,94:80,67:273,11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,96:$Vt,97:$Vu,101:$Vv,102:$Vw,103:$Vx,106:$Vy,110:$Vz,111:$VA,112:$VB,113:$VC}),o($VA1,[2,93]),o($VA1,$VV,{45:$VW,47:$VX,78:[1,274],110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,126:$Va1,127:$Vb1,129:$Vc1}),o($VB1,[2,108]),{18:$VC1,24:[1,275]},o($Vt1,[2,123]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:277,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},o($Vg1,[2,106]),o($Vg1,[2,113]),{23:[1,278]},{18:$VC1,24:[1,279]},{18:$VC1,24:[1,280]},{18:$VC1,24:[1,281]},o($Vg1,[2,100]),o($Vj1,[2,22]),{11:$Vn,21:283,22:$Vo,23:$Vp,25:$Vq,29:83,30:$VD,32:[1,282],57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($VU,[2,156]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:284,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vl1,[2,74]),o($Vs1,[2,76]),o($Vo1,[2,102]),{24:[1,285]},{24:[1,286]},{24:[1,287]},{23:[1,288]},{11:$Vn,12:$VF,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,73:289,80:104,82:114,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vl1,[2,91]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:290,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:292,51:99,52:$VH,57:$Vr,58:$Vs,59:291,61:$VD1,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:294,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:295,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,24:[1,296],25:$Vq,29:236,57:$Vr,58:$Vs,65:297,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{28:202,42:[1,298],43:299,44:$V3},o($Vt1,[2,40]),{28:202,40:[1,300],43:299,44:$V3},o($Vp1,[2,43]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:301},{133:302,136:$VE1},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,132:304,135:$Vy1,136:$Vz1,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{30:$VG,34:305},o($Vg1,[2,99]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:233,78:$Vq1,82:232,91:306,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($VA1,[2,95],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,126:$Va1,127:$Vb1}),o($VA1,[2,94],{107:61,99:62,108:65,95:67,94:80,67:307,11:$Vn,22:$Vo,23:$Vp,25:$Vq,57:$Vr,58:$Vs,96:$Vt,97:$Vu,101:$Vv,102:$Vw,103:$Vx,106:$Vy,110:$Vz,111:$VA,112:$VB,113:$VC}),o($VB1,[2,109]),{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:308,57:$Vr,58:$Vs,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vf1,[2,129]),{104:[1,309]},{30:[1,310]},{30:[1,311]},{23:[1,312]},o($Vj1,[2,23]),o($Vr1,[2,25]),o($Vl1,[2,73]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:313,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:314,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:315,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:316,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,24:[1,317],25:$Vq,29:116,57:$Vr,58:$Vs,67:60,82:318,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,319],34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:320,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,59:321,61:$VD1,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{62:322,63:323,64:$VF1,66:[1,324]},{18:$VC1,24:[1,326]},{18:$VC1,24:[1,327]},{12:[1,328]},{18:$VC1,24:[1,329]},{28:202,41:330,43:201,44:$V3},o($Vt1,[2,39]),{28:202,41:331,43:201,44:$V3},o($VU,[2,154]),{32:$VG1,134:332,137:$VH1},{30:$VG,34:334},{133:335,136:$VE1},{136:[2,164]},o($VA1,[2,98]),o($VA1,[2,96],{45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,126:$Va1,127:$Vb1}),o($Vt1,[2,124]),{24:[1,336]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:338,51:99,52:$VH,57:$Vr,58:$Vs,59:337,61:$VD1,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:339,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$Vn,22:$Vo,23:$Vp,25:$Vq,29:236,57:$Vr,58:$Vs,65:340,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vk1,[2,81],{83:[1,341]}),o($Vl1,[2,83]),o($Vl1,[2,84]),{24:[1,342]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:343,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{24:[1,344]},o($Vl1,[2,51]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,60:345,67:60,68:$VI1,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:347,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vm,[2,54]),o($Vm,[2,55]),{23:[1,348]},{23:[1,349]},{12:[1,350]},{12:[1,351]},o($Vl1,[2,61]),{12:[1,352]},{18:$VJ1,24:[2,35]},{18:$VJ1,24:[2,37]},{32:[1,354]},{30:[1,355]},o([32,137],[2,165]),{32:$VG1,134:356,137:$VH1},o($Vg1,[2,117]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:357,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,59:358,61:$VD1,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,359],34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{18:$VC1,24:[1,360]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:361,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{12:[1,362]},o($Vl1,[2,86]),{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:363,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{32:[1,364]},{63:365,64:$VF1},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,60:366,67:60,68:$VI1,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{11:$Vn,22:$Vo,23:$Vp,24:[1,367],25:$Vq,57:$Vr,58:$Vs,67:368,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:61,108:65,110:$Vz,111:$VA,112:$VB,113:$VC},{11:$Vn,22:$Vo,23:$Vp,24:[1,369],25:$Vq,29:236,57:$Vr,58:$Vs,65:370,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vl1,[2,63]),o($Vl1,[2,64]),o($Vl1,[2,62]),{28:202,43:299,44:$V3},o($Vg1,[2,161]),{22:$VK1,138:371,139:372},{32:[1,374]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,60:375,67:60,68:$VI1,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:376,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vg1,[2,121]),{30:[1,377]},o($Vl1,[2,82]),o($Vl1,[2,85]),o($Vl1,[2,87]),o($Vl1,[2,52]),{32:[2,60]},{32:[1,378]},{12:[1,379]},{24:[1,380],45:$VW,47:$VX,110:$VY,111:$VZ,114:$V_,115:$V$,116:$V01,117:$V11,118:$V21,119:$V31,120:$V41,121:$V51,122:$V61,123:$V71,124:$V81,125:$V91,126:$Va1,127:$Vb1},{12:[1,381]},{18:$VC1,24:[1,382]},{22:$VK1,32:[1,383],139:384},o($VL1,[2,168]),{140:385,141:[1,386],142:[1,387]},o($Vg1,[2,162]),{32:[1,388]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,60:389,67:60,68:$VI1,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,34:93,44:$V3,49:390,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:91,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vl1,[2,53]),o($Vm,[2,58]),{12:[1,391]},o($VM1,[2,56]),{12:[1,392]},{32:[2,167]},o($VL1,[2,169]),{12:[1,393]},{23:[1,394]},{23:[1,395]},o($Vg1,[2,119]),{32:[1,396]},{8:98,11:$VE,12:$VF,13:9,14:10,15:115,22:$Vo,23:$Vp,25:$Vq,28:14,29:116,30:$VG,32:[1,397],34:93,44:$V3,51:99,52:$VH,57:$Vr,58:$Vs,67:60,71:173,72:92,73:94,74:95,75:96,76:97,77:$VI,79:$VJ,80:104,81:$VK,82:114,84:$VL,85:$VM,86:$VN,87:$VO,88:$VP,89:$VQ,90:$VR,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,109:12,110:$Vz,111:$VA,112:$VB,113:$VC,128:85,143:$V4,144:$V5,145:$V6,146:$V7,147:$V8,148:$V9},o($Vm,[2,59]),o($VM1,[2,57]),o($VL1,[2,170]),{11:$Vn,22:$Vo,23:$Vp,24:[1,398],25:$Vq,29:236,57:$Vr,58:$Vs,65:399,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},{11:$Vn,22:$Vo,23:$Vp,24:[1,400],25:$Vq,29:236,57:$Vr,58:$Vs,65:401,67:60,94:80,95:67,96:$Vt,97:$Vu,99:62,101:$Vv,102:$Vw,103:$Vx,106:$Vy,107:86,108:65,110:$Vz,111:$VA,112:$VB,113:$VC,128:85},o($Vg1,[2,120]),o($Vg1,[2,122]),{12:[2,171]},{18:$VC1,24:[1,402]},{12:[2,172]},{18:$VC1,24:[1,403]},{12:[2,173]},{12:[2,174]}],
    defaultActions: {23:[2,1],122:[2,41],199:[2,32],305:[2,164],365:[2,60],383:[2,167],398:[2,171],400:[2,172],402:[2,173],403:[2,174]},
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
        
            var lex = function () {
                var token;
                token = lexer.lex() || EOF;
                if (typeof token !== 'number') {
                    token = self.symbols_[token] || token;
                }
                return token;
            };
        var symbol, state, action, r, yyval = {}, p, len, newState, expected;
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
                {
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
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
    case 3:return 96
    case 4:return 97
    case 5:return 148
    case 6:return 144
    case 7:return 147
    case 8:return 146
    case 9:return 145
    case 10:return 143
    case 11:return 'DEFINE'
    case 12:return 85
    case 13:return 87
    case 14:return 89
    case 15:return 88
    case 16:return 84
    case 17:return 77
    case 18:return 79
    case 19:return 81
    case 20:return 83
    case 21:return 86
    case 22:return 90
    case 23:return 38
    case 24:return 40
    case 25:return 42
    case 26:return 44
    case 27:return 103
    case 28:return 'FILEWRITER'
    case 29:return 52
    case 30:return 50
    case 31:return 135
    case 32:return 136
    case 33:return 137
    case 34:return 142
    case 35:return 141
    case 36:return 58
    case 37:return 57
    case 38:return 61
    case 39:return 68
    case 40:return 66
    case 41:return 64
    case 42:return 106
    case 43:return 69
    case 44:return 70
    case 45:return 10
    case 46:return 11
    case 47:return 22
    case 48:return 131
    case 49:return yy_.yytext
    case 50:return yy_.yytext
    case 51:return 5
    case 52:return 'INVALID'
    }
    },
    rules: [/^(?:\s+)/,/^(?:\/\*([^\*]|(\*)*[^\*/])*(\*)*\*\/)/,/^(?:\/\/.*)/,/^(?:(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b)/,/^(?:('[^']*'|"[^\"]*"))/,/^(?:string\b)/,/^(?:int\b)/,/^(?:double\b)/,/^(?:float\b)/,/^(?:long\b)/,/^(?:const\b)/,/^(?:define\b)/,/^(?:while\b)/,/^(?:for\b)/,/^(?:break\b)/,/^(?:continue\b)/,/^(?:switch\b)/,/^(?:case\b)/,/^(?:default\b)/,/^(?:if\b)/,/^(?:else\b)/,/^(?:do\b)/,/^(?:return\b)/,/^(?:composite\b)/,/^(?:input\b)/,/^(?:output\b)/,/^(?:stream\b)/,/^(?:FileReader\b)/,/^(?:FileWriter\b)/,/^(?:add\b)/,/^(?:param\b)/,/^(?:init\b)/,/^(?:work\b)/,/^(?:window\b)/,/^(?:tumbling\b)/,/^(?:sliding\b)/,/^(?:splitjoin\b)/,/^(?:pipeline\b)/,/^(?:split\b)/,/^(?:join\b)/,/^(?:duplicate\b)/,/^(?:roundrobin\b)/,/^(?:sequential\b)/,/^(?:DENSE|Dense\b)/,/^(?:CONV2D\b)/,/^(?:import\b)/,/^(?:Matrix|matrix\b)/,/^(?:[a-zA-Z_][a-zA-Z0-9_]*)/,/^(?:\*=|\/=|\+=|-=|<<=|>>=|&=|\^=|\|=)/,/^(?:##|\+\+|--|>>|>>|<=|>=|==|!=|&&|\|\|)/,/^(?:[-*+/%&|~!()\[\]{}'"#,\.?:;<>=])/,/^(?:$)/,/^(?:.)/],
    conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],"inclusive":true}}
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

    class FlatNode {
        constructor(/** @type {operatorNode} */ node, params = []) {
            this.name = node.operName;       // opeator名字
            this.PreName = node.operName;    // cwb记录Operator被重命名前的名字
            this.visitTimes = 0;             // 表示该结点是否已经被访问过,与dumpdot有关

            this._symbol_table = undefined; // 存储对应 operator 所在的 composite 的符号表. 主要目的是获取 paramNames

            /** @type {operatorNode} 指向operator(经常量传播后的) */
            this.contents = node;

            /** @type {number[]}*/
            this.params = params;

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

    const MAX_SCOPE_DEPTH = 10; //定义最大嵌套深度为100

    /** @type {SymbolTable[]} */
    let runningStack = [];
    const current_version = Array.from({length:MAX_SCOPE_DEPTH}).fill(0);
    const symbolTableList = /** @type{SymbolTable[]}*/[];


    class Constant {
        constructor(/* string */ type, val) {
            this.type = type;
            /** @type{number} */
            this.val = val;
        }
        print(/* boolean */ isArray) {
            console.log(`[Constant] type: ${this.type} val: ${this.val}`);
        }

    }
    class ArrayConstant {
        constructor(type /* string */, values, arg_list) {
            this.type = type;
            /** @type {Array<Constant>} */
            this.values = values;
            /** @type {number[]} */
            this.arg_list = arg_list || [];
        }
        print() { };
    }
    class Variable {
        constructor(valType, name, i, _loc) {
            this.type = valType;
            this.name = name;
            this._loc = _loc;
            if (i instanceof Constant) {
                this.value = i;
            }
            else if (i instanceof ArrayConstant) {
                this.array = i;
            }
            else {
                this.value = new Constant(valType, i);
            }
        }
    }

    class CompositeSymbol {
        constructor(/** @type {compositeNode} */ comp) {
            this.composite = comp;
            this.count = 0; // 用于区分多次调用同一 composite
        }
    }
    class SymbolTable {
        constructor(prev, loc) {
            this.count = 0; // FIXME: 不确定有什么用
            this.root = prev ? prev.root : this; // 标记全局最根部的符号表
            this.loc = loc;
            /** @type {SymbolTable} */
            this.prev = prev;
            symbolTableList.push(this);
            this.sid = SymbolTable.sid++;

            this.funcTable = {};
            /** @type {Dict<{strType: strdclNode, fromIndex: number, fromFlatNode:FlatNode, toIndex: number, toFlatNode: FlatNode}>} */
            this.streamTable = {};  
            
            /** @type {Dict<Variable>} */
            this.memberTable = {}; // 专门用来存储一个operator的成员变量字段
            this.paramNames = [];
            this.variableTable = {}; //变量
            this.compTable = {}; // composite
            this.optTable = {}; //operator
        };
        getPrev() {
            return this.prev;
        }
        /** @returns { {type: 'variable'|'stream' |'func'|'oper'|'member', origin: SymbolTable}}  */
        searchName(name){
            if(this.variableTable.hasOwnProperty(name)) return { type: 'variable', origin: this}
            if(this.streamTable.hasOwnProperty(name))   return { type: 'stream', origin: this}
            if(this.funcTable.hasOwnProperty(name))     return { type: 'func', origin: this}
            if(this.optTable.hasOwnProperty(name))      return { type: 'oper', origin: this}
            if(this.memberTable.hasOwnProperty(name))   return { type: 'member', origin: this}
            if(this.prev)                return this.prev.searchName(name)
            return undefined;
        }
        getVariableValue(name){
            return this.LookupIdentifySymbol(name).value.val;
        }
        setVariableValue(name,val){
            return this.LookupIdentifySymbol(name).value.val = val
        }
        getExactSymbolTable(name){
            if(this.variableTable[name]) return this
            return this.prev && this.prev.getExactSymbolTable(name)
        }
        /** @returns{Variable} */
        LookupIdentifySymbol(name){
            if(this.variableTable[name]) return this.variableTable[name]
            if(this.prev){
                return this.prev.LookupIdentifySymbol(name)
            }else {
                console.warn(`在符号表中查找不到该变量的值: ${name}`);
            }
        }
        InsertCompositeSymbol(/** @type {compositeNode} */comp){
            this.compTable[comp.compName] = new CompositeSymbol(comp);
        }
        InsertStreamSymbol(/** @type {inOutdeclNode} */ inOutNode){
            const name = inOutNode.id;
            this.streamTable[name] ? console.log(`stream ${name} has been declared`)
            : this.streamTable[name]= { strType: inOutNode.strType };
        }
        InsertOperatorSymbol(name, operatorNode){
            this.optTable[name] = operatorNode;
        }
        InsertMemberSymbol(/** @type {declareNode} */ decl){
            decl.init_declarator_list.forEach((/** @type {declarator} */de) =>{
                let name = de.identifier.name;
                let { initializer, arg_list } = de.identifier;
                if(de.identifier.arg_list.length){
                    let array_c = new ArrayConstant(de.type,initializer, arg_list.map(_=>_.value));
                    var variable = new Variable(de.type,name,array_c, de._loc);
                }else {
                    var variable = new Variable(de.type,name,initializer, de._loc);
                }
                variable._loc = decl._loc;
                this.memberTable[name] = variable;
            });
        }
        LookupFunctionSymbol(name){
            if(this.funcTable[name]) return this.funcTable[name]
            if(this.prev){
                return this.prev.LookupFunctionSymbol(name)
            }else {
                console.warn(`在符号表中查找不到该函数: ${name}`);
            }
        }
    }
    SymbolTable.sid = 0; // 类的静态类型, 类似 vue 的 cid, 用来区分生成的符号表的顺序

    SymbolTable.prototype.InsertIdentifySymbol = function InsertIdentifySymbol(node, /** @type {Constant} */ constant){
        if(node instanceof Node){
            if(node instanceof declarator){
                let name = node.identifier.name;
                let variable = new Variable(node.type, name, constant, node._loc); // 无论传入的是常量还是变量, 归一为 Variable 结构

                this.variableTable[name] ? console.log(`${name} had been declared`)
                                     : this.variableTable[name]= variable;
            }else if(node instanceof inOutdeclNode){
                let name = node.id;
                this.variableTable[name] ? console.log(`${name} had been declared`)
                                     : this.variableTable[name]= null;
            }
        }else if(node instanceof Variable){
            let name = node.name;
            this.variableTable[name] ? console.log(`${name} had been declared`)
                                     : this.variableTable[name]= node;
        }else {
            throw new Error("插入 IndetifySymbol 时出错, node 类型错误")
        }
    };

    const BUILTIN_MATH = ['pow', 'sin','cos','tan','floor','round','ceil','abs','log','sqrt'];
    const BUILTIN_FUNCTIONS = ['print','println'].concat(BUILTIN_MATH);

    /** @type {SymbolTable} */
    let top;
    function setTop(newTop){ top = newTop; }

    let saved = [];

    function EnterScopeFn(/** @type {YYLTYPE}*/loc){ 
        saved.push(top);
        top = new SymbolTable(top,loc);
    }

    function ExitScopeFn(){
        top = saved.pop();
    }

    /**
     * 生成符号表
     */
    function generateSymbolTables(program){
        let S = new SymbolTable();
        S.loc = {first_line:0,last_line:Infinity};
        symbolTableList.length = 0; // 清空旧的符号表(当程序重复执行时可能会遇到符号表 List 不为空的情况)
        symbolTableList.push(S); 
        top = S;
        
        program.forEach(node => {
            if(node instanceof declareNode){
                generateDeclareNode(node);
            }
            else if(node instanceof compositeNode){
                top.InsertCompositeSymbol(node);
                EnterScopeFn(node._loc);/* 进入 composite 块级作用域 */ 
                generateComposite(node);
                ExitScopeFn(); /* 退出 composite 块级作用域 */ 
            } 
            else if(node instanceof function_definition){
                console.warn("目前未支持函数符号表");
            }       
        });
        return symbolTableList;
    }

    function generateDeclareNode(/** @type{declareNode} */node){
        node.init_declarator_list.forEach(init_node=>{
            if(Array.isArray(init_node.initializer)){ //是数组
                let array = new ArrayConstant(node.type);
                array.values = (init_node.initializer||[]).map(init => new Constant(node.type, init.value));
                const variable = new Variable("array",init_node.identifier.name,array);
                top.InsertIdentifySymbol(variable);

            }else {
                // 不是数组的情况
                const constant = new Constant(node.type, (init_node.initializer || {}).value);
                top.InsertIdentifySymbol(init_node,constant);
            }
        });
    }

    // 解析 Composite 节点 
    function generateComposite(/** @type{compositeNode} */composite) {
        composite._symbol_table = top;
        let inout = composite.inout || {}; //输入输出参数
        let body = composite.body; //body
        // 第一步, 解析输入输出流 inout
        (inout.input_list || []).forEach(input => {
            const copy = deepCloneWithoutCircle(input);
            top.InsertStreamSymbol(copy);
        });
        (inout.output_list || []).forEach(output => {
            const copy = deepCloneWithoutCircle(output);
            top.InsertStreamSymbol(copy);
        });
        // 第二步 解析 param
        if(body.param && body.param.param_list){
            (body.param.param_list|| []).forEach(decl => { 
                top.InsertIdentifySymbol(decl);
                top.paramNames.push(decl.identifier.name);
            });
        }
        // 第三步 解析 body
        body.stmt_list.forEach(stmt => generateStmt(stmt));
    }

    // 解析 语句
    const ignoreTypes = [unaryNode, ternaryNode, parenNode, castNode, constantNode, matrix_section];
    function generateStmt(/** @type {Node} */stmt) {
        switch (stmt.constructor) {
            case Number: break;
            case String: {
                if (!top.searchName(stmt)) error$1(stmt._loc,`在当前符号表链中未找到${stmt}的定义`, top);
                break;
            }
            case declareNode: {
                if (stmt.type instanceof strdclNode) {
                    generateStrDlcNode(stmt);
                } else {
                    generateDeclareNode(stmt);
                }
                break;
            }
            case binopNode: {
                /** 常见的 binop 节点有2种情况, 
                 * 1. Out = Method(In){ ... } 这样右边是 operator 的, 则分别左右两边 generatStmt 即可进入流程
                 * 2. c = a+b+c 对于这种尝试进行常量传播
                 * 3. Out[0].x = In[0].x 对这种情况要校验流变量类型成员中是否有 x 字段 */
                if(stmt.op === '.'){
                    if(stmt.left instanceof matrix_section){
                        let streamName = stmt.left.exp;
                        let memberName = stmt.right;
                        const current = top.searchName(streamName).origin;
                        const type_list = current.streamTable[streamName].strType.id_list;
                        if(type_list.every(obj=> obj.identifier!=memberName)){
                            error$1(stmt._loc, `流 ${streamName} 上不存在成员 ${memberName}`);
                        }
                        
                    }
                }else {
                    if (stmt.op === '=' && stmt.left instanceof String && stmt.right instanceof expNode) {
                        let variable = top.LookupIdentifySymbol(stmt.left);
                        variable.value = right.value;
                    }
                    generateStmt(stmt.left);
                    generateStmt(stmt.right);
                }
                break;
            }
            case operatorNode: {
                top.InsertOperatorSymbol(stmt.operName, stmt);
                EnterScopeFn(stmt._loc);
                generateOperatorNode(stmt);  //解析 operator 节点
                ExitScopeFn();
                break;
            }
            case blockNode: {
                stmt.stmt_list.forEach(st => generateStmt(st)); // 深入 { 代码块 } 内部进行遍历
                break;
            }
            case whileNode: {
                EnterScopeFn(stmt._loc);
                generateStmt(stmt.exp);
                generateStmt(stmt.statement);
                ExitScopeFn();
                break;
            }
            case forNode: {
                EnterScopeFn(stmt._loc);
                const { init, cond, next, statement } = stmt;
                [init, cond, next, statement].forEach(generateStmt);
                ExitScopeFn();
                break;
            }
            case doNode: {
                EnterScopeFn(stmt);
                generateStmt(stmt.exp);
                generateStmt(stmt.statement);
                ExitScopeFn();
                break;
            }
            case selection_statement: {
                /** FIXME 暂未处理分支预测 */
                break;
            }
            case callNode: {
                /** FIXME: 函数调用这一块不够完美 */
                if(BUILTIN_FUNCTIONS.includes(stmt.name)) return 

                let func = top.LookupFunctionSymbol(stmt.name);
                stmt.actual_callnode = func;
                // 检查传入的参数是否存在
                break;
            }
            case splitjoinNode: generateSplitjoin(stmt); break;
            case pipelineNode: generatePipeline(stmt); break;
            case addNode: {
                generateStmt(stmt.content);
                break
            }
            case compositeCallNode: {
                /** 检查传入的参数是否存在 以及 获得参数值 FIXME */
                if(! symbolTableList[0].compTable[stmt.compName]){
                    error$1(stmt._loc, `此处调用的 composite 未定义:${stmt.compName}`);
                }
                break
            }
            default: {
                if (ignoreTypes.some(ignoreType => stmt instanceof ignoreType)) ; else {
                    console.warn("[generateStmt] FIXME: 暂未识别的 stmt 类型");
                }
            }
        }
    }

    // 处理 stream 声明变量的语句
    function generateStrDlcNode(/** @type {declareNode}*/ decl){  //stream "<int x,int y>" 这部分
        decl.init_declarator_list.forEach( identifier_name => {
            let stream_dlc = new inOutdeclNode();
            stream_dlc.strType = decl.type;
            stream_dlc.id = identifier_name;
            top.InsertStreamSymbol(stream_dlc);
        });
    }
    function generateOperatorNode(/** @type {operatorNode}*/oper){
        oper._symbol_table = top;
        let inputs = oper.inputs;
        let outputs = oper.outputs;
        let body = oper.operBody;
        
        const checkStreamId = name => {
            if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
                throw new Error(`当前 operator: ${oper.operName} 相关的流 ${name} 在作用域中未声明`)
            }
        };

        inputs && inputs.forEach(checkStreamId);
        outputs && outputs.forEach(checkStreamId);

        if(body){
            if(body.stmt_list){
                body.stmt_list.forEach(decl=>{
                    decl instanceof declareNode ? top.InsertMemberSymbol(decl)
                        :console.warn("[generateOperatorNode] 目前 operator 内部仅支持声明成员变量");
                });
            }
            if(body.init){
                EnterScopeFn(body.init._loc);
                generateStmt(body.init);
                body.init._symbol_table = top;
                ExitScopeFn();
            }
            if(body.work){
                EnterScopeFn(body.work._loc);
                generateStmt(body.work);
                body.work._symbol_table = top;
                ExitScopeFn();
            }
            if(body.window){
                body.window.forEach(winStmt =>checkStreamId(winStmt.winName));
            }
        }
    }

    // 解析 splitjoin
    function generateSplitjoin(/** @type {splitjoinNode} */ splitjoin){
        const checkStreamId = name => {
            if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
                throw new Error(`当前 operator: ${splitjoin.compName} 相关的流 ${name} 在作用域中未声明`)
            }
        }

        ;(splitjoin.inputs||[]).forEach(checkStreamId)
        ;(splitjoin.outputs||[]).forEach(checkStreamId)
        ;(splitjoin.stmt_list||[]).forEach(generateStmt)
        ;(splitjoin.body_stmts||[]).forEach(generateStmt);

        if(splitjoin.split){
            // 保证参数列表中不出现未声明的字符
            (splitjoin.split.arg_list||[]).forEach(generateStmt);
        }
     
        if(splitjoin.join){
            (splitjoin.join.arg_list||[]).forEach(generateStmt);
        }
    }

    // 解析 pipeline 节点 
    function generatePipeline(/** @type {pipelineNode} */pipe){
        const checkStreamId = name => {
            if(! top.searchName(name) || top.searchName(name).type !== 'stream'){
                throw new Error(`当前 operator: ${pipe.compName} 相关的流 ${name} 在作用域中未声明`)
            }
        }

        ;(pipe.inputs||[]).forEach(checkStreamId)
        ;(pipe.outputs||[]).forEach(checkStreamId)
        ;(pipe.body_stmts||[]).forEach(generateStmt);
    }


    /**
     * 
     * @param {operNode} call 
     * @param {compositeNode} composite 
     * @param {number[]} params
     */
    function generateCompositeRunningContext(call,composite,params=[]){
        top = new SymbolTable(top, composite._loc);

        generateComposite(composite);

        if(!composite.body) return top
        // 处理 param
        if(composite.body.param){
            composite.body.param.param_list.forEach((decla, index)=>{
                const variable = top.variableTable[decla.identifier.name];
                variable.value = new Constant(decla.type, params[index]);
            });
        }

        // 处理 inputs 和 outputs
        // 例子 composite Test(input stream<int x>In1, output stream<int x>Out1, stream<int x>Out2)
        if(composite.inout){
            composite.inout.input_list.forEach((inDecl, inIndex) => {
                let prevStream = top.prev.streamTable[call.inputs[inIndex]];
                let currentStream = top.streamTable[inDecl.id];
                const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(currentStream.strType);
                isTypeOK ? top.streamTable[inDecl.id] = prevStream
                         : error$1(call._loc, `调用${composite.compName}时输入流类型与定义不吻合`);
            });
            composite.inout.output_list.forEach((outDecl, outIndex) => {
                let prevStream = top.prev.streamTable[call.outputs[outIndex]];
                let currentStream = top.streamTable[outDecl.id];
                const isTypeOK = JSON.stringify(prevStream.strType) == JSON.stringify(currentStream.strType);
                isTypeOK ? top.streamTable[outDecl.id] = prevStream
                         : error$1(call._loc, `调用${composite.compName}时输出流类型与定义不吻合`);
            });
        }

        return top
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
        if(this.first == "++"){ // ++i 的情况
            if(typeof this.second !== 'string') error$1(this._loc, `++ 运算符的操作对象必须是变量`);
            let oldVal = top.getVariableValue(this.second);
            top.setVariableValue(this.first, oldVal+1);
            return oldVal+1

        }else if(this.second == "++"){ // i++ 的情况
            if(typeof this.first !== 'string') error$1(this._loc, `++ 运算符的操作对象必须是变量`);
            let oldVal = top.getVariableValue(this.first);
            top.setVariableValue(this.first, oldVal+1);
            return oldVal
        } 
        return NaN
    };

    castNode.prototype.getValue = function (){
        return this.type == 'int' ? Math.floor(this.exp.value) : this.exp.value
    };

    Object.defineProperty(String.prototype,'value',{
        get(){
            if(!Number.isNaN(parseFloat(this))){
                return parseFloat(this); // 如果这个字符串本身就是一个数字, 则直接返回, 例如'0;
            }
            return top.LookupIdentifySymbol(this).value.val; 
        }
    });
    Object.defineProperty(Number.prototype,'value',{
        get(){
            return this
        }
    });

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
            '<': (a, b) => a.value < b.value,
            '>': (a, b) => a.value > b.value,
            '==': (a, b) => a.value == b.value,
            '!=': (a, b) => a.value != b.value,
            '<=': (a, b) => a.value <= b.value,
            '>=': (a, b) => a.value >= b.value,
            '>>': (a, b) => a.value >> b.value,
            '<<': (a, b) => a.value << b.value,
            //c++ 与 js 不同, c++的条件表达式返回 bool 值,而 js 是动态值
            '||': (a, b) => !!(a.value || b.value),
            '&&': (a, b) => !!(a.value && b.value),
            '=' : (a, b) => top.setVariableValue(a, b.value),
            '+=': (a, b) => top.setVariableValue(a, a.value + b.value),
            '-=': (a, b) => top.setVariableValue(a, a.value - b.value),
            '*=': (a, b) => top.setVariableValue(a, a.value * b.value),
            '/=': (a, b) => top.setVariableValue(a, a.value / b.value),
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

    matrix_section.prototype.getValue = function(){
        let values = top.LookupIdentifySymbol(this.exp).array.values;
        debugger;
        if(this.slice_pair_list.length == 1){
            let index = this.slice_pair_list[0].start;
            return values[index].val
        }else {
            throw new Error("FIXME 目前只处理了数组取地址, 未处理矩阵取址")
        }
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
        switch(COStreamJS.options.platform){
            case 'default':
            case 'X86':
                var str = this.identifier.toString() + '';
                str += this.op ? this.op : '';
                if (this.initializer instanceof Array) {
                    str += list2String(this.initializer, ',', '{', '}');
                } else {
                    str += this.initializer ? this.initializer.toString() : '';
                }
                return str
            case 'WEB':
                var str = this.identifier.name;
                str += this.op ? this.op : '';
                if(this.identifier.arg_list.length && !this.initializer){
                    if(this.identifier.arg_list.length == 2){
                        str += `= Array.from({ length: ${this.identifier.arg_list[0]}}).map(_=>[])`; // 为二维数组赋初值
                    }else {
                        str += ' = []'; // 为一维数组赋初值
                    }
                }else if (this.initializer instanceof Array) {
                    str += list2String(this.initializer, ',', '[', ']');
                } else {
                    str += this.initializer ? this.initializer.toString() : '';
                }
                return str
            default: return '';
        }
        
    };
    idNode.prototype.toString = function(){
        return this.name.toString() + (this.arg_list.length > 0? list2String(this.arg_list, '][','[',']') :'').replace(/\[0]/g,'[]')
    };
    declareNode.prototype.toString = function () {
        let type = COStreamJS.options.platform === 'WEB' ? 'let' : this.type;
        return type + ' ' + list2String(this.init_declarator_list, ', ')
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
        return 'param\n  ' + this.param_list.map(x=>x.type+' '+x.identifier) + ';\n'
    };

    const isNoSemi = node => ['blockNode', 'forNode', 'selection_statement'].includes(node.constructor.name);

    //将每一行 statement 的';'上提至 blockNode 处理
    blockNode.prototype.toString = function () {
        if (!this.stmt_list || this.stmt_list.length == 0) return '{ }'
        var str = '{\n';
        this.stmt_list.forEach(x => {
            str += x.toString();
            str += isNoSemi(x) ? '\n' :';\n';
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
    //expNode 的子类
    binopNode.prototype.toString = function () {
        // 强制执行 toString 来实现对 N 等标识符在符号表中的查询
        if(this.op !== '.'){
            return this.left.toString() + this.op + this.right.toString()
        }
        return this.left.toString() + this.op + this.right // 例如 In[0].i = i 时, 对左边的.i 不检查符号表, 而对右侧的 i 检查是否是上层符号表的成员 
    };
    arrayNode.prototype.toString = function () {
        return '' + this.exp + list2String(this.arg_list, '][', '[', ']')
    };
    constantNode.prototype.toString = function () {
        let value = this.value;
        let escaped = this.source.replace(/\n|↵/g, "\\n");
        return Number.isNaN(value) ? escaped : value.toString()
    };
    castNode.prototype.toString = function () {
        if(COStreamJS.options.platform === "WEB"){
            if(this.type === 'int') return `Math.floor(${this.exp})`
            else return this.exp
        }
        return '(' + this.type + ')' + this.exp
    };
    parenNode.prototype.toString = function () {
        return '(' + this.exp + ')'
    };
    unaryNode.prototype.toString = function () {
        return '' + this.first.toString() + this.second.toString()
    };
    operatorNode.prototype.toString = function () {
        var str = this.operName + '(';
        str += this.inputs ? this.inputs : '';
        return str + ')' + this.operBody
    };
    operBodyNode.prototype.toString = function () {
        var str = '{\n';
        str += this.stmt_list ? list2String(this.stmt_list, ';\n','',';\n') : '';
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
        str += this.statement instanceof blockNode ? '' : ';'; // 若该 for 只有一条语句, 则补充一个分号
        return str
    };
    whileNode.prototype.toString = function (){
        return 'while(' + this.exp + ')' + this.statement;
    };
    doNode.prototype.toString = function (){
        return 'do' + this.statement + 'while(' + this.exp + ')'
    };
    selection_statement.prototype.toString = function () {
        if (this.op1 === 'if') {
            var str = 'if(' + this.exp + ')' + this.statement;
            str += this.op4 === 'else' ? ('else' + this.else_statement) : '';
            return str
        } else if (this.op1 == 'switch') ;
    };
    splitNode.prototype.toString = function (){
        return this.name + ' ' + this.type + '(' + list2String(this.arg_list,',') + ');';
    };
    joinNode.prototype.toString = function (){
        return this.name + ' ' + this.type + '(' + list2String(this.arg_list,',') + ');';
    };
    splitjoinNode.prototype.toString = function (){
        var str =  this.compName + '(' + list2String(this.inputs,',') + ')' + '{\n'; 
        str += this.split + '\n';
        str += list2String(this.body_stmts,'\n');
        str += this.join + '\n}';
        return str
    };
    addNode.prototype.toString = function (){
        return this.name + ' ' + this.content.toString()
    };

    const differentPlatformPrint = {
        'X86': args => 'cout<<' + list2String(args, '<<'),
        'WEB': args => 'console.log(' + list2String(args, ",") + ')',
        'default': args => 'print(' + list2String(args, ',') + ')'
    };
    const differentPlatformPrintln = {
        'X86': args => 'cout<<' + list2String(args, '<<') + '<<endl',
        'WEB': args => 'console.log(' + list2String(args, ',') + `,'\\n')`,
        'default': args => 'println(' + list2String(args, ',') + ')'
    };
    callNode.prototype.toString = function () {
        const platform = COStreamJS.options.platform;

        if (this.name === "print") {
            return differentPlatformPrint[platform](this.arg_list)
        } else if (this.name === "println") {
            return differentPlatformPrintln[platform](this.arg_list)
        } else if (BUILTIN_MATH.includes(this.name) && platform === 'WEB'){
            return 'Math.'+this.name + '(' + list2String(this.arg_list, ',') + ')'
        }
        else {
            return this.name + '(' + list2String(this.arg_list, ',') + ')'
        }
    };
    compositeCallNode.prototype.toString = function () {
        var str = this.compName + '(';
        str += this.inputs ? list2String(this.inputs, ',') : '';
        str += ')(';
        str += this.params ? list2String(this.params, ',') : '';
        return str + ')'
    };
    matrix_slice_pair.prototype.toString = function (){
        if(!this.op)    return this.start.toString()
        return (this.start || '')+':'+(this.end||'')
    };
    matrix_section.prototype.toString = function (){
        const platform = COStreamJS.options.platform;
        // 如果是矩阵切片节点[0:5,0:5]而非数组取下标节点
        if (this.slice_pair_list[0].op === ':'){
            if (platform === 'X86') {
                //矩阵切片构建规则为 matrix[i:i+p, j:j+q] 转化为  matrix.block(i,j,p,q) , 参考http://eigen.tuxfamily.org/dox/group__TutorialBlockOperations.html
                let i = this.slice_pair_list[0].start;
                let p = this.slice_pair_list[0].end + '-' + i;
                let j = this.slice_pair_list[1].start;
                let q = this.slice_pair_list[1].end + '-' + j;
                return this.exp + `.block(${i},${j},${p},${q})`
            }
        }
        // 如果是矩阵切片节点(两个数字), 例如 data[i,j] 转义为 data(i,j)
        else if(this.slice_pair_list.length == 2){
            return this.exp.toString() + '(' + list2String(this.slice_pair_list, ',') + ')'
        }
        // 其他情况
        return this.exp.toString() + '[' + list2String(this.slice_pair_list, ',') + ']'
    };
    lib_binopNode.prototype.toString = function (){
        if(this.lib_name === 'Matrix'){
            let maps = {
                'zeros': 'Zero'
            };
            return 'Matrix::' + maps[this.function_name]
        }else {
            error$1('暂不支持矩阵之外的库');
        }
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
     */
    StaticStreamGraph.prototype.GenerateFlatNodes = function (/* operatorNode* */ u, param_list) {

        const flat = new FlatNode(u, param_list);
        flat._symbol_table = top;

        /* 寻找输出流  建立节点的输入输出流关系
         * 例如 out = call(in) 对 edgeName:out 来说, call 是它的"来源"节点 fromFlatNode */
        if (u.outputs) u.outputs.forEach((edgeName,index) => {
            top.streamTable[edgeName].fromIndex = index;
            top.streamTable[edgeName].fromFlatNode = flat;
        });

        /* 例如 out = call(in), 对 in 来说, call 是它的"去向"节点 toFlatNode */
        if (u.inputs) u.inputs.forEach((edgeName,index) => {
            const stream = top.streamTable[edgeName];
            stream.toIndex = index;
            stream.toFlatNode = flat;
            if(stream.fromFlatNode){
                /** 下面两行代码的作用是建立 FlatNodes 之间的输入输出关系, 例如 
                 *     (S0, S1) = oper1()
                 *     (S2) = oper2(S1)
                 * 则设置 
                 * oper1.outFlatNodes[1] = oper2
                 * oper2.inFlatNodes[0] = oper1
                 */
                stream.fromFlatNode.outFlatNodes[stream.fromIndex] = flat;
                flat.inFlatNodes[index] = stream.fromFlatNode;
            }else {
                error$1(u._loc, `流 ${edgeName} 没有上层计算节点, 请检查`);
            }
            
        });

        this.flatNodes.push(flat);

        // 下面 设置 flatNode 的边的 weight
        let win_stmts = u.operBody.win;
        for(let it of win_stmts){
            if(it.type === "sliding"){
                flat.inPeekWeights.push(it.arg_list[0].value);
                flat.inPopWeights.push(it.arg_list[1].value);
            }else if(it.type === "tumbling"){
                flat.outPushWeights.push(it.arg_list[0].value);
            }
        }
    };

    /*
     *  功能：将抽象语法树转为平面图
     *  输入参数：gMaincomposite
     *  GraphToOperators：递归的调用，完成splitjoin和pipeline节点的展开，以及完成opearatorNode到flatnode节点的映射
     *  SetTopNode：设置顶层节点
     *  ResetFlatNodeNames：给所有的图节点重命名
     *  SetFlatNodesWeights：设置静态数据流图的peek，pop，push值
     *  输出：静态数据流图ssg
     */
    function AST2FlatStaticStreamGraph(mainComposite,unfold,S){
        var ssg = new StaticStreamGraph();
        debug$1("--------- 执行GraphToOperators, 逐步构建FlatNode ---------------\n");

        setTop(S);

        GraphToOperators(null, mainComposite, ssg, unfold, S);
        //若执行过 unfold 操作, 则可查看展开后的数据流程序: debug(COStreamJS.ast.map(_=>_+'').join('\n').beautify()) 

        ssg.topNode = ssg.flatNodes[0];
        ssg.ResetFlatNodeNames(); /* 将每个composite重命名 */
        // ssg.SetFlatNodesWeights(); 这一步移动到 GenerateFlatNodes 中做

        runningStack.length = 0; // 清空执行上下文栈
        debug$1("--------- 执行AST2FlatStaticStreamGraph后, 查看静态数据流图 ssg 的结构中的全部 FlatNode ---------\n");

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
     * 2.遇到 pipeline 或 splitjoin , 则将其展开为一个真正的 composite 并挂载至 COStream.ast
     * 
     * @param {operNode} call
     * @param {compositeNode} composite
     * @param {StaticStreamGraph} ssg
     * @param {SymbolTable} S
     * @param {number[]} params
     */
    function GraphToOperators(call, composite, ssg, unfold, S, params = []){
        /** 执行上下文栈 */
        runningStack.push(top);
        generateCompositeRunningContext(call, composite, params); //传入参数,并生成 composite 调用的执行上下文环境

        for (let it of composite.body.stmt_list){
            
            let exp = it instanceof binopNode ? it.right : it; //获取到要处理的 operator(){}或 pipeline()或其他,无论是直接调用还是通过 binopNode 的 right 来调用

            if(exp instanceof operatorNode){
                ssg.GenerateFlatNodes(exp, params);

            }else if(exp instanceof compositeCallNode){
                const actual_composite = S.compTable[exp.compName].composite;
                const params = (exp.params||[]).map(e => e.value);
                
                GraphToOperators(exp,actual_composite, ssg, unfold,S,params);
                
            }else if(exp instanceof splitjoinNode){
                const call = unfold.UnfoldSplitJoin(exp);
                const actual_composite = S.compTable[call.compName].composite; // 查看该生成的结构: debug(actual_composite.toString().beautify())
                GraphToOperators(call, actual_composite, ssg, unfold,S);

            }else if(exp instanceof pipelineNode){
                const call = unfold.UnfoldPipeline(exp);
                const actual_composite = S.compTable[call.compName].composite;
                GraphToOperators(call, actual_composite, ssg, unfold, S);

            }else if(exp instanceof sequentialNode){
                const call = unfold.UnfoldSequential(exp);
                const actual_composite = S.compTable[call.compName].composite;
                GraphToOperators(call, actual_composite, ssg, unfold, S);
            }
        }

        setTop(runningStack.pop());
    }

    class UnfoldComposite {
        constructor() {
            /** @type {number} 用于对展开的 pipeline spitjoin 的 name 添加序号 */
            this.num = 0;
            /** @type {Array<{ compName: string, content:string }>} 用于保存展开结果的记录, 避免重复展开 */
            this.cached = [];
        }
        /* 给与每一个不同的splitjoin或者pipeline节点不同的名字 */
        MakeCompositeName(/*string*/ name) {
            return name + "_" + this.num++;
        }
    }

    /**
     * 对于如下形式的 pipeline
     * out = pipeline(in) { 
     *   add A(1); 
     *   add B(2); 
     *   add C(3);
     * } 
     * 我们要生成的 composite 的样式为{
     *   composite pipeline_0( input stream<int x>S0, output stream<int x>S3){
     *      stream<int y>S1;
     *      S1 = A(S0)(1);
     *      stream<double z>S2; // 注: 不同的 composite 节点的输入输出流类型确实可能不一样
     *      S2 = B(S1)(2);
     *      S3 = C(S2)(3);
     *   }
     * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
     * 然后我们要返回的 compositeCallNode 的样式为
     *   out = pipeline_0(in);
     */
    UnfoldComposite.prototype.UnfoldPipeline = function (/** @type {pipelineNode} */ node) {
        let call_list = compositeCallFlow(node.body_stmts);    
        let compName = this.MakeCompositeName("pipeline");
        const inStrType = top.streamTable[ node.inputs[0] ].strType, outStrType = top.streamTable[ node.outputs[0] ].strType;
        const input_list = [new inOutdeclNode(null,inStrType, 'S0')];
        const output_list = [new inOutdeclNode(null,outStrType, 'S'+call_list.length)];
        const inout = new ComInOutNode(null, input_list, output_list);
        const head = new compHeadNode(null, compName, inout);
        let stmt_list = generateBodyStmts();
        const body = new compBodyNode(null, null, stmt_list);
        const pipeline = new compositeNode(null, head, body);
        
        COStreamJS.ast.push(pipeline);
        COStreamJS.S.compTable[compName] = { composite: pipeline };
        
        // 构造 compositeCallNode
        const compositeCall = new compositeCallNode(null,compName, node.inputs);
        compositeCall.outputs = node.outputs; 
        return compositeCall

        
        function generateBodyStmts() {
            let result = [];
            for (let i = 0; i < call_list.length; i++) {
                let compCall = call_list[i];
                const inputNames = ['S'+i], outputNames = ['S'+(i+1)];
                const comp = COStreamJS.S.compTable[compCall.compName].composite;

                // 先检查要不要生成 stream<int y>S1; 这个语句. 只要不是最后一个 add 则都要生成
                if(i < call_list.length - 1){
                    const outStrType = comp.inout.output_list[0].strType;
                    result.push(new declareNode(null, outStrType, outputNames));  // stream<int x>S1;
                }
                // 接着生成 S1 = A(S0)(param1); 这个语句
                const params = compCall.params.map(exp => exp.value);
                let call = new compositeCallNode(null, compCall.compName,inputNames, params);
                call.outputs = outputNames;
                const binop = new binopNode(null, 'S'+(i+1), '=', call);
                result.push(binop);
            }
            return result
        }

    };

    /**
     *  遍历splitjoin/pipeline结构中的statement，将compositecallNode加入到compositeCall_list中
     */
    function compositeCallFlow(/*list<Node *> */ stmts) {
        let compositeCall_list = []; // 记录了 add composite(); 的列表
        if (!stmts || stmts.length == 0) throw new Error("compositeCallFlow Error")
        stmts.forEach(stmt => {
            stmt instanceof addNode ? handlerAdd(stmt) : '';
            stmt instanceof forNode ? handlerFor(stmt) : '';
        });
        return compositeCall_list

        function handlerAdd(add) {
            if (add.content instanceof compositeCallNode) {
                let copy = deepCloneWithoutCircle(add.content);
                copy.params = copy.params.map(exp => exp.value);
                compositeCall_list.push(copy);

            }else if(add.content instanceof layerNode){
                let copy = deepCloneWithoutCircle(add.content);
                copy.arg_list = copy.arg_list.map(exp => exp.value);
                compositeCall_list.push(copy);

            }else if (add.content instanceof splitjoinNode || add.content instanceof pipelineNode) {
                let copy = deepCloneWithoutCircle(add.content);
                compositeCall_list.push(copy);
            }
        }
        /**
         * 对一个静态 for 循环做循环展开, 目前没有符号表, 所以只考虑如下简单例子
         * for(j= 1;j<10;i+=2) //对该例子会将其内部语句展开5次
         */
        function handlerFor(/** @type {forNode}*/ for_stmt) {
            /*获得for循环中的init，cond和next值 目前只处理for循环中数据是整型的情况 */
            let itorName = for_stmt.init.left; // 获取 for 循环迭代器的 iterator 的名字/初始值
            top.setVariableValue(itorName, for_stmt.init.right.value);
            while(for_stmt.cond.value){
                const innerCall_list = compositeCallFlow(for_stmt.statement.stmt_list);
                compositeCall_list = compositeCall_list.concat(innerCall_list);
                for_stmt.next.value; // 一般是执行 i++
            }
        }
    }

    /**
     * 对于如下形式的 splitjoin
     * out = splitjoin(in) { 
     *   split duplicate(args); // 也可以是 roundrobin;
     *   add A(1); 
     *   add B(2); 
     *   add pipeline();
     *   join roundrobin();
     * } 
     * 我们要生成的 composite 的样式为{
     *   composite duplicate_0( input stream<int x>In, output stream<int x>Out){
     *      stream<int y>S0,S1,S2,J0,J1,J2;
     *      (S0,S1,S2) = duplicate(In){ ... }; // operator 内容参见 MakeDuplicateOperator
     *      J0 = A(S0)(1);
     *      J1 = B(S1)(2);
     *      J2 = pipeline(S2);
     *      Out = join(J0,J1,J2){ ... }; // operator 内容参见 MakeJoinOperator
     *   }
     * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
     * 然后我们要返回的 compositeCallNode 的样式为
     *   out = duplicate_0(in);
     *
     * @param {splitjoinNode} node - 待展开的 splitjoinNode
     * @returns {compositeCallNode} 展开完成的 
     */
    UnfoldComposite.prototype.UnfoldSplitJoin = function (node) {
        setTop(new SymbolTable(top, null)); // 对生成的新 composite 构建新的符号表
        let compName = this.MakeCompositeName("splitjoin");
        let call_list = compositeCallFlow(node.body_stmts);

        const strType = top.prev.streamTable[node.inputs[0]].strType; // 这里也简单默认输入输出数据流类型一致, 若有不一致的需求, 应修改此处代码
        const head_input = new inOutdeclNode(null, strType, "In");
        const head_output = new inOutdeclNode(null, strType, "Out");
        let inout = new ComInOutNode(null, [head_input], [head_output]);
        let head = new compHeadNode(null, compName, inout); // 构建头部完成

        var stmt_list = this.generateDuplicateOrRoundrobinBodyStmts(node, node.split.type, call_list);

        let body = new compBodyNode(null, null, stmt_list);
        let splitjoin = new compositeNode(null, head, body); // 已生成该新的 compositeNode

        // 将新生成的 compositeNode 插回到语法树和符号表中
        COStreamJS.ast.push(splitjoin);
        COStreamJS.S.compTable[compName] = { composite: splitjoin };
        
        // 构造 compositeCallNode
        const compositeCall = new compositeCallNode(null,compName, node.inputs);
        compositeCall.outputs = node.outputs; 

        setTop(top.prev); // 还原至上层符号表
        return compositeCall
    };

    /**
     * 目标生成的结构:
     *      stream<int y>S0,S1,S2,J0,J1,J2;
     *      (S0,S1,S2) = duplicate(In){ ... }; // operator 内容参见 MakeDuplicateOperator
     *      J0 = A(S0)(1);
     *      J1 = B(S1)(2);
     *      J2 = pipeline(S2);
     *      Out = join(J0,J1,J2){ ... }; // operator 内容参见 MakeJoinOperator
     * @param {splitjoinNode} node
     * @param {Array<compositeCallNode|splitjoinNode|pipelineNode>} call_list
     * @returns {statement[]}
     */
    UnfoldComposite.prototype.generateDuplicateOrRoundrobinBodyStmts = function (node, type = "duplicate", call_list) {
        let result = [], currentNum = this.num; 
        /** 这里要把当前的序号保存下来 达到"成对"生成oper名字的目的
         *                                    duplicate_0
         *                                          roundrobin_1
         *                                          join_1
         *                                    join_0
         */

        //0.先提前设置好流变量名
        let splitStreams = Array.from({ length: call_list.length }).map((_, idx) =>  "S" + idx);
        let joinStreams = Array.from({ length: call_list.length }).map((_, idx) =>  "J" + idx);

        //1. 构建流变量声明节点 stream<int y>S0,S1,S2,J0,J1,J2;
        const strType = top.prev.streamTable[ node.inputs[0] ].strType; // 注: 这里默认过程中的数据流类型都相同, 若有不同可修改此处代码
        [...splitStreams, ...joinStreams,"In","Out"].forEach(strName => top.streamTable[strName] = { strType }); // 为新声明的几个数据流名在符号表中注册类型

        let declareStmt = new declareNode(null, strType, splitStreams.concat(joinStreams));
        result.push(declareStmt);

        //2.构建 duplicateOrRoundrobin  节点
        let duplicateOrRoundrobinOper = type === "duplicate"
            ? this.MakeDuplicateOperator(["In"], node.split.arg_list, splitStreams, currentNum)
            : this.MakeRoundrobinOperator(["In"], node.split.arg_list, splitStreams, currentNum);
        result.push(duplicateOrRoundrobinOper);

        //3.构建 body 中的对输入流的处理
        for (let i = 0; i < call_list.length; i++) {
            let it = call_list[i];

            if (it instanceof compositeCallNode) {
                let call = new compositeCallNode(null, it.compName, [splitStreams[i]], it.params);
                call.outputs = [joinStreams[i]];
                let binop = new binopNode(null,splitStreams[i], '=', call);
                result.push(binop);

            } else if (it instanceof splitjoinNode || it instanceof pipelineNode) {
                /** 若为splitjoin或者pipeline结构，赋予其输入和输出流 
                 *  例如之前是 add pipeline { 
                 *              add A(); 
                 *              add B(); 
                 *           } 
                 *  将其转化为 Ji = pipeline_num(Si); // 这里额外执行一次 unfoldPipeline, 得到一个 compositeCallNode
                 */
                
                // 先去缓存中查找该结构是否已展开过
                let hit = this.cached.find(record => record.content === it.toString());
                if(hit){
                   var call = new compositeCallNode(null,hit.compName, [splitStreams[i]]);
                   call.outputs = [joinStreams[i]];
                }else {
                   const needToCacheString = it.toString();
                   it.inputs = [splitStreams[i]];
                   it.outputs = [joinStreams[i]];
                   var call = it instanceof splitjoinNode ? this.UnfoldSplitJoin(it) : this.UnfoldPipeline(it);
                   this.cached.push({ compName: call.compName, content: needToCacheString });
                }
                
                let binop = new binopNode(null, joinStreams[i], '=', call);
                result.push(binop);
            }
        }
        //4.构建 join 节点
        result.push(this.MakeJoinOperator(joinStreams, node.split.arg_list, ["Out"],currentNum));
        return result
    };


    /**
     * 构建出一个真实的 roundrobin 的 operatorNode, 该 operator 没有 stmt_list 和 init, 只有 work 和 window
     * 例如
     * (S0,S1) = roundrobin(In) {
     *   work{
     *       int i=0,j=0;
     *		 for(i=0;i<1;++i)		S0[i]=In[j++];
     *		 for(i=0;i<1;++i)		S1[i]=In[j++];
     *   }
     *   window{
     *       In sliding(2,2);
     *       S0 tumbling(1);
     *       S1 tumbling(1);
     *   }
     * }
     * @returns {operatorNode}
     */
    UnfoldComposite.prototype.MakeRoundrobinOperator = function (inputs, args, outputs, num) {
        /* duplicate  的参数被文法手册规定为全为1
         * Roundrobin 的参数可不仅仅为1哦, 可以自定义哒
         * 如果不指定参数, 则默认都为1 */
        args = args || Array.from({ length: outputs.length }).fill(1);

        let work = MakeRoundrobinWork(inputs, args, outputs);
        let window = MakeRoundrobinWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let oper = new operatorNode(null, `roundrobin_${num}`, inputs, body);
        oper.outputs = outputs;
        let binop = new binopNode(null, new parenNode(null, outputs),'=',oper);
        return binop

        /**
         * 构建 Roundrobin 的 work 部分
         *       int i=0,j=0;
         *		 for(i=0;i<1;++i)		S0[i]=In[j++];
         *		 for(i=0;i<1;++i)		S1[i]=In[j++];
         */
        function MakeRoundrobinWork(inputs, args, outputs) {
            const decl_i = new declarator(null,new idNode(null,'i'),'0');
            const decl_j = new declarator(null,new idNode(null,'j'),'0');
            const dNode =  new declareNode(null, 'int',[decl_i,decl_j]);
            const stmts = [dNode]; // stmts = ["int i=0,j=0;"]
            outputs.forEach((name, idx) => {
                // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[j++];`)
                const init = new binopNode(null,'i','=', new constantNode(null,'0'));
                const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]));
                const next = new unaryNode(null, '++', 'i');
                const binop_left = new matrix_section(null, name, [new matrix_slice_pair(null,'i')]);
                const binop_righ = new matrix_section(null, inputs[0], [new matrix_slice_pair(null,'j++')]);
                const statement = new binopNode(null, binop_left, '=', binop_righ);
                stmts.push(new forNode(null, init, cond, next, statement));
            });
            let work = new blockNode(null, '{', stmts, '}');
            return work
        }
        /**
         * 构建 Roundrobin 的 window 部分
         *       In sliding(2,2);
         *       S0 tumbling(1);
         *       S1 tumbling(1);
         */
        function MakeRoundrobinWindow(inputs, args, outputs) {
            //1. 构建 In sliding(2,2);
            let sum = args.map(arg=>parseInt(arg)).reduce((a, b) => a + b);
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
     * (Out1,Out2,Out3) = duplicate(In) {
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
    UnfoldComposite.prototype.MakeDuplicateOperator = function (inputs, args, outputs, num) {
        args = args || Array.from({ length: outputs.length }).fill(1); //使用默认全都是1 , 实际上split duplicate()在小括号中不允许输入参数
        let work = MakeDuplicateWork(inputs, args, outputs);
        let window = MakeDuplicateWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let res = new operatorNode(null, `duplicate_${num}`, inputs, body);
        res.outputs = outputs;
        let binop = new binopNode(null, new parenNode(null,outputs), '=', res);
        return binop

        /**
         * 构建 duplicate 的 work 部分
         */
        function MakeDuplicateWork(inputs, args, outputs) {
            const decl = new declarator(null,new idNode(null,'i'),'0');
            const dNode =  new declareNode(null, 'int',[decl]);
            const stmts = [dNode]; // let stmts = ["int i=0;"]
            outputs.forEach((name, idx) => {
                // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${name}[i] = ${inputs[0]}[i];`)
                const init = new binopNode(null,'i','=',new constantNode(null,'0'));
                const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]));
                const next = new unaryNode(null, '++', 'i');
                const binop_left = new matrix_section(null, name, [new matrix_slice_pair(null,'i')]);
                const binop_righ = new matrix_section(null, inputs[0], [new matrix_slice_pair(null,'i')]);
                const statement = new binopNode(null, binop_left, '=', binop_righ);
                stmts.push(new forNode(null, init, cond, next, statement));
            });
            let work = new blockNode(null, '{', stmts, '}');
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
     * Out = join(In1,In2) {
     *   work{
     *       int i=0;
     *		 int j=0;
     *		 for(i=0;i<1;++i)		Out[j++]=In0[i];
     *		 for(i=0;i<1;++i)		Out[j++]=In1[i];
     *		 for(i=0;i<1;++i)		Out[j++]=In2[i];
     *   }
     *   window{
     *       In0 sliding(1,1);
     *       In1 sliding(1,1);
     *       In2 sliding(1,1);
     *       Out tumbling(3);
     *   }
     * }
     * @returns {binopNode} 
     */
    UnfoldComposite.prototype.MakeJoinOperator = function (inputs, args, outputs, num) {
        args = args || Array.from({ length: inputs.length }).fill(1); //join roundrobin()在小括号中不输入参数的话默认全都是1

        let work = MakeJoinWork(inputs, args, outputs);
        let window = MakeJoinWindow(inputs, args, outputs);
        let body = new operBodyNode(null, null, null, work, window); //没有 stmt_list 和 init,只有 work,window
        let res = new operatorNode(null, `join_${num}`, inputs, body);
        res.outputs = outputs;
        let binop = new binopNode(null, outputs[0],'=',res);
        return binop

        /**
         * 构建 join 的 work 部分
         */
        function MakeJoinWork(inputs, args, outputs) {
            // 下面代码等价于 let stmts = ["int i=0,j=0;"]
            const decl_i = new declarator(null,new idNode(null,'i'),'0');
            const decl_j = new declarator(null,new idNode(null,'j'),'0');
            const dNode =  new declareNode(null, 'int',[decl_i,decl_j]);
            const stmts = [dNode]; // let stmts = ["int i=0,j=0;"]
            inputs.forEach((name, idx) => {
                // 下面代码等价于 stmts.push(`for(i=0;i<${args[idx]};++i)  ${outputs[0]}[j++] = ${name}[i];`)
                const init = new binopNode(null,'i','=',new constantNode(null,'0'));
                const cond = new binopNode(null, 'i','<',new constantNode(null,args[idx]));
                const next = new unaryNode(null, '++', 'i');
                const binop_left = new matrix_section(null, outputs[0], [new matrix_slice_pair(null,'j++')]);
                const binop_righ = new matrix_section(null, name, [new matrix_slice_pair(null,'i')]);
                const statement = new binopNode(null, binop_left, '=', binop_righ);
                stmts.push(new forNode(null, init, cond, next, statement));
            });
            let work = new blockNode(null, '{', stmts, '}');
            return work
        }
        function MakeJoinWindow(inputs, args, outputs) {
            //每行一个形如 In sliding(1,1) 的 winStmt
            let winStmts = inputs.map((name, idx) => {
                let arg_list = [args[idx], args[idx]].map(num => new constantNode(null, num)); //一般情况下为 sliding(1,1), 也兼容其它 arg. 转为 constantNode 为后续SetFlatNodesWeights做准备
                return new winStmtNode(null, name, { type: 'sliding', arg_list })
            });
            //加入末尾的输出, 形如 Out tumbling(3) 其中的数字是 args 的总和
            let sum = args.map(arg=>parseInt(arg)).reduce((a, b) => a + b);
            winStmts.push(new winStmtNode(
                null,
                outputs[0],
                { type: 'tumbling', arg_list: [new constantNode(null, sum)] })
            );
            return winStmts
        }
    };

    /**
     * 对于如下形式的 squential 和 Dense 的例子
     * Out = squential (In, Y) (784) {
     *      add Dense(100);
     *      add Dense(10);
     * };
     * 我们要连接数据流节点的策略是: 以 loss 为中心, 前后对称地补上 dense 和 dDense , 最后在首部加一个 copy
     * 我们要生成的 composite 的样式为
     *   composite sequential_0(input stream<double x>In, stream<double x>Y, output stream<double x> Out){
     *          stream<double x>copy_1,copy_2;
     *          (copy_1,copy2) = copy(In);                     // 内容参见 MakeCopyOperator
     *          (dense_1_1,dense_1_2) = dense(copy1)
     *          D3 = dense(D2)
     *          L = loss(D3, Y)
     *          D6 = dDense(D1, L)
     *          Out = dDense(In1, D6)
     *   }
     * 将该新生成的 composite 加入 COStreamJS.ast 以及符号表的 S.compTable 中
     * 然后我们要返回的 compositeCallNode 的样式为
     *   Out = sequential_0(In,Y);
     *
     * @param {sequentialNode} node
     * @returns {compositeCallNode}
     */
    UnfoldComposite.prototype.UnfoldSequential = function (node) {
        setTop(new SymbolTable(top, null)); // 对生成的新 composite 构建新的符号表

        let compName = this.MakeCompositeName("squential");
        let call_list = compositeCallFlow(node.body_stmts);

        const strType = top.prev.streamTable[node.inputs[0]].strType; // 这里也简单默认输入输出数据流类型一致, 若有不一致的需求, 应修改此处代码
        const head_inputs = [new inOutdeclNode(null, strType, "In"), new inOutdeclNode(null, strType, "Y")];
        const head_outputs = [new inOutdeclNode(null, strType, "Out")];
        let inout = new ComInOutNode(null, head_inputs, head_outputs);
        let head = new compHeadNode(null, compName, inout); // 构建头部完成

        let stmt_list = this.generateSequentialBodyStmts(compName, node, call_list);

        let body = new compBodyNode(null, null, stmt_list);
        let sequential = new compositeNode(null, head, body); // 已生成该新的 compositeNode

        // 将新生成的 compositeNode 插回到语法树和符号表中
        COStreamJS.ast.push(sequential);
        COStreamJS.S.compTable[compName] = { composite: sequential };

        // 构造 compositeCallNode
        const compositeCall = new compositeCallNode(null, compName, node.inputs);
        compositeCall.outputs = node.outputs;

        setTop(top.prev); // 还原至上层符号表
        return compositeCall
    };

    /**
     * 对于如下形式的 squential 和 Dense 的例子
     * Out = squential (In, Y) (784) {
     *      add Dense(100);
            add Dense(10);
        };
     * 我们要生成的 stmt_list 的格式为{
     * @param {sequentialNode} sequential
     * @param {layerNode[]} layers
     * @returns {statement[]}
     */
    UnfoldComposite.prototype.generateSequentialBodyStmts = function (compName, sequential, layers) {
        const result = [];
        let currentLevel = 0; /** 当前层级计数器, 用于数据流名的构造 */

        // 0. 将层连接起来
        for (let i = 0; i < layers.length - 1; i++) {
            layers[i].level = ++currentLevel;
            layers[i].nextLayer = layers[i + 1];
            layers[i + 1].prevLayer = layers[i];
        }
        layers[layers.length - 1].level = ++currentLevel;

        // 1. 确定每一层的输入输出规模 执行完后, this.rows 有值了
        layers.forEach(layer => layer.init(sequential));

        // 2. 在语法树的头部插入权值矩阵 二维数组的声明 例如_weight_0[784][100], _weight_1[100][10]
        for (let layer of layers) {
            const weightName = '_weight_' + layer.level;
            switch (layer.constructor) {
                case denseLayerNode: {
                    // 全局声明 double _weight_[prevDim][dim];
                    const declStr = `double ${weightName}[${layer.rows}][${layer.cols}];`;
                    const declare = COStreamJS.parser.parse(declStr)[0]; // 这里使用了parse字符串的方式来创建了语法树节点. 在 c++ 对应的地方要手动构建

                    COStreamJS.ast.unshift(declare);
                    COStreamJS.S.variableTable[weightName] = new Variable('double', weightName, new ArrayConstant('double'));
                    break
                }
            }
        }

        // 3.
        // 声明stream stream<double x>...
        const strType = new strdclNode(null, 'double', 'x');
        const streamDecl = new declareNode(null, strType, ['copy_1', 'copy_2']); // stream<double x>copy_1,copy_2;
        result.push(streamDecl);
        result.push(this.MakeCopyOperator());


        // 用于存储前向传播给反向传播的数据流
        // 输入sequential的训练集在反向传播中仍然需要
        const temp_stream_list = [['copy_2']];
        let temp_stream = ['copy_1'];
        debugger;
        // 展开前向传播composite
        for (let layer of layers) {
            let call_inputs = [], call_outputs = [];
            if (layer !== layers[layers.length - 1]) { // 如果不是最后一个 layer
                const namePrefix = '_F' + layer.layerName + layer.level + '_'; // 前缀, 例如 _FDENSE1_
                // 正向传递给下一层的stream名称, 例如 _FDENSE1_FDENSE2
                const tempName1 = namePrefix + 'F' + layer.nextLayer.layerName + layer.nextLayer.level;
                // 将数据流声明加入
                streamDecl.init_declarator_list.push(tempName1);
                call_inputs = [temp_stream[0]];
                if (layer.nextLayer instanceof averagePooling2DLayerNode) {
                    call_outputs = [tempName1];
                } else {
                    // 传递给反向传播中本层的stream名称, 例如 _FDENSE1_BDENSE2
                    const tempName2 = namePrefix + 'B' + layer.nextLayer.layerName + layer.nextLayer.level;
                    streamDecl.init_declarator_list.push(tempName2);
                    call_outputs = [tempName1, tempName2];
                    temp_stream_list.push([tempName2]);
                }
                temp_stream.pop();
                temp_stream.push(call_outputs[0]);

            } else { // 如果是最后一个 layer
                /* 
                    * 训练过程
                    正向传播的最后一层不同于其他层，只有一个输出流： call_inputs = new list<Node *>({temp_stream->front()});
                    * 测试过程
                    只有正向传播的时候, output为输出：call_outputs = new list<Node *>({outputs->front()});
                */
                const tempName = '_F' + layer.layerName + layer.level + '_loss';
                call_inputs = [temp_stream[0]];
                call_outputs = [tempName];
                temp_stream.pop();
                temp_stream.push(tempName);
                streamDecl.init_declarator_list.push(tempName);
            }
            // 构造实际的正向传播composite
            const comp = MakeForwardComposite(layer, call_outputs.length == 1);
            const call = new compositeCallNode(null, comp.compName, call_inputs);
            call.outputs = call_outputs;
            result.push(new binopNode(null, call_outputs, '=', call));
        }
        // dl/dy的输入为y, y`
        // 展开反向传播composite, 最后一层的composite的输入为实际预测和期望预测的输入流 也即temp_stream和 与y_stream
        const call_inputs = [temp_stream[0], 'Y'], call_outputs = ['_Loss'];
        streamDecl.init_declarator_list.push('_Loss');
        const loss_comp = MakeLossComposite(layers[layers.length - 1]);
        const loss_call = new compositeCallNode(null, loss_comp.compName, call_inputs);
        loss_call.outputs = call_outputs;
        result.push(new binopNode(null, call_outputs, '=', loss_call));
        // 正向传播展开完毕 
        // 开始展开反向传播
        temp_stream = ['_Loss'];
        for (let layer of layers.slice().reverse()) {
            let call_inputs, call_outputs;
            if (layer instanceof averagePooling2DLayerNode) {
                call_inputs = [temp_stream];
            } else {
                temp_stream_list[temp_stream_list.length - 1].unshift(temp_stream[0]);
                call_inputs = temp_stream_list.pop();
            }
            if (layer !== layers[0]) {
                const namePrefix = 'B_' + layer.layerName + layer.level + '_'; // B_DENSE2_
                const tempName = namePrefix + layer.prevLayer.layerName + layer.prevLayer.level; // B_DENSE2_DENSE1
                call_outputs = [tempName];
            } else {
                call_outputs = ['Out'];
            }
            streamDecl.init_declarator_list.push(call_outputs[0]);
            temp_stream = [call_outputs[0]];
            const back_comp = MakeBackComposite(layer);
            const back_call = new compositeCallNode(null, back_comp.compName, call_inputs);
            back_call.outputs = call_outputs;
            result.push(new binopNode(null, call_outputs, '=', back_call));
        }

        // 反向传播展开完毕



        debugger;
        return result;
    };

    /**  
     * 返回一个将输入数据流拷贝2份的 operator 
     * (copy_1, copy_2) = copy(In){
     *     work{
     *          copy_1[0].x = In[0].x;
     *          copy_2[0].x = In[0].x;
     *     }
     *     window{
     *          In sliding(1,1);
     *          copy_1 tumbling(1);
     *          copy_2 tumbling(1);
     *     }
     * }
     * @returns {binopNode}
    */
    UnfoldComposite.prototype.MakeCopyOperator = function () {
        /** @type {compositeNode} */
        const composite = COStreamJS.parser.parse(`
    composite copy(input stream<double x>In, output stream<double x>copy_1, stream<double x>copy_2){
      (copy_1, copy_2) = copy(In){
         work{
              copy_1[0].x = In[0].x;
              copy_2[0].x = In[0].x;
         }
         window{
              In sliding(1,1);
              copy_1 tumbling(1);
              copy_2 tumbling(1);
         }
      };
    }`)[0];
        return composite.body.stmt_list[0]
    };

    /**
     * @returns {compositeNode}
     */
    function MakeForwardComposite(/** @type {layerNode} */layer, isLast) {
        if (layer instanceof denseLayerNode) {
            return MakeDenseComposite(layer, isLast)
        }
    }

    /* 构建如下的 dense 层的 composite, 其中需要处理 level 和输出输出窗口大小. 构建完成后加入符号表
     *
      composite dense_1(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1) {
        (Out0,Out1) = dense_1(In){
            init{
                int i,j;
                for(i=0;i<784;i++){
                    for(j=0;j<100;j++){
                        _weight_1[i][j]=0;
                    }		
                }		
            }
            work{
                int i,j;
                double temp;
                for(j=0;j<100;j++){
                    temp = 0;
                    for(i=0;i<784;i++){
                        temp += In[i].x * _weight_1[i][j] ;
                    }
                    Out0[j].x = temp;
                    Out1[j].x = temp;
                }	
            }
            window{
                In sliding(784,784);
                Out0 tumbling(100,100);
                Out1 tumbling(100,100);
            }
        };
      }
    */
    function MakeDenseComposite(/** @type {denseLayerNode} */layer, isLast = false) {
        const { level, rows, cols } = layer;
        if (isLast) {
            var compStr = `composite dense_${level}(input stream<double x>In, output stream<double x>Out) {
            Out = dense_${level}(In){
                init{
                    int i,j;
                    for(i=0;i<${rows};i++){
                        for(j=0;j<${cols};j++){
                            _weight_${level}[i][j]=0;
                        }
                    }
                }
                work{
                    int i,j;
                    double temp;
                    for(j=0;j<${cols};j++){
                        temp = 0;
                        for(i=0;i<${rows};i++){
                            temp += In[i].x * _weight_${level}[i][j] ;
                        }
                        Out[j].x = temp;
                    }
                }
                window{
                    In sliding(${rows},${rows});
                    Out tumbling(${cols},${cols});
                }
            };
          }`;
        } else {
            var compStr = `composite dense_${level}(input stream<double x>In, output stream<double x>Out0, stream<double x>Out1) {
            (Out0,Out1) = dense_${level}(In){
                init{
                    int i,j;
                    for(i=0;i<${rows};i++){
                        for(j=0;j<${cols};j++){
                            _weight_${level}[i][j]=0;
                        }
                    }
                }
                work{
                    int i,j;
                    double temp;
                    for(j=0;j<${cols};j++){
                        temp = 0;
                        for(i=0;i<${rows};i++){
                            temp += In[i].x * _weight_${level}[i][j] ;
                        }
                        Out0[j].x = temp;
                        Out1[j].x = temp;
                    }
                }
                window{
                    In sliding(${rows},${rows});
                    Out0 tumbling(${cols},${cols});
                    Out1 tumbling(${cols},${cols});
                }
            };
          }`;
        }
        const comp = COStreamJS.parser.parse(compStr)[0];
        // 加入符号表
        COStreamJS.S.compTable[comp.compName] = { composite: comp };
        COStreamJS.ast.push(comp);
        return comp
    }

    function MakeLossComposite(/** @type {layerNode} */layer) {
        let win = 0;
        if (layer instanceof denseLayerNode) {
            win = layer.cols;
        } else {
            error("未支持的 layer 类型");
        }
        var compStr = `composite loss(input stream<double x>In0, stream<double x>In1, output stream<double x>Out) {
        Out = loss(In0,In1){
            init{}
            work{
                int i;
                for(i=0;i<${win};i++){
                    Out[i].x = In0[i].x - In1[i].x;
                }            
            }
            window{
                In0 sliding(${win},${win});
                In1 sliding(${win},${win});
                Out tumbling(${win},${win});
            }
        };
      }`;
        const comp = COStreamJS.parser.parse(compStr)[0];
        // 加入符号表
        COStreamJS.S.compTable[comp.compName] = { composite: comp };
        COStreamJS.ast.push(comp);
        return comp
    }

    function MakeBackComposite(layer) {
        if (layer instanceof denseLayerNode) {
            return MakeDDenseComposite(layer)
        }
    }
    function MakeDDenseComposite(/** @type {denseLayerNode} */layer) {
        const { level, rows, cols } = layer;
        var compStr = `composite dDense_${level}(input stream<double x>In0,stream<double x>In1, output stream<double x>Out) {
        Out = dDense${level}(In0,In1){
            init{}
            work{
                int i,j;
                double temp = 0;
                for (i = 0; i < ${rows}; i++)
                {
                    temp = 0;
                    for (j = 0; j < ${cols}; j++)
                    {
                        temp += In0[j].x * _weight_${level}[i][j];
                    }
                    Out[i].x = temp;
                }
                double lr = 0.100000;
                for (i = 0; i < ${rows}; i++)
                {
                    for (j = 0; j < ${cols}; j++)
                    {
                        _weight_${level}[i][j] = _weight_${level}[i][j] + In0[j].x * In1[i].x * lr;
                    }
                }
            }
            window{
                In0 sliding(${cols},${cols});
                In1 sliding(${rows},${rows});
                Out tumbling(${rows},${rows});
            }
        };
      }`;
        const comp = COStreamJS.parser.parse(compStr)[0];
        // 加入符号表
        COStreamJS.S.compTable[comp.compName] = { composite: comp };
        COStreamJS.ast.push(comp);
        return comp
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
            var w_init = 0;
            /**
             * 注: 鉴于现在 COStream 的工作量估计极其不准确的事实, COStreamJS 为了简单起见使用了更简单的估计策略:
             *                          取 "标识符, 运算符" 的总数量 * 10 + 窗口大小 * 20
             * 未来有更优的工作量估计策略后可替换此处代码.
             */
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
                    }else {
                        throw new Error("一般的 up 节点的 push 值不会为0")
                    }
                }else {
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
        node.outFlatNodes.forEach(out => {
            if(isVisited.get(out)) return; // 如果已经生成过了, 就返回
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
            str += node.name + '->' + out.name + `[label="${node.outPushWeights[idx]*node.steadyCount}"];\n\n`;
        });
        return str
    }

    /**
     * SDF 图划分算法的基类, 子类需要继承此类并实现对应方法
     */
    class Partition {
        constructor() {
            /** @type {Map<FlatNode,number>} 节点到划分编号的映射 */
            this.FlatNode2PartitionNum = new Map();

            /** @type {Map<number,FlatNode[]>} 划分编号到节点集合的映射 */
            this.PartitonNum2FlatNode = new Map();

            /** @type {Map<number, number>} 划分编号到通信量的映射 */
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
            this.X = Array.from({ length: num }).map(_ => []); // 初始化一个二维数组(先创建一个长度为 num 的一维数组, 再将每个位置映射为一个新数组)
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
        this.X.forEach(flats=>flats.sort((a,b)=>a.name.match(/\d+/)[0] - b.name.match(/\d+/)[0])); //对一个子图按照名字序号升序排序
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
        topologic.forEach(flat => {
            //判断该节点是否和其输入节点都在一个划分子图
            const isInSameSubGraph = flat.inFlatNodes.every(src => map.get(src) == map.get(flat));

            //获取它的入节点的最大阶段号
            const maxstage = flat.inFlatNodes.length > 0 ? Math.max(...flat.inFlatNodes.map(f => f.stageNum)) : 0;

            //如果有上端和自己不在同一子图的话,就要让阶段号+1
            flat.stageNum = isInSameSubGraph ? maxstage : maxstage + 1;
        });

        //返回总共有几个阶段, 例如阶段号分别是0,1,2,3,那么要返回一共有"4"个阶段
        return topologic[topologic.length-1].stageNum + 1
    }

    // 该函数组的执行时机为代码生成的尾巴, 对生成的 buf 通过字符串替换的手段达到目的
    const Matrix_Object = {
        CGMain(buf){
            /* 在 main 函数头部中插入 initGlobalVar() 函数
             * 考虑到普通的全局变量都是可以直接在.h 文件中声明的类型, 例如 a[] = {1,2,3}
             * 而矩阵必须在函数执行阶段赋初始值. */
            debugger;
            return buf.replace(/int main\(int argc,char \*\*argv\){/, `int main(int argc,char **argv){ initGlobalVar();`)
        },
        CGGlobalHeader(buf){
            // 引入矩阵头文件
            buf = buf.replace("using namespace std;",
            `using namespace std;
        #include "Eigen/Dense"
        using Eigen::MatrixXd;
        typedef MatrixXd Matrix;
        `
            );
            return buf
        },
        CGGlobalvarHeader(buf){
            buf = buf.replace("#define GLOBALVAL_H",`#define GLOBALVAL_H
        #include "Eigen/Dense"
        using Eigen::MatrixXd;
        typedef MatrixXd Matrix;
        void initGlobalVar();
        `);
            return buf
        },
        CGGlobalvar(buf,ast){
            // 矩阵的常量声明比较特殊, 所以直接重写
            let ReWriteBuf = `#include "GlobalVar.h" \n`;
            /** @type{ declareNode[] } */
            const matrixVars = [];
            for (let node of ast) {
                if (node instanceof declareNode) {
                    if(node.type === 'Matrix'){
                        matrixVars.push(node);
                        ReWriteBuf += 'MatrixXd ';
                        for (let declarator of node.init_declarator_list){
                            ReWriteBuf += declarator.identifier.toString();
                        }
                        ReWriteBuf += ';\n';
                    }else {
                        ReWriteBuf += node.toString() + ';\n';
                    }
                }
            }
            ReWriteBuf += `void initGlobalVar(){ ${initMatrix()}`;
            return ReWriteBuf += '}'

            // 根据 matrixVars 的内容, 在 initGlobalVar 函数中执行矩阵的初始化
            function initMatrix(){
                var buf = '';
                for(let node of matrixVars){
                    for(let declarator of node.init_declarator_list){
                        // 如果是矩阵数组
                        if(declarator.identifier.arg_list.length){
                            const length = declarator.initializer.length; // 暂时只支持一维数组
                            const shape = declarator.initializer[0].shape;
                            const name = declarator.identifier.name;
                            /**
                             * 一般 rawData 为 [ [1,2], [3,4] ] 格式的数组, 由于MatrixXd 已经定了宽高,
                             * 所以可以使用 array[i] << 1,2,3,4; 的方式来赋初值
                             */
                            for (let i = 0; i < length; i++) {
                                const sequence = declarator.initializer[i].rawData.flat().join();
                                buf += `
                                ${name}[${i}] = MatrixXd(${shape[0]},${shape[1]});
                                ${name}[${i}] << ${sequence};
                            `;
                            }
                        }
                        //如果是单个矩阵
                        else {
                            if(declarator.initializer instanceof matrix_constant){
                                const shape = declarator.initializer.shape;
                                const name = declarator.identifier.name;
                                const sequence = declarator.initializer.rawData.flat().join();
                                buf += `
                                ${name} = MatrixXd(${shape[0]},${shape[1]});
                                ${name} << ${sequence};
                            `;
                            }else {
                                debug$1("FIXME: 代码生成-矩阵插件-矩阵常量初始化类型错误");
                            }
                        }
                    }
                }
                return buf;
            }
        }
    };

    const Void = x=>x; // 默认函数, 返回原参数

    // 添加代理, 避免访问不存在的函数而报错
    const Matrix = new Proxy(Matrix_Object, {
        get: function (target, key, receiver) {
            return target[key] ? target[key] : Void;
        },
    });

    const Plugins = {
        after(functionName, ...args){
            if (COStreamJS.plugins.matrix){
                return Matrix[functionName](...args);
            }
            return args[0]
        }
    };

    class X86CodeGeneration {

        constructor(nCpucore, ssg, mp) {

            this.nCpucore = nCpucore;
            /**@type {StaticStreamGraph} */
            this.ssg = ssg;
            /**@type {Partition} */
            this.mp = mp;

            /** @type {Map<string,bufferSpace>} 字符串到对应的缓冲区的映射 */
            this.bufferMatch = new Map();

            /** @type {Map<string,number>} 缓冲区到对应缓冲区类型的映射，通过这个来判断调用consumer和producer哪种方法 */
            this.bufferType = new Map();

            /** @type {Map<number,Set<number>} 处理器编号到 阶段号集合 的对应关系, 例如 0号核上有 0,2 两个阶段*/
            this.mapNum2Stage = new Map();

            //构造每个线程上的stage集合mapNum2Stage
            for (let i = 0; i < nCpucore; i++) {
                let stageNums = new Set(); //使用Set来对阶段号做"数组去重"操作
                this.mp.PartitonNum2FlatNode.get(i).forEach(flat => stageNums.add(flat.stageNum));
                this.mapNum2Stage.set(i, stageNums); //Set 转回数组
            }

            //头节点执行一次work所需读入的数据量
            this.workLen = 0;
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
        /** Makefile 要求左边必须靠边, 在左边的空白字符用 \t 而不能用空格 */
        var buf = `
PROGRAM := a.out
SOURCES := $(wildcard ./*.cpp)
SOURCES += $(wildcard ./src/*.cpp)
OBJS    := $(patsubst %.cpp,%.o,$(SOURCES))
CXX     := g++
CPPFLAGS := -ggdb -Wall -std=c++11
INCLUDE := -I .
LIB     := -lpthread -ldl

.PHONY: clean install
$(PROGRAM): $(OBJS)
\t$(CXX) -o $@ $^ $(LIB) $(CFLAGS)
%.o: %.c
\t$(CXX) -o $@ -c $< $(CPPFLAGS) $(INCLUDE)
clean:
\trm -f $(OBJS) $(PROGRAM)
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
        buf = Plugins.after('CGGlobalvar', buf, COStreamJS.ast);
        COStreamJS.files['GlobalVar.cpp'] = buf.beautify();
    };

    X86CodeGeneration.prototype.CGGlobalvarHeader = function () {
        var buf = `#ifndef GLOBALVAL_H\n`;
        buf += `#define GLOBALVAL_H\n`;
        for (let node of COStreamJS.ast) {
            if (node instanceof declareNode) {
                let str = node.toString().replace(/=\s*\{[^}]*}/g, ''); //去除 a[3] = {1,2,3} 的赋值部分
                str = sliceStringFromComma(str);            //去除 a = 2 的赋值部分
                buf += "extern " + str + ';\n';
            }
        }
        buf = Plugins.after('CGGlobalvarHeader', buf);
        COStreamJS.files['GlobalVar.h'] = (buf + `#endif`).beautify();

        //截取一个字符串 = 号后(括号匹配最外层的)逗号前的字符串
        function sliceStringFromComma(str){
            let res = '';
            let paren_depth = 0;
            let hasPassedEqual = false;
            for(let i of str){
                if(i === '=') hasPassedEqual = true;
                if(paren_depth === 0 && i === ',') return res
                if(['[','{','('].includes(i)) paren_depth++;
                if([']', '}', ')'].includes(i)) paren_depth--;
                if(!hasPassedEqual) res+=i;
            }
            return res
        }
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
        // 返回前调用插件功能对文本进行处理
        buf = Plugins.after('CGGlobalHeader', buf);
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
                {
                    let edgename = flat.name + '_' + out.name; //边的名称
                    this.bufferMatch.set(edgename, new bufferSpace(edgename, edgename, size, 1, copySize, copyStartPos));
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
     * 循环渲染一段字符串, 用 i 替换 $, 用 i+1 替换$$
     * 例如输入 str='extern_$' , start =0, end=3, 则渲染为 'extern_0 \n extern_1 \n extern_2'
     */
    function circleRender(str, start, end) {
        let result = '';
        for (let i = start; i < end; i++) {
            result += str.replace(/\$\$/g, i + 1).replace(/\$/g, i) + '\n';
        }
        return result
    }
    X86CodeGeneration.prototype.CGMain = function () {
        var buf = `
#include <iostream>
#include <fstream>
#include <stdlib.h>
#include <pthread.h>
#include "setCpu.h"
#include "lock_free_barrier.h"	//包含barrier函数
#include "Global.h"
#include "GlobalVar.h"
#include "RingBuffer.h"
using namespace std;
int MAX_ITER=1;//默认的执行次数是1

#SLOT1

${circleRender('extern void thread_$_fun();', 0, this.nCpucore)}
pthread_t tid[${this.nCpucore}];
${circleRender(`
void* thread_$_fun_start(void *)
{
	set_cpu($, tid[$]);
	thread_$_fun();
	return 0;
}
`, 1, this.nCpucore)}

int main(int argc,char **argv){
	void setRunIterCount(int,char**);
    setRunIterCount(argc,argv);
    #SLOT2
	set_cpu(0,tid[0]);
	allocBarrier(${this.nCpucore});
    
    ${circleRender('pthread_create (&tid[$], NULL, thread_$_fun_start, (void*)NULL);', 1, this.nCpucore)}
    #SLOT3
    thread_0_fun();
    #SLOT4
	return 0;
}
//设置运行次数
void setRunIterCount(int argc,char **argv)
{
	int oc;
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
            buf = buf.replace(/#SLOT\d/g, '');
        }
        buf = Plugins.after('CGMain', buf);
        COStreamJS.files['main.cpp'] = buf.beautify();
    };

    /**
     * 生成包含所有 actor 头文件的 AllActorHeader.h
     */
    X86CodeGeneration.prototype.CGAllActorHeader = function () {
        var buf = '';
        this.ssg.flatNodes.forEach(flat => {
            buf += `#include "${flat.PreName}.h"\n`;
        });
        COStreamJS.files['AllActorHeader.h'] = buf;
    };

    /**
     * 生成所有线程文件
     */
    X86CodeGeneration.prototype.CGThreads = function () {
        for (let i = 0; i < this.nCpucore; i++) {
            var buf = '';
            let MaxStageNum = COStreamJS.MaxStageNum;
            buf = `
/*该文件定义各thread的入口函数，在函数内部完成软件流水迭代*/
#include "Buffer.h"
#include "Producer.h"
#include "Consumer.h"
#include "Global.h"
#include "AllActorHeader.h"	//包含所有actor的头文件
#include "lock_free_barrier.h"	//包含barrier函数
#include "rdtsc.h"
#include <fstream>
extern int MAX_ITER;
        `;
            buf += `void thread_${i}_fun()\n{\n`;
            let syncString = (i > 0 ? `workerSync(` + i : `masterSync(` + this.nCpucore) + `);\n`;
            buf += syncString;

            let actorSet = this.mp.PartitonNum2FlatNode.get(i); //获取到当前线程上所有flatNode
            actorSet.forEach(flat => {
                //准备构造如下格式的声明语句: Name Name_obj(out1,out2,in1,in2);
                buf += flat.PreName + ' ' + flat.name + '_obj(';
                let streamNames = [], comments = [];
                flat.outFlatNodes.forEach(out => {
                    let edgename = flat.name + '_' + out.name;
                    let buffer = this.bufferMatch.get(edgename);
                    if (buffer.instance !== buffer.original) {
                        comments.push(buffer.original + '使用了' + buffer.instance + '的缓冲区');
                    }
                    streamNames.push(buffer.instance); //使用实际的缓冲区
                });
                flat.inFlatNodes.forEach(src => {
                    let edgename = src.name + '_' + flat.name;
                    let buffer = this.bufferMatch.get(edgename);
                    if (buffer.instance !== buffer.original) {
                        comments.push(buffer.original + '使用了' + buffer.instance + '的缓冲区');
                    }
                    streamNames.push(buffer.instance); //使用实际的缓冲区
                });
                buf += streamNames.join(',') + ');';
                comments.length && (buf += ' //' + comments.join(','));
                buf += '\n';
            });

            const constant_array = [1].concat(Array(MaxStageNum-1).fill(0)); // 得到这样的数组: [1,0,0,...,0] 长度为阶段数
            buf += `char stage[${MaxStageNum}] = {${constant_array.join()}};\n`;

            //生成初态的 initWork 对应的 for 循环
            let initFor = `
        for(int _stageNum = 0; _stageNum < ${MaxStageNum}; _stageNum++){
            #SLOT
            ${syncString}
        }
        `;
            var forBody = '';
            let stageSet = this.mapNum2Stage.get(i);    //查找该thread对应的阶段号集合
            for (let stage = MaxStageNum - 1; stage >= 0; stage--) {
                if (stageSet.has(stage)) {
                    //如果该线程在阶段i有actor
                    let ifStr = `if(${stage} == _stageNum){`;
                    //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                    let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat => flat.stageNum == stage);
                    ifStr += flatVec.map(flat => flat.name + '_obj.runInitScheduleWork();\n').join('') + '}\n';
                    forBody += ifStr;
                }
            }
            buf += initFor.replace('#SLOT', forBody);
            //初态的 initWork 对应的 for 循环生成完毕

            //生成稳态的 steadyWork 对应的 for 循环
            let steadyFor = `
        for(int _stageNum = ${MaxStageNum}; _stageNum < 2*${MaxStageNum}+MAX_ITER-1; _stageNum++){
            #SLOT
            ${syncString}
        }
        `;
            var forBody = '';
            for (let stage = MaxStageNum - 1; stage >= 0; stage--) {
                if (stageSet.has(stage)) {
                    //如果该线程在阶段i有actor
                    let ifStr = `if(stage[${stage}]){`;
                    //获取既在这个thread i 上 && 又在这个 stage 上的 actor 集合
                    let flatVec = this.mp.PartitonNum2FlatNode.get(i).filter(flat => flat.stageNum == stage);
                    ifStr += flatVec.map(flat => flat.name + '_obj.runSteadyScheduleWork();\n').join('') + '}\n';
                    forBody += ifStr;
                }
            }
            forBody += 
            `for(int index=${MaxStageNum-1}; index>=1; --index){
            stage[index] = stage[index-1];
         }
         if(_stageNum == MAX_ITER - 1 + ${MaxStageNum}){
             stage[0] = 0;
         }
        `;
            buf += steadyFor.replace('#SLOT', forBody);
            //稳态的 steadyWork 对应的 for 循环生成完毕

            buf += '}';
            COStreamJS.files[`thread_${i}.cpp`] = buf.beautify();
        }
    };

    /** COStream 内建节点, 无需去重 */
    const ProtectedActor = ['join', 'duplicate', 'roundrobin'];
    /**
     * 生成各个计算节点, 例如 source.h sink.h
     */
    X86CodeGeneration.prototype.CGactors = function () {
        var hasGenerated = new Set(); //存放已经生成过的 FlatNode 的 PreName , 用来做去重操作
        this.ssg.flatNodes.forEach(flat => {
            /** 暂时不对COStream 内建节点做去重操作 */
            if(ProtectedActor.includes(flat.PreName)){
                flat.PreName = flat.name;
            } 
            if (hasGenerated.has(flat.PreName)) return
            hasGenerated.add(flat.PreName);

            var buf = `
        #ifndef _${flat.PreName}_
        #define _${flat.PreName}_
        #include <string>
        #include <iostream>
        #include "Buffer.h"
        #include "Consumer.h"
        #include "Producer.h"
        #include "Global.h"
        #include "GlobalVar.h"
        using namespace std;
        `;
            //如果当前节点为IO节点
            if (flat.name.match(/FILEREADER/i)) {
                buf += "#include \"RingBuffer.h\"\n";
                this.workLen = flat.outPushWeights[0];
                //由于目前不支持多类型流变量，这里先强制设置为int
                buf += `
            struct source{
                int buffer[${this.workLen}];
            };
            extern RingBuffer<source> ringBuffer;
            `;
            }

            //开始构建 class
            buf += `class ${flat.PreName}{\n`;
            buf += `public:\n`;
            /*写入类成员函数*/
            let inEdgeNames = flat.inFlatNodes.map(src => src.name + '_' + flat.name);
            let outEdgeNames = flat.outFlatNodes.map(out => flat.name + '_' + out.name);
            buf += this.CGactorsConstructor(flat, inEdgeNames, outEdgeNames);
            buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
            buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
            /*写入类成员变量*/
            buf += "private:\n";
            outEdgeNames.forEach(out => buf += `Producer<streamData>${out};\n` );
            inEdgeNames.forEach(src => buf += `Consumer<streamData>${src};\n`);
            buf += "int steadyScheduleCount;\t//稳态时一次迭代的执行次数\n";
            buf += "int initScheduleCount;\n";
            //写入init部分前的statement定义，调用tostring()函数，解析成规范的类变量定义格式
            buf += this.CGactorsStmts(flat.contents.operBody.stmt_list);
            buf += this.CGactorsPopToken(flat, inEdgeNames);
            buf += this.CGactorsPushToken(flat, outEdgeNames);
            //init部分前的statement赋值
            buf += this.CGactorsinitVarAndState(flat.contents.operBody.stmt_list);
            buf += this.CGactorsInit(flat.contents.operBody.init);
            buf += this.CGactorsWork(flat.contents.operBody.work, flat, inEdgeNames, outEdgeNames);
            /* 类体结束*/
            buf += "};\n";
            buf += "#endif";
            COStreamJS.files[`${flat.PreName}.h`] = buf.beautify();
        });
    };

    /**
     * 生成actors constructor
     * @example
     * rtest_3(Buffer<streamData>& Rstream0_0,Buffer<streamData>& round1_0):Rstream0_0(Rstream0_0),round1_0(round1_0){
     *		steadyScheduleCount = 1;
     *		initScheduleCount = 0;
     * }
     */
    X86CodeGeneration.prototype.CGactorsConstructor = function(flat, inEdgeNames, outEdgeNames) {
        var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames); // 把 out 放前面, in 放后面
        var buf = flat.PreName + '(';
        buf += OutAndInEdges.map(s => 'Buffer<streamData>& ' + s).join(',') + '):';
        buf += OutAndInEdges.map(s => s + '(' + s + ')').join(',') + '{';
        buf += `
        steadyScheduleCount = ${flat.steadyCount};
		initScheduleCount = ${flat.initCount};
	}
    `;
        return buf
    };
    /**
     * @example
     * void runInitScheduleWork() {
     *		initVarAndState();
     *		init();
     *		for(int i=0;i<initScheduleCount;i++)
     *			work();
     *		round1_0.resetTail();
     *		round1_1.resetTail();
     *		dup0_0.resetHead();
     *	}
     */
    X86CodeGeneration.prototype.CGactorsRunInitScheduleWork = function (inEdgeNames, outEdgeNames) {
        var buf = `
    void runInitScheduleWork() {
		initVarAndState();
		init();
		for(int i=0;i<initScheduleCount;i++){    
            work();
        }`;
        (outEdgeNames || []).forEach(out => buf += out + '.resetTail();\n');
        (inEdgeNames || []).forEach(src => buf += src + '.resetHead();\n');
        return buf + '}\n'
    };

    /**
     * @example
     * void runSteadyScheduleWork() {
     *		for(int i=0;i<steadyScheduleCount;i++)
     *			work();
     *		round1_0.resetTail2();
     *		round1_1.resetTail();
     *		dup0_0.resetHead2();
     *	}
     */
    X86CodeGeneration.prototype.CGactorsRunSteadyScheduleWork = function(inEdgeNames, outEdgeNames) {
        var buf = `
    void runSteadyScheduleWork() {
		for(int i=0;i<steadyScheduleCount;i++){
            work();
        }`;
        var use1Or2 = str => this.bufferMatch.get(str).buffertype == 1 ? '' : '2';
        (outEdgeNames || []).forEach(out => buf += out + '.resetTail' + use1Or2(out) + '();\n');
        (inEdgeNames || []).forEach(src => buf += src + '.resetHead' + use1Or2(src) + '();\n');
        return buf + '}\n'
    };

    /**
     * 将.cos 文件中的 operator 的 init 前的变量声明转为新的 class 的 private 成员,例如 
     * private: 
     *   int i; 
     *   int j;
     * 而赋值操作放到 initVarAndState 中去做
     * @param {declareNode[]} stmt_list
     */
    X86CodeGeneration.prototype.CGactorsStmts = function (stmt_list) {
        /*解析等号类似int i=0,j=1形式变成int i; int j;的形式,因为类的成员变量定义不能初始化*/
        var result = '';
        stmt_list.forEach(declare => {
            declare.init_declarator_list.forEach(item => {
                result += item.type + ' ' + item.identifier + ';\n';
            });
        });
        return result;
    };

    /**
     * 生成 class 的 private 部分的 popToken 函数, 例如
     * void popToken() {
     *		Rstream0_0.updatehead(1);
     *		Rstream0_1.updatehead(1);
     * }
     * @param {FlatNode} flat
     */
    X86CodeGeneration.prototype.CGactorsPopToken = function (flat, inEdgeNames) {
        const pop = flat.inPopWeights[0];
        const stmts = inEdgeNames.map(src => `${src}.updatehead(${pop});\n`).join('');
        return `\n void popToken(){ ${stmts} }\n`
    };

    /**
     * 生成 class 的 private 部分的 pushToken 函数, 例如
     * void pushToken() {
     *		Dstream0_1.updatetail(2);
     * }
     * @param {FlatNode} flat
     */
    X86CodeGeneration.prototype.CGactorsPushToken = function (flat, outEdgeNames) {
        const push = flat.outPushWeights[0];
        const stmts = outEdgeNames.map(out => `${out}.updatetail(${push});\n`).join('');
        return `\n void pushToken(){ ${stmts} }\n`
    };

    /** 
     * 将 stmt_list 中的 int i=0部分转换为 i=0; 
     * @param {declareNode[]} stmt_list
     */
    X86CodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list){
        var result = 'void initVarAndState() {';
        stmt_list.forEach( declare =>{
            declare.init_declarator_list.forEach(item =>{
                if(item.initializer){
                    result += item.identifier + '=' + item.initializer +';\n';
                }
            });
        });
        return result+'}';
    };
    X86CodeGeneration.prototype.CGactorsInit = function(init){
        return `void init() ${init|| '{ }'} \n`
    };

    /** 
     * @param {blockNode} work 
     * @param {FlatNode} flat
     */
    X86CodeGeneration.prototype.CGactorsWork = function (work, flat, inEdgeNames, outEdgeNames){
        // 将 work 的 toString 的头尾两个花括号去掉}, 例如 { cout << P[0].x << endl; } 变成 cout << P[0].x << endl; 
        var innerWork = (work + '').replace(/^\s*{/, '').replace(/}\s*$/, ''); 
        // 替换流变量名 , 例如 P = B(S)(88,99);Sink(P){...} 则将 P 替换为 B_1_Sink_2
        flat.contents.inputs.forEach((src, idx) => replace(src, inEdgeNames[idx]));
        flat.contents.outputs.forEach((out, idx) => replace(out, outEdgeNames[idx]));
        
        return `void work(){
        ${innerWork}
        pushToken();
        popToken();
    }\n`

        function replace(A, B) {
            const reg = new RegExp(`\\b${A}\\b`, 'g');
            innerWork = innerWork.replace(reg, B);
        }
    };

    class WEBCodeGeneration {

        constructor(nCpucore, ssg, mp) {

            this.nCpucore = nCpucore;
            /**@type {StaticStreamGraph} */
            this.ssg = ssg;
            /**@type {Partition} */
            this.mp = mp;
        }
    }
    /** 生成stream流类型 */
    WEBCodeGeneration.prototype.CGStreamData = function () {
        var buf = '';

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
        buf += "class StreamData{\n constructor() {\n";
        for (let it of typeSet) {
            buf += `/* ${it.type} */ this.${it.identifier} = undefined;\n`;
        }
        buf += "}\n}\n";

        COStreamJS.files['Global.js'] = buf.beautify();
    };

    WEBCodeGeneration.prototype.CGGlobalvar = function () {
        var buf = 
        `/*---------------------------*/
     /*     主流程开始             */
     /*---------------------------*/
    `;
        for (let node of COStreamJS.ast) {
            if (node instanceof declareNode) {
                buf += node.toString() + ';\n';
            }
        }
        buf = Plugins.after('CGGlobalvar', buf, COStreamJS.ast);
        COStreamJS.files['GlobalVar.cpp'] = buf.beautify();
    };

    /**
     * 生成 Global.cpp  用于存储边的信息
     */
    WEBCodeGeneration.prototype.CGGlobal = function () {
        var buf = '/* Buffer<StreamData> */\n';
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

                let edgename = flat.name + '_' + out.name;
                buf += `let ${edgename} = new Buffer(${size},${copySize},${copyStartPos});\n`;
            }
        }

        COStreamJS.files['Global.cpp'] = buf.beautify();
    };

    WEBCodeGeneration.prototype.CopyLib = function () {
        const LIB = `
    /** 工具函数 */
    function isNumber(string) {
        return string == +string;
    }
    /** 生产者消费者 Constructor */
    class Buffer {
        constructor(size,copySize,copyStartPos){
            let buffer = Array.from({ length:size }).map(_ => new StreamData());
            buffer.bufferSize = size;
            buffer.copySize = copySize;
            buffer.copyStartPos = copyStartPos;
            buffer.writePos = 0;
            return buffer;
        }
    }
    class Consumer {
      constructor(/* Buffer<T> & */conBuffer)
        {
            this.conBuffer = conBuffer
            this.head = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.conBuffer[target.head + parseInt(propKey)]
                    }
                    return target[propKey];
                },
                set: function(target, propKey, value) {
                    if(isNumber(propKey)){
                        target.conBuffer[target.head + parseInt(propKey)] = value
                        return true
                    }
                    target[propKey] = value;
                    return true
                }
            });
        }
        updatehead(offset){
            this.head += offset;
        }
        resetHead(){
            this.head = 0
        }
    }
    class Producer {
      constructor(/* Buffer<T> & */proBuffer)
        {
            this.proBuffer = proBuffer
            this.tail = 0;
            return new Proxy(this, {
                get: function(target, propKey) {
                    if(isNumber(propKey)){
                        return target.proBuffer[target.tail + parseInt(propKey)]
                    }
                    return target[propKey];
                },
                set: function(target, propKey, value) {
                    if(isNumber(propKey)){
                        target.proBuffer[target.tail + parseInt(propKey)] = value
                        return true
                    }
                    target[propKey] = value;
                    return true
                }
            });
        }
        updatetail(offset){
            this.tail += offset;
        }
        resetTail(){
            this.tail = 0
        }
    }
    `;
        COStreamJS.files['lib.js'] = LIB;
    };


    /**
     * 因为 WEB 是单线程, 直接生成程序主流程
     */
    WEBCodeGeneration.prototype.CGMain = function CGMain() {
            var buf = '';
            let MaxStageNum = COStreamJS.MaxStageNum;
            buf = `\n/** 构建 operator Instance */\n`;

            this.ssg.flatNodes.forEach(flat => {
                //准备构造如下格式的声明语句: const Name = new PreName(out1,out2,in1,in2);
                buf += `const ${flat.name} = new ${flat.PreName}(`;
                let streamNames = [];
                flat.outFlatNodes.forEach(out => {
                    let edgename = flat.name + '_' + out.name;
                    streamNames.push(edgename); 
                });
                flat.inFlatNodes.forEach(src => {
                    let edgename = src.name + '_' + flat.name;
                    streamNames.push(edgename); 
                });
                buf += streamNames.join(',') + ',';
                buf += flat.steadyCount + ',' + flat.initCount;
                flat.params.length > 0 ? buf += ',' + flat.params.join(',') : '';
                buf += ');';
                buf += '\n';
            });

            buf += `\n/** 数据流执行过程 */\nconst MAX_ITER = 1;\n`;
            const constant_array = [1].concat(Array(MaxStageNum-1).fill(0)); // 得到这样的数组: [1,0,0,...,0] 长度为阶段数
            buf += `const stage = [${constant_array.join()}];\n`;

            //生成初态的 initWork 对应的 for 循环
            let initFor = `
        for(let _stageNum = 0; _stageNum < ${MaxStageNum}; _stageNum++){
            #SLOT
        }
        `;
            var forBody = '';
            for (let stage = 0 ; stage < MaxStageNum; stage++) {
                let ifStr = `if(${stage} == _stageNum){`;
                //获取在这个 stage 上的 actor 集合
                let flatVec = this.ssg.flatNodes.filter(flat => flat.stageNum == stage);
                ifStr += flatVec.map(flat => flat.name + '.runInitScheduleWork();\n').join('') + '}\n';
                forBody += ifStr;
            }
            buf += initFor.replace('#SLOT', forBody);
            //初态的 initWork 对应的 for 循环生成完毕

            //生成稳态的 steadyWork 对应的 for 循环
            let steadyFor = `
        for(let _stageNum = ${MaxStageNum}; _stageNum < 2*${MaxStageNum}+MAX_ITER-1; _stageNum++){
            #SLOT
        }
        `;
            var forBody = '';
            for (let stage = 0 ; stage < MaxStageNum; stage++) {
                let ifStr = `if(stage[${stage}]){`;
                //获取既在在这个 stage 上的 actor 集合
                let flatVec = this.ssg.flatNodes.filter(flat => flat.stageNum == stage);
                ifStr += flatVec.map(flat => flat.name + '.runSteadyScheduleWork();\n').join('') + '}\n';
                forBody += ifStr;
            }
            forBody += 
            `for(let index=${MaxStageNum-1}; index>=1; --index){
            stage[index] = stage[index-1];
         }
         if(_stageNum == MAX_ITER - 1 + ${MaxStageNum}){
             stage[0] = 0;
         }
        `;
            buf += steadyFor.replace('#SLOT', forBody);
            //稳态的 steadyWork 对应的 for 循环生成完毕

            COStreamJS.files[`main.js`] = buf.beautify();
    };

    WEBCodeGeneration.prototype.Pack = function Pack(){
        COStreamJS.files['main.cpp'] = Object.values(COStreamJS.files).join('\n').beautify();
    };

    /**
     * 生成各个计算节点, 例如 class Source {}; class Sink {};
     */
    WEBCodeGeneration.prototype.CGactors = function () {
        var hasGenerated = new Set(); //存放已经生成过的 FlatNode 的 PreName , 用来做去重操作
        this.ssg.flatNodes.forEach(flat => {
            
            if (hasGenerated.has(flat.PreName)) return
            hasGenerated.add(flat.PreName);

            var buf = '';
            //开始构建 class
            buf += `class ${flat.PreName}{\n`;
            /*写入类成员函数*/
            let oper = flat.contents;
            let inEdgeNames = oper.inputs;
            let outEdgeNames = oper.outputs;
            buf += this.CGactorsConstructor(oper,inEdgeNames, outEdgeNames); 
            buf += this.CGactorsRunInitScheduleWork(inEdgeNames, outEdgeNames);
            buf += this.CGactorsRunSteadyScheduleWork(inEdgeNames, outEdgeNames);
            
            //写入init部分前的statement定义，调用tostring()函数，解析成规范的类变量定义格式

            buf += this.CGactorsPopToken(oper);
            buf += this.CGactorsPushToken(oper);
            //init部分前的statement赋值
            buf += this.CGactorsinitVarAndState(oper.operBody.stmt_list, oper);
            buf += this.CGactorsInit(oper, oper.operBody.init);
            buf += this.CGactorsWork(oper.operBody.work, flat);
            /* 类体结束*/
            buf += "}\n";
            COStreamJS.files[`${flat.PreName}.h`] = buf.beautify();
        });
    };

    /**
     * 生成actors constructor
     * @example
     * constructor(Source_0_B_1, steadyC,initC, param1 ) {
     *  this.steadyScheduleCount = steadyC;
     *  this.initScheduleCount = initC;
     *  this.Source_0_B_1 = new Producer(Source_0_B_1)
     *  this.paramName1 = param1;
     *  this.i = 0
     * }
    **/
    WEBCodeGeneration.prototype.CGactorsConstructor = function(/** @type {operatorNode} */oper,inEdgeNames, outEdgeNames) {
        let paramNames = oper._symbol_table.prev.paramNames;
        var OutAndInEdges = (outEdgeNames || []).concat(inEdgeNames); // 把 out 放前面, in 放后面
        var buf = 'constructor(/* Buffer<StreamData>& */';
        buf += OutAndInEdges.join(',');
        buf += ',steadyC,initC';
        paramNames.length ? buf += ',' + paramNames.join(',') : '';
        buf += '){';
        buf += `
        this.steadyScheduleCount = steadyC;
        this.initScheduleCount = initC;
        ${inEdgeNames.map(src => `this.${src} = new Consumer(${src});`).join('\n')}
        ${outEdgeNames.map(out => `this.${out} = new Producer(${out});`).join('\n')}
        ${paramNames.map(param => `this.${param} = ${param};`).join('\n')}
    `;
        if(oper._symbol_table){
            for(let name of Object.keys(oper._symbol_table.memberTable)){
                let variable = oper._symbol_table.memberTable[name];
                // 若该成员变量被声明为数组类型
                if(variable.array){
                    let { length } = variable.array.arg_list;
                    if(length > 2){
                        error$1(variable._loc,"暂不支持二维以上的数组");
                    }else if(length === 2){
                        const firstDim = variable.array.arg_list[0];
                        var initializer = `Array.from({length:${firstDim}}).map(_=>[])`;
                    }else if(length === 1){
                        var initializer = `[]`;
                    }
                }
                // 非数组类型
                else {
                    var initializer = variable.value.val;
                }
                buf += `this.${name} = ${initializer};\n`;
            }
        }
        return buf+'}'
    };

    WEBCodeGeneration.prototype.CGactorsRunInitScheduleWork = function (inEdgeNames, outEdgeNames) {
        var buf = `
    runInitScheduleWork() {
        this.initVarAndState();
        this.init();
        for (let i = 0; i < this.initScheduleCount; i++) {
            this.work();
        }
        `;
        (outEdgeNames || []).forEach(out => buf += 'this.' + out + '.resetTail();\n');
        (inEdgeNames || []).forEach(src => buf += 'this.' + src + '.resetHead();\n');
        return buf + '}\n'
    };

    WEBCodeGeneration.prototype.CGactorsRunSteadyScheduleWork = function(inEdgeNames, outEdgeNames) {
        var buf = `
    runSteadyScheduleWork() {
        for (let i = 0; i < this.steadyScheduleCount; i++) {
            this.work();
        }
        `;
        (outEdgeNames || []).forEach(out => buf += 'this.' + out + '.resetTail();\n');
        (inEdgeNames || []).forEach(src => buf += 'this.' + src + '.resetHead();\n');
        return buf + '}\n'
    };

    /**
     * 生成 class 的 popToken 函数, 例如
     * popToken() {
     *		this.Rstream0_0.updatehead(1);
     *		this.Rstream0_1.updatehead(1);
     * }
     * @param {operatorNode} oper
     */
    WEBCodeGeneration.prototype.CGactorsPopToken = function (oper) {
        const stmts = [];
        (oper.operBody.win||[]).forEach(winStmt =>{
            if(winStmt.type == 'sliding'){
                let pop = winStmt.arg_list[0].toString();
                oper._symbol_table.prev.paramNames.forEach(name =>{
                    const reg = new RegExp(`\\b(?<!\\.)${name}\\b`, 'g');
                    pop = pop.replace(reg, 'this.'+name);
                });
                stmts.push(`this.${winStmt.winName}.updatehead(${pop});`);
            }
        });
        return `\n popToken(){ ${stmts.join('\n')} }\n`
    };

    /**
     * 生成 class 的 pushToken 函数, 例如
     * pushToken() {
     *		this.Dstream0_1.updatetail(2);
     * }
     * @param {FlatNode} flat
     */
    WEBCodeGeneration.prototype.CGactorsPushToken = function (oper) {
        const stmts = [];
        (oper.operBody.win||[]).forEach(winStmt =>{
            if(winStmt.type == 'tumbling'){
                let push = winStmt.arg_list[0].toString();
                oper._symbol_table.prev.paramNames.forEach(name =>{
                    const reg = new RegExp(`\\b(?<!\\.)${name}\\b`, 'g');
                    push = push.replace(reg, 'this.'+name);
                });
                stmts.push(`this.${winStmt.winName}.updatetail(${push});`);
            }
        });
        return `\n pushToken(){ ${stmts.join('\n')} }\n`
    };

    /** 
     * 将 stmt_list 中的 let i=0部分转换为 this.i=0; 
     * @param {declareNode[]} stmt_list
     */
    WEBCodeGeneration.prototype.CGactorsinitVarAndState = function (stmt_list, oper){
        // 基于符号表来把 变量名 转化为 string
        const originToString = String.prototype.toString;
        String.prototype.toString = function (){
            let searchResult = oper._symbol_table.searchName(this);
            if(oper._symbol_table.prev.paramNames.includes(this)){
                return 'this.'+this
            }else if(searchResult){
                // 替换符号表中的成员变量和流变量的访问 
                if(searchResult.type === 'stream' || searchResult.type === 'member'){
                    return 'this.'+this
                }else if(searchResult.type === 'variable'){
                    // 替换 oper 对上层符号表的数据的访问
                    if(searchResult.origin !== oper._symbol_table){
                        return oper._symbol_table.getVariableValue(this)
                    }
                }
            }
            return this
        };
        var result = 'initVarAndState() {';
        stmt_list.forEach( declare =>{
            declare.init_declarator_list.forEach(item =>{
                if(item.initializer){
                    result += item.identifier + '=' + item.initializer +';\n';
                }
            });
        });
        String.prototype.toString = originToString;
        return result+'}';
    };
    WEBCodeGeneration.prototype.CGactorsInit = function(oper, init){
        const memberTable = (oper._symbol_table||{}).memberTable || {} ;
        let buf = (init||'{ }').toString();
        Object.keys(memberTable).forEach(memberName =>{
            const reg  = new RegExp(`\\b(?<!\\.)${memberName}\\b`,'g');
            buf = buf.replace(reg, 'this.'+memberName);
        });

        return `init() ${buf} \n`
    };

    /** 
     * @param {blockNode} work 
     * @param {operatorNode} oper
     */
    WEBCodeGeneration.prototype.CGactorsWork = function (work, flat){
        // 基于符号表来把 work 转化为 string
        const originToString = String.prototype.toString;
        String.prototype.toString = function (){
            let searchResult = work._symbol_table.searchName(this);
            if(flat._symbol_table.paramNames.includes(this)){
                return 'this.'+this
            }else if(searchResult){
                // 替换符号表中的成员变量和流变量的访问 
                if(searchResult.type === 'stream' || searchResult.type === 'member'){
                    return 'this.'+this
                }else if(searchResult.type === 'variable'){
                    // 如果该变量是属于根符号表中的全局变量
                    if(searchResult.origin === work._symbol_table.root){
                        return this
                    }
                    // 如果该变量名是 composite 中定义的过程变量, 则替换 oper 对上层符号表的数据的访问
                    else if(searchResult.origin !== work._symbol_table){
                        if(!work._symbol_table.LookupIdentifySymbol(this).value){
                            debugger;
                        }
                        return work._symbol_table.getVariableValue(this)
                    }
                }
            }
            return this
        };

        // 将 work 的 toString 的头尾两个花括号去掉}, 例如 { cout << P[0].x << endl; } 变成 cout << P[0].x << endl; 
        let innerWork = (work + '').replace(/^\s*{/, '').replace(/}\s*$/, ''); 
        String.prototype.toString = originToString;

        return `work(){
        ${innerWork}
        this.pushToken();
        this.popToken();
    }\n`
    };

    function codeGeneration(nCpucore, ssg, mp) {
        if (COStreamJS.options.platform === 'WEB') {
            var WEBCode = new WEBCodeGeneration(nCpucore, ssg, mp);
            WEBCode.CopyLib();
            WEBCode.CGStreamData();      //生成流类型声明
            WEBCode.CGactors();          //生成以类表示的计算单元actor
            WEBCode.CGGlobalvar();       //生成流程序引入的全局变量定义文件 GlobalVar.cpp
            WEBCode.CGGlobal();          //生成流程序的所有缓冲区信息 Global.cpp
            WEBCode.CGMain();            //生成线程启动的main文件
            WEBCode.Pack();              //打包目前生成的所有文件             

        } else if (COStreamJS.options.platform === 'X86') {
            var X86Code = new X86CodeGeneration(nCpucore, ssg, mp);
            X86Code.CGMakefile();        //生成Makefile文件
            X86Code.CGGlobalvar();       //生成流程序引入的全局变量定义文件 GlobalVar.cpp
            X86Code.CGGlobalvarHeader(); //生成流程序引入的全局变量的声明文件 GlobalVar.h
            X86Code.CGGlobalHeader();    //生成流程序的所有缓冲区声明Global.h
            X86Code.CGGlobal();          //生成流程序的所有缓冲区信息Global.cpp
            X86Code.CGactors();          //生成以类表示的计算单元actor
            X86Code.CGAllActorHeader();  //生成所有actor节点头文件
            X86Code.CGThreads();         //生成所有线程
            X86Code.CGMain();            //生成线程启动的main文件
            //X86Code.CGFunctionHeader();  //生成function头文件
            //X86Code.CGFunction();        //生成function定义

            /** 拷贝程序运行所需要的库文件 */
            if (typeof module !== 'undefined') ; else {
                console.warn('浏览器版本暂不支持拷贝库文件');
            }
        } else {
            console.error('FIXME: 未识别的平台');
        }
    }

    const handle_options = { main: () => {} };
    const Usage = ` 
  Version ${COStreamJS.version}
  Usage: COStream  [options] [file]

  Parses <file> as a COStream program, reporting syntax and type errors, and writes paralleled program out to <file>. If <file> is null, uses stdin and stdout.
`;

    (function handleOptions_Main() {
    	if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
    		const fs = require('fs');
    		const argv = require('yargs').usage(Usage).option({
    			j: { alias: 'nCpucore', type: 'number', default: 4},
    			w: { alias: 'nowarning' },
                o: { alias: 'output', describe: '设置输出路径, 默认为 dist/filename' },
    			v: { alias: 'version' }
    		}).argv;

    		handle_options.main = function commonjsMain(args) {
    			console.log(`控制台参数:\n`,argv);
    			if (!argv._[0]) {
                    require('yargs').showHelp();
    				process.exit(1);
    			}
    			if (argv.v) {
    				console.log(`COStreamJS Version: ${COStreamJS.version}`);
    				process.exit(1);
    			}

    			const source_path = require('path').normalize(argv._[0]);
    			const source_content = fs.readFileSync(source_path, 'utf8');
    			const source_filename = source_path.split('/').pop().split('.')[0];
    			console.log(`输入文件信息:\n`, source_path, source_filename);

    			const removeLastChar = (s) => (s[s.length - 1] === '/' ? s.slice(0, -1) : s); //移除路径最后的一个'/'
    			/** 设置输出文件夹的路径 */
                const outDir = (argv.o && removeLastChar(argv.o)) || `./dist/${source_filename}`;
                COStreamJS.outDir = outDir;

                COStreamJS.main(source_content, { platform:'X86', coreNum: argv.j || 4}); //执行编译
                if(fs.existsSync(outDir)){
                    require('child_process').execSync(`rm -rf ${outDir}/*`);
                }else {
                    fs.mkdirSync(outDir);
    			}
    			// 拷贝基础库文件, 避开 Eigen 库文件(使用 rsync 来实现这一功能, 而非 cp 指令)
    			const libDir = require('path').resolve(__dirname, "../lib");
    			require('child_process').exec(`rsync -a --exclude Eigen ${libDir}/* ${outDir}`, error => 
    				error && console.error(`拷贝库文件出错: ${error}`)
    			);
    			// 根据情况决定是否拷贝矩阵库文件
    			if(COStreamJS.plugins.matrix){
    				require('child_process').exec(`rsync -a ${libDir}/Eigen ${outDir}`, error =>
    					error && console.error(`拷贝矩阵库文件出错: ${error}`)
    				);
    			}
    			// 写入生成的文件
    			Object.entries(COStreamJS.files).forEach(([ out_filename, content ]) => {
    				fs.writeFileSync(`${outDir}/${out_filename}`, content);
    			});
    		};
    	}
    })();

    Object.assign(COStreamJS.__proto__, {
        parser,
        AST2FlatStaticStreamGraph,
        unfold : new UnfoldComposite(),
        SemCheck,
        DumpStreamGraph,
        GreedyPartition,
        GetSpeedUpInfo,
        PrintSpeedUpInfo,
        StageAssignment,
        codeGeneration,
        SymbolTable,
    });

    COStreamJS.main = function(str, options = { coreNum:4 }){
        debugger
        COStreamJS.global.errors = [];
        // 1. 先检查括号是否匹配
        if(!checkBraceMatching(str)) return
        // 2. 词语法分析构建语法树
        this.ast = COStreamJS.parser.parse(str);
        // 3. 遍历语法树进行语义分析和构建符号表
        this.symbolTableList = generateSymbolTables(this.ast);
        if(COStreamJS.global.errors.length) return;
        this.S = this.symbolTableList[0];
        this.gMainComposite = this.SemCheck.findMainComposite(this.ast);
        
        // 4. 语法树转数据流图
        this.ssg = this.AST2FlatStaticStreamGraph(this.gMainComposite, this.unfold, this.S);
        // 5. 工作量估计
        WorkEstimate(this.ssg);
        // 6. 调度
        ShedulingSSG(this.ssg);
        // 7. 划分
        this.mp = new this.GreedyPartition(this.ssg);
        this.mp.setCpuCoreNum(options.coreNum);
        this.mp.SssgPartition(this.ssg);
        this.mp.computeCommunication();
        // 8. 输出统计信息
        let SI = this.GetSpeedUpInfo(this.ssg,this.mp);
        debug$1(this.PrintSpeedUpInfo(SI));
        // 9. 阶段赋值
        this.MaxStageNum = this.StageAssignment(this.ssg,this.mp);
        // 10.目标代码生成
        this.files = {};
        this.options.platform = options.platform || this.options.platform;
        this.codeGeneration(this.mp.finalParts,this.ssg,this.mp);
    };

    //下面代码是为了在浏览器的 window 作用域下调试而做的妥协
    COStreamJS.global = typeof window === "object" ? window : global;
    Object.assign(COStreamJS.global, utils);
    Object.assign(COStreamJS.global, NodeTypes, {
        ast2String,
        COStreamJS
    });

    /** 下面的代码用于支持命令行功能 */
    if (typeof module !== 'undefined' && require.main === module) {
        handle_options.main(process.argv);
    }

    return COStreamJS;

}());
