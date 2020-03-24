
/* lexer */
%lex
%%

\s+                                                         /* skip whitespace */
"/*"([^\*]|(\*)*[^\*/])*(\*)*"*/"                           /* skip Annotation */
"//".*                                                      /* ignore comment */
(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b              return 'NUMBER'
("'"[^']*"'"|"\""[^\"]*"\"")                                return 'STRING_LITERAL'

string                                                      return 'STRING'
int                                                         return 'INT'
double                                                      return 'DOUBLE'
float                                                       return 'FLOAT'
long                                                        return 'LONG'
const                                                       return 'CONST'
define                                                      return 'DEFINE'

while                                                       return 'WHILE'
for                                                         return 'FOR'
break                                                       return 'BREAK'
continue                                                    return 'CONTINUE'
switch                                                      return 'SWITCH'
case                                                        return 'CASE'
default                                                     return 'DEFAULT'
if                                                          return 'IF'
else                                                        return 'ELSE'
do                                                          return 'DO'
return                                                      return 'RETURN'

composite                                                   return 'COMPOSITE'
input                                                       return 'INPUT'
output                                                      return 'OUTPUT'
stream                                                      return 'STREAM'
FileReader                                                  return 'FILEREADER'
FileWriter                                                  return 'FILEWRITER'
add                                                         return 'ADD'

param                                                       return 'PARAM'
init                                                        return 'INIT'
work                                                        return 'WORK'
window                                                      return 'WINDOW'
tumbling                                                    return 'TUMBLING'
sliding                                                     return 'SLIDING'

splitjoin                                                   return 'SPLITJOIN'
pipeline                                                    return 'PIPELINE'
split                                                       return 'SPLIT'
join                                                        return 'JOIN'
duplicate                                                   return 'DUPLICATE'
roundrobin                                                  return 'ROUNDROBIN'
sequential                                                  return 'SEQUENTIAL'
DENSE|Dense                                                 return 'DENSE'
Conv2d                                                      return 'CONV2D'

import                                                      return 'IMPORT'
Matrix|matrix                                               return 'MATRIX'


[a-zA-Z_][a-zA-Z0-9_]*                                      return 'IDENTIFIER'

"*="|"/="|"+="|"-="|"<<="|">>="|"&="|"^="|"|="              return 'ASSIGNMENT_OPERATOR'
"##"|"++"|"--"|">>"|">>"|"<="|">="|"=="|"!="|"&&"|"||"      return yytext
[-*+/%&|~!()\[\]{}'"#,\.?:;<>=]                             return yytext

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex
/* A. 下面是从词法分析器传进来的 token */
%token STRING_LITERAL   NUMBER  IDENTIFIER          
%token STRING     INT   DOUBLE  FLOAT       LONG    CONST   DEFINE
%token WHILE      FOR   BREAK   CONTINUE    SWITCH  CASE DEFAULT IF ELSE DO RETURN
%token ASSIGNMENT_OPERATOR
    /* A.1 ----------------- COStream 特有关键字 ---------------*/
%token COMPOSITE  INPUT OUTPUT  STREAM    FILEREADER  FILEWRITER  ADD
%token PARAM      INIT  WORK    WINDOW    TUMBLING    SLIDING
%token SPLITJOIN  PIPELINE      SPLIT     JOIN        DUPLICATE ROUNDROBIN

%nonassoc IF_WITHOUT_ELSE
%nonassoc ELSE

%left "||" 
%left "&&"
%left '|'
%left '^'
%left '&'
%left "==" "!="
%left '<' "<=" '>' ">="
%left "<<" ">>"
%left '+' '-'
%left '*' '/' '%'

%start prog_start
%%

prog_start: translation_unit EOF            { return $1 };
/************************************************************************/
/*              1. 文法一级入口,由下面三种文法组成                           */
/*                 1.1. declaration 声明                                 */
/*                 1.2. function_definition 函数声明                      */
/*                 1.3. composite_definition 数据流计算单元声明             */
/*************************************************************************/
translation_unit:
      external_declaration                  { $$ = [$1] }
    | translation_unit external_declaration { $$.push($2) }
    ;

external_declaration:
      function_definition
    | declaration
    | composite_definition
    | IMPORT MATRIX   ';'                   { COStreamJS.plugins.matrix = true; }
    ;
/*************************************************************************/
/*              1.1 declaration 由下面2种文法+2个基础组件组成                */
/*                      1.1.1 declaring_list                             */
/*                      1.1.2 stream_declaring_list                      */
/*                      1.1.3 initializer                                */
/*************************************************************************/ 
declaration:
      declaring_list ';'                          { $$ = $1 }
    | stream_declaring_list ';'                   { $$ = $1 }
    ;
declaring_list:
      type_specifier   init_declarator_list       { $$ = new declareNode(@$,$1,$2); $2.forEach(d=>d.type=$1) }
    ;
init_declarator_list:
      init_declarator                             { $$ = [$1] }
    | init_declarator_list ',' init_declarator    { $$.push($3) }
    ;

init_declarator:
      declarator                                  { $$ = new declarator(@$,$1,undefined) }
    | declarator '=' initializer                  { $$ = new declarator(@$,$1,$3)        }
    ;

declarator:
      IDENTIFIER                                  { $$ = new idNode(@$,$1)                     }
    | '(' declarator ')'                          { error("暂未支持该种declarator的写法")         }
    | declarator '[' constant_expression ']'      { $1.arg_list.push($3)                       }
    | declarator '[' ']'                          { $1.arg_list.push(0)                        }
    ;  
/*************************************************************************/
/*                      1.1.2 stream_declaring_list                      */
/*************************************************************************/    
stream_declaring_list:
      stream_type_specifier IDENTIFIER            { $$ = new declareNode(@$,$1,$2)  }
    | stream_declaring_list ',' IDENTIFIER        { $$.init_declarator_list.push($3)}
    ;
/*************************************************************************/
/*                      1.1.3 initializer                                */
/*************************************************************************/
initializer:
      assignment_expression
    | '{' initializer_list '}'                    { $$ = $2 }
    | '{' initializer_list ',' '}'                { $$ = $2 }
    ;

initializer_list:
      initializer                                 { $$ = $1 }
    | initializer_list ',' initializer            { $$ = $1 instanceof Array ? $1.concat($3) : [$1,$3]}
    ;
/*************************************************************************/
/*              1.2 function_definition 函数声明                          */
/*                      1.2.1 parameter_type_list                        */
/*                      1.2.1 function_body                              */
/*************************************************************************/
function_definition:
      type_specifier declarator '(' parameter_type_list ')' compound_statement { $$ = new function_definition(@$,$1,$2,$4,$6); }
    | type_specifier declarator '(' ')' compound_statement { $$ = new function_definition(@$,$1,$2,[],$5); }
    ;

parameter_type_list:
      parameter_declaration                         { $$ = [$1]   }
    | parameter_type_list ',' parameter_declaration { $$.push($3) }
    ;

parameter_declaration:
      type_specifier declarator         { $$ = new declarator(@$,$2); $$.type=$1 }
    ;
/*************************************************************************/
/*              1.3 composite.definition 数据流计算单元声明                */
/*                      1.3.1 composite.head                             */
/*                      1.3.2 composite.body                             */
/*************************************************************************/
composite_definition:
      composite_head composite_body                         { $$ = new compositeNode(@$,$1,$2) }
    ;
composite_head:
      COMPOSITE IDENTIFIER '(' composite_head_inout ')'     { $$ = new compHeadNode(@$,$2,$4)  }
    ;
composite_head_inout:
      /*empty*/                                                                           { $$ = undefined }
    | INPUT composite_head_inout_member_list                                              { $$ = new ComInOutNode(@$,$2)          }
    | INPUT composite_head_inout_member_list ',' OUTPUT composite_head_inout_member_list  { $$ = new ComInOutNode(@$,$2,$5)       }
    | OUTPUT composite_head_inout_member_list                                             { $$ = new ComInOutNode(@$,undefined,$2)}
    | OUTPUT composite_head_inout_member_list ',' INPUT composite_head_inout_member_list  { $$ = new ComInOutNode(@$,$5,$2)       }
    ;
composite_head_inout_member_list:
      composite_head_inout_member                                       { $$ = [$1]   }                                    
    | composite_head_inout_member_list ',' composite_head_inout_member  { $$.push($3) }                    
    ;
composite_head_inout_member:
      stream_type_specifier IDENTIFIER                                  { $$ = new inOutdeclNode(@$,$1,$2) }                      
    ;
stream_type_specifier:
      STREAM '<' stream_declaration_list '>'                            { $$ = $3 }
    ;    
stream_declaration_list:
      type_specifier IDENTIFIER                                         { $$ = new strdclNode(@$,$1,$2)              }
    | stream_declaration_list ',' type_specifier IDENTIFIER             { $$.id_list.push({ type:$3,identifier:$4 }) }
    ;
/*************************************************************************/
/*                      1.3.2 composite_body                             */
/*************************************************************************/
composite_body:
      '{' composite_body_param_opt statement_list '}'    { $$ = new compBodyNode(@$,$2,$3) }                     
    ;
composite_body_param_opt:
      /*empty*/                                                         { $$ = undefined }
    | PARAM parameter_type_list ';'                                     { $$ = new paramNode(@$,$2)       }
    ;
/*****************************************************************************/
/*        2. operator_add  composite体内的init work window等组件   */
/*             2_1   ADD operator_pipeline                                   */
/*             2_2   ADD operator_splitjoin                                  */
/*             2_3   ADD operator_default_call                               */
/*****************************************************************************/
operator_add:
          ADD operator_pipeline                             {  $$ = new addNode(@$,$2) }
        | ADD operator_splitjoin                            {  $$ = new addNode(@$,$2) }
        | ADD operator_layer                                {  $$ = new addNode(@$,$2) }
        | ADD operator_default_call                         {  $$ = new addNode(@$,$2) }
        ;  

operator_pipeline:
          PIPELINE '{'  statement_list '}'
                                                            {
                                                                $$ = new pipelineNode(@$,{
                                                                    compName: 'pipeline',
                                                                    inputs: undefined,
                                                                    body_stmts: $3
                                                                })
                                                            }    
        ;
operator_splitjoin:
          SPLITJOIN '{' split_statement  statement_list  join_statement '}'     
                                                            {
                                                                $$ = new splitjoinNode(@$,{
                                                                    compName: 'splitjoin',
                                                                    inputs: undefined,
                                                                    stmt_list: undefined,
                                                                    split: $3,
                                                                    body_stmts: $4,
                                                                    join: $5
                                                                })
                                                            }
        | SPLITJOIN '{' statement_list split_statement statement_list join_statement '}'  
                                                            {
                                                                $$ = new splitjoinNode(@$,{
                                                                    compName: 'splitjoin',
                                                                    inputs: undefined,
                                                                    stmt_list: $3,
                                                                    split: $4,
                                                                    body_stmts: $5,
                                                                    join: $6
                                                                })
                                                            }
        ;
split_statement:
          SPLIT duplicate_statement                         { $$ = new splitNode(@$,$2)     }          
        | SPLIT roundrobin_statement                        { $$ = new splitNode(@$,$2)     }
        ;
roundrobin_statement:
          ROUNDROBIN '(' ')' ';'                            { $$ = new roundrobinNode(@$)   }
        | ROUNDROBIN '(' argument_expression_list ')' ';'   { $$ = new roundrobinNode(@$,$3)}
        ;
duplicate_statement:
          DUPLICATE '('  ')' ';'                            { $$ = new duplicateNode(@$)    }
        | DUPLICATE '(' exp ')'  ';'                        { $$ = new duplicateNode(@$,$3) }
        ;
join_statement:
          JOIN roundrobin_statement                         { $$ = new joinNode(@$,$2)      }
        ;
operator_default_call:
          IDENTIFIER  '(' ')' ';'                           { $$ = new compositeCallNode(@$,$1)    }
        | IDENTIFIER  '(' argument_expression_list ')' ';'  { $$ = new compositeCallNode(@$,$1,[],$3) }
        ;  
operator_layer:      
          DENSE  '(' argument_expression_list ')' ';'       { $$ = new denseLayerNode(@$,"dense", $3);}
        | CONV2D '(' argument_expression_list ')' ';'       { $$ = new conv2DLayerNode(@$,"conv2D", $3); }
        ; 
/*************************************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement                    */
/*************************************************************************/    
statement:
      labeled_statement
    | compound_statement
    | expression_statement
    | selection_statement
    | iteration_statement
    | jump_statement
    | declaration
    | operator_add
    ;
labeled_statement:
      CASE constant_expression ':' statement    { $$ = new labeled_statement(@$,$1,$2,$3,$4)}
    | DEFAULT ':' statement                     { $$ = new labeled_statement(@$,$1,undefined,$2,$3)}
    ;
compound_statement: 
      '{' '}'                                   { $$ = new blockNode(@$,$1,[],$2) } 
    | '{' statement_list '}'                    { $$ = new blockNode(@$,$1,$2,$3) }
    ;
statement_list:
      statement                { $$ = $1 ? [$1] : []   }
    | statement_list statement { if($2) $$.push($2)    }
    ;
expression_statement:
      ';'                       { $$ = undefined }
    | multi_expression ';'      { $$ = $1 }
    ;
selection_statement:
      IF '(' expression ')' statement %prec IF_WITHOUT_ELSE 
      { $$ = new selection_statement(@$,$1,$2,$3,$4,$5)        }
    | IF '(' expression ')' statement ELSE statement
      { $$ = new selection_statement(@$,$1,$2,$3,$4,$5,$6,$7)  }
    | SWITCH '(' expression ')' statement
      { $$ = new selection_statement(@$,$1,$2,$3,$4,$5)        }
    ;
iteration_statement:
      WHILE '(' expression ')' statement 
      { $$ = new whileNode(@$,$3,$5) }
    | DO statement WHILE '(' expression ')' ';' 
      { $$ = new doNode(@$,$5,$2)    }
    | FOR '(' expression_statement expression_statement ')' statement
      { $$ = new forNode(@$,$3,$4,undefined,$6)    }
    | FOR '(' expression_statement expression_statement expression ')' statement
      { $$ = new forNode(@$,$3,$4,$5,$7) }
    ;
jump_statement:
      CONTINUE ';'          { $$ = new jump_statement(@$,$1) }
    | BREAK ';'             { $$ = new jump_statement(@$,$1) }
    | RETURN ';'            { $$ = new jump_statement(@$,$1) }
    | RETURN expression ';' { $$ = new jump_statement(@$,$1,$2) }
    ;    

/*************************************************************************/
/*        4. expression 计算表达式头节点                                    */
/*            4.1 矩阵的常量节点                                            */
/*************************************************************************/
matrix_slice_pair:
        ':'                    { $$ = new matrix_slice_pair(@$,undefined, ':')   } 
    |   expression             { $$ = new matrix_slice_pair(@$,$1)               }     
    |   exp ':'                { $$ = new matrix_slice_pair(@$,$1,':')           }
    |   ':' exp                { $$ = new matrix_slice_pair(@$,undefined,':',$2) }
    |   exp ':' exp            { $$ = new matrix_slice_pair(@$,$1,':',$3)        }
    ;
matrix_slice_pair_list:
        matrix_slice_pair                               { $$ = [$1] }
    |   matrix_slice_pair_list ',' matrix_slice_pair    { $$ = $$.concat($3) }
    ;
matrix_slice:
      '[' matrix_slice_pair_list ']'                    { $$ = $2 }
    ;
/*************************************************************************/
/*            4.2 expression 其他节点                                     */
/*************************************************************************/
vector_expression:
      '[' multi_expression ']'      { $$ = new matrix_constant(@$, $2) }
    ;
multi_expression:
      expression                    { $$ = $1 }
    | multi_expression ',' expression    { $$ = Array.isArray($1) ? $1.concat($3) : [$1,$3] }
    ;
primary_expression:
      IDENTIFIER            
    | 'NUMBER'                   { $$ = new constantNode(@$,$1) }
    | STRING_LITERAL             { $$ = new constantNode(@$,$1) }
    | '(' multi_expression ')'   { $$ = new parenNode(@$,$2)    }
    | vector_expression 
    ;
operator_arguments:
      '(' ')'               { $$ = [] }
    | '(' argument_expression_list ')' { $$ = $2 }
    ;
postfix_expression:
      primary_expression     
    | postfix_expression matrix_slice                       { $$ = new matrix_section(@$,$1,$2) }    
    | postfix_expression operator_arguments                 { 
                                                                if($$ instanceof callNode){
                                                                    $$ = new compositeCallNode(@$,$1.name,$1.arg_list,$2)
                                                                }         
                                                                else{
                                                                    $$ = new callNode(@$,$1,$2)
                                                                }
                                                            }
    | MATRIX '.' IDENTIFIER                                 { $$ = new lib_binopNode(@$,$1,$3) }
    | postfix_expression '.' IDENTIFIER                     { $$ = new binopNode(@$,$1,$2,$3) }
    | postfix_expression '++'                               { $$ = new unaryNode(@$,$1,$2)    }
    | postfix_expression '--'                               { $$ = new unaryNode(@$,$1,$2)    }
    | FILEREADER '(' ')' '(' stringConstant ')'             { error("暂不支持FILEREADER")      }
    | postfix_expression operator_arguments operator_selfdefine_body       
                                                            {
                                                                $$ = new operatorNode(@$,$1,$2,$3)
                                                            } 
    |  SPLITJOIN '(' argument_expression_list ')'  '{' split_statement statement_list  join_statement '}'  
                                                            {
                                                                $$ = new splitjoinNode(@$,{
                                                                    compName: 'splitjoin',
                                                                    inputs: $3,
                                                                    stmt_list: undefined,
                                                                    split: $6,
                                                                    body_stmts: $7,
                                                                    join: $8
                                                                })
                                                            }
    |  SPLITJOIN '(' argument_expression_list ')'  '{' statement_list split_statement statement_list  join_statement '}'
                                                            {
                                                                $$ = new splitjoinNode(@$,{
                                                                    compName: 'splitjoin',
                                                                    inputs: $3,
                                                                    stmt_list: $6,
                                                                    split: $7,
                                                                    body_stmts: $8,
                                                                    join: $9
                                                                })
                                                            }
    |   PIPELINE '(' argument_expression_list ')'  '{' statement_list '}'
                                                            {
                                                                $$ = new pipelineNode(@$,{
                                                                    compName: 'pipeline',
                                                                    inputs: $3,
                                                                    body_stmts: $6
                                                                })
                                                            }
    |   SEQUENTIAL '(' argument_expression_list ')' '(' argument_expression_list ')' '{' statement_list '}' 
                                                            {
                                                                $$ = new sequentialNode(@$,{
                                                                    compName: 'squential',
                                                                    inputs: $3,
                                                                    arg_list: $6,
                                                                    body_stmts: $9
                                                                })
                                                            }                                                        
    ;

argument_expression_list:
      assignment_expression                                 { $$ = [$1]   }
    | argument_expression_list ',' assignment_expression    { $$.push($3) }
    ;

unary_expression:
      postfix_expression                
    | '++' unary_expression             { $$ = new unaryNode(@$,$1,$2) }
    | '--' unary_expression             { $$ = new unaryNode(@$,$1,$2) }
    | unary_operator unary_expression   { $$ = new unaryNode(@$,$1,$2) }
    | '(' basic_type_name ')' unary_expression    { $$ = new castNode(@$,$2,$4) }
    ;

unary_operator:
      '+'
    | '-'
    | '~'
    | '!'
    ;

exp:
      unary_expression
    | exp "*" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "/" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "+" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "-" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "%" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "^" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "|" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "&" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "<" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp ">" exp   { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "<=" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp ">=" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "==" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "!=" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "<<" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp ">>" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "||" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    | exp "&&" exp  { $$ = new binopNode(@$,$1,$2,$3) }
    ;

conditional_expression:
      exp
    | exp '?' expression ':' conditional_expression { $$ = new ternaryNode(@$,$1,$3,$5) }
    ;

assignment_expression:
      conditional_expression
    | unary_expression assignment_operator assignment_expression    
      {
          if([splitjoinNode,pipelineNode,compositeCallNode,operatorNode,sequentialNode].some(x=> $3 instanceof x)){
              if($1 instanceof parenNode){
                  $3.outputs = $1.exp.slice()
              }else if(typeof $1 == "string"){
                  $3.outputs = [$1]
              }else{
                  error("只支持 S = oper()() 或 (S1,S2) = oper()() 两种方式",$1,$3) 
              }
          }
          $$ = new binopNode(@$,$1,$2,$3) 
      }
    ;
assignment_operator:
      '='
    | ASSIGNMENT_OPERATOR
    ;
expression:
      assignment_expression { $$ = $1 }
    ;

constant_expression:
      conditional_expression
    ;
/*************************************************************************/
/*        4.1 postfix_operator COStream 的 operator 表达式                */
/*************************************************************************/
operator_selfdefine_body:
       '{' operator_selfdefine_body_init operator_selfdefine_body_work operator_selfdefine_body_window_list '}'
       {
           $$ = new operBodyNode(@$,[],$2,$3,$4)
       }
     | '{' statement_list operator_selfdefine_body_init  operator_selfdefine_body_work operator_selfdefine_body_window_list '}'
       {
           $$ = new operBodyNode(@$,$2,$3,$4,$5)
       }
     ;    
operator_selfdefine_body_init:
      /*empty*/
    | INIT compound_statement { $$ = $2 }
    ;
operator_selfdefine_body_work:
      WORK compound_statement { $$ = $2 }
    ;
operator_selfdefine_body_window_list:
      /*empty*/                                         
    | WINDOW '{' operator_selfdefine_window_list '}'  { $$ = $3 }
    ;
operator_selfdefine_window_list:
      operator_selfdefine_window                                    { $$ = [$1]   }
    | operator_selfdefine_window_list operator_selfdefine_window    { $$.push($2) }
    ;
operator_selfdefine_window:
      IDENTIFIER window_type ';'                       { $$ = new winStmtNode(@$,$1,$2) }
    ;
window_type:
      SLIDING '('  ')'                                 { $$ = { type:$1 } }
    | TUMBLING '('  ')'                                { $$ = { type:$1 } }       
    | SLIDING '(' argument_expression_list ')'         { $$ = { type:$1, arg_list: $3} }
    | TUMBLING '(' argument_expression_list ')'        { $$ = { type:$1, arg_list: $3} } 
    ;     
/*************************************************************************/
/*        5. basic 从词法TOKEN直接归约得到的节点,自底向上接入头部文法结构        */
/*************************************************************************/
type_specifier:
          basic_type_name       
        | CONST basic_type_name  { $$ = "const "+$2 }
        ;
basic_type_name:
          INT   
        | LONG  
        | LONG LONG  { $$ = "long long" }
        | FLOAT 
        | DOUBLE
        | STRING
        | MATRIX
        ;