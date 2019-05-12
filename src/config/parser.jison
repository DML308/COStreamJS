
/* lexer */
%lex
%%

\s+                                                         /* skip whitespace */
(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b              return 'NUMBER'
[A-z_][0-9A-z]*                                             return 'IDENTIFIER'
("'"[^']*"'"|"\""[^\"]*"\"")                                return 'stringConstant'

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

"##"|"++"|"--"|">>"|">>"|"<="|">="|"=="|"!="|"&&"|"||"      return yytext
"="|"*="|"/="|"+="|"-="|"<<="|">>="|"&="|"^="|"|="          return 'ASSIGNMENT_OPERATOR'
[-*+/%&|~!()\[\]{}'"#,\.?:;<>]                              return yytext

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* A. 下面是从词法分析器传进来的 token ,其中大部分都是换名字符串*/
%token STRING     INT   DOUBLE  FLOAT       LONG    CONST   DEFINE
%token WHILE      FOR   BREAK   CONTINUE    SWITCH  CASE DEFAULT IF ELSE DO RETURN
%token POUNDPOUND ICR   DECR    ANDAND      OROR    LS  RS LE GE EQ NE
%token MULTassign DIVassign     PLUSassign  MINUSassign MODassign
%token LSassign   RSassign ANDassign ERassign ORassign
    /* A.1 ----------------- COStream 特有关键字 ---------------*/
%token COMPOSITE  INPUT OUTPUT  STREAM    FILEREADER  FILEWRITER  ADD
%token PARAM      INIT  WORK    WINDOW    TUMBLING    SLIDING
%token SPLITJOIN  PIPELINE      SPLIT     JOIN        DUPLICATE ROUNDROBIN

/* 优先级标记,从上至下优先级从低到高排列 */
%nonassoc IF_WITHOUT_ELSE
%nonassoc ELSE

%left EOF
%left ','
%right ASSIGNMENT_OPERATOR
%left '?'
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
%right '!' '~'
%left  '.'

%start translation_unit

%% /* language grammar */
/************************************************************************/
/*              1. 文法一级入口,由下面三种文法组成                           */
/*                 1.1. declaration 声明                                 */
/*                 1.2. function_definition 函数声明                      */
/*                 1.3. composite_definition 数据流计算单元声明             */
/*************************************************************************/
prog_start: translation_unit ;
translation_unit:
          external_definition   
        | translation_unit external_definition  
        ;
external_definition:
          declaration           
        | function_definition   
        | composite_definition  
        ;
/*************************************************************************/
/*              1.1 declaration 由下面2种文法+2个基础组件组成                */
/*                      1.1.1 declaring_list                             */
/*                      1.1.2 stream_declaring_list                      */
/*                      1.1.3 array                                      */
/*                      1.1.4 initializer                                */
/*************************************************************************/
declaration:
          declaring_list ';'        
        | stream_declaring_list ';' 
        ;
declaring_list:
          type_specifier      postfix_expression     initializer_opt  
        | declaring_list 	',' postfix_expression     initializer_opt
        ;
stream_declaring_list:
          stream_type_specifier IDENTIFIER    
        | stream_declaring_list ',' IDENTIFIER
        ;
stream_type_specifier:
          STREAM '<' stream_declaration_list '>'
        ;
stream_declaration_list:
          type_specifier postfix_expression 
        | stream_declaration_list ',' type_specifier postfix_expression 
        ;
/*************************************************************************/
/*                      1.1.3 array ( int a[] )                          */
/*************************************************************************/
array_declarator:
          '[' ']'   
        | '[' exp ']' 
        | array_declarator '[' exp ']'  
        | array_declarator '[' ']'  
        ;
/*************************************************************************/
/*                      1.1.4 initializer                                */
/*************************************************************************/
initializer_opt:
          /* nothing */         
        | '=' initializer       
        ;
initializer:
          '{' initializer_list '}'      
        | '{' initializer_list ',' '}'  
        | exp                           
        ;
initializer_list:
          initializer   
        | initializer_list ',' initializer  
        ;
/*************************************************************************/
/*              1.2 function_definition 函数声明                          */
/*                      1.2.1 parameter_list                             */
/*                      1.2.1 function_body                       */
/*************************************************************************/
function_definition:
          type_specifier expression '(' ')' function_body 
        | type_specifier expression '(' parameter_list ')' function_body  
        ;
parameter_list:
          parameter_declaration   
        | parameter_list ',' parameter_declaration 
        | parameter_list '=' initializer 
        | parameter_list ',' error
        ;
parameter_declaration:
          type_specifier postfix_expression 
        ;
function_body:
          lblock rblock                   
        | lblock statement_list rblock    
        ;
statement_list:
          statement                   
        | statement_list statement    
        ;
/*************************************************************************/
/*              1.3 composite_definition 数据流计算单元声明                */
/*                      1.3.1 composite_head                             */
/*                      1.3.2 composite_body                             */
/*************************************************************************/
composite_definition
    : composite_head composite_body 
    ;
composite_head
    : COMPOSITE IDENTIFIER '(' composite_head_inout ')'   
    ;
composite_head_inout:
      /*empty*/                                                                           
    | INPUT composite_head_inout_member_list                                              
    | INPUT composite_head_inout_member_list ',' OUTPUT composite_head_inout_member_list  
    | OUTPUT composite_head_inout_member_list                                             
    | OUTPUT composite_head_inout_member_list ',' INPUT composite_head_inout_member_list  
    ;
composite_head_inout_member_list:
      composite_head_inout_member                                                         
    | composite_head_inout_member_list ',' composite_head_inout_member                    
    ;
composite_head_inout_member:
    stream_type_specifier IDENTIFIER                                                    
    ;
/*************************************************************************/
/*                      1.3.2 composite_body                             */
/*                        1.3.2.1 composite_body_param_opt               */
/*                        1.3.2.2 composite_body_declaration_list        */
/*                        1.3.2.3 composite_body_statement_list          */
/*************************************************************************/
composite_body:
          lblock composite_body_param_opt composite_body_statement_list rblock                              
        ;
composite_body_param_opt:
          /*empty*/                 
        | PARAM parameter_list ';'  
        ;
composite_body_statement_list:
          costream_composite_statement                                
        | composite_body_statement_list costream_composite_statement  
        ;
costream_composite_statement:
          composite_body_operator   
        | statement                 
        ;
/*****************************************************************************/
/*        2. composite_body_operator  composite体内的init work window等组件   */
/*             2.1   ADD operator_pipeline                                   */
/*             2.2   ADD operator_splitjoin                                  */
/*             2.3   ADD operator_default_call                               */
/*****************************************************************************/
composite_body_operator:
          operator_file_writer      
        | operator_add              
        ;
operator_file_writer:
          FILEWRITER '(' IDENTIFIER ')' '(' stringConstant ')' ';' 
        | FILEWRITER '(' IDENTIFIER ')' '(' ')' ';' 
        ;
operator_add:
          ADD operator_pipeline     
        | ADD operator_splitjoin    
        | ADD operator_default_call 
        ;
operator_pipeline:
          PIPELINE lblock  splitjoinPipeline_statement_list rblock     
        ;
splitjoinPipeline_statement_list:
          statement                                       
        | operator_add                                    
        | splitjoinPipeline_statement_list statement      
        | splitjoinPipeline_statement_list operator_add   
        ;
operator_splitjoin:
          SPLITJOIN lblock split_statement  splitjoinPipeline_statement_list  join_statement rblock     
        | SPLITJOIN lblock statement_list split_statement splitjoinPipeline_statement_list join_statement rblock  
        ;
split_statement:
          SPLIT duplicate_statement                        
        | SPLIT roundrobin_statement                       
        ;
roundrobin_statement:
          ROUNDROBIN '(' ')' ';'                            
        | ROUNDROBIN '(' argument_expression_list ')' ';'   
        ;
duplicate_statement:
          DUPLICATE '('  ')' ';'                            
        | DUPLICATE '(' exp ')'  ';'                        
        ;
join_statement:
          JOIN roundrobin_statement                         
        ;
argument_expression_list:
          exp                                               
        | argument_expression_list ',' exp                  
        ;
operator_default_call:
          IDENTIFIER  '(' ')' ';'                           
        | IDENTIFIER  '(' argument_expression_list ')' ';'  
        ;
/*************************************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement                  */
/*************************************************************************/
statement:
          labeled_statement
        | compound_statement            /* 复合类型声明  */
        | expression_statement
        | selection_statement
        | iteration_statement
        | jump_statement
        | declaration
        | error ';' 
        ;
labeled_statement:
          CASE expression ':' statement                    
        | DEFAULT ':' statement                     
        ;
compound_statement:
          lblock rblock                                     
        | lblock composite_body_statement_list rblock       
        ;
expression_statement
        : ';'
        | expression ';'  
        ;
selection_statement:
          IF '(' expression ')' costream_composite_statement   %prec IF_WITHOUT_ELSE
        | IF '(' expression ')' costream_composite_statement 
          ELSE costream_composite_statement             
        | SWITCH '(' expression ')' statement                  
        ;
iteration_statement:
          WHILE '(' expression ')' costream_composite_statement                          
        | DO  statement WHILE '(' expression ')' ';'                  
        | FOR '(' expression_statement expression_statement ')'  costream_composite_statement     
        | FOR '(' expression_statement expression_statement expression_statement ')' costream_composite_statement  
        | FOR '(' error ')' costream_composite_statement                          
        ;
jump_statement:
          CONTINUE ';'        
        | BREAK ';'           
        | RETURN ';'
        | RETURN expression ';'      
        ;
/*************************************************************************/
/*        4. expression 计算表达式头节点                        */
/*************************************************************************/

primary_expression
    : IDENTIFIER
    | NUMBER
    | stringConstant
    | '(' expression ')'
    ;

postfix_expression
    : primary_expression
    | postfix_expression '[' expression ']'
    | postfix_expression '(' ')'
    | postfix_expression '(' argument_expression_list ')'
    | postfix_expression '.' IDENTIFIER
    | postfix_expression '++'
    | postfix_expression '--'
    ;    
unary_expression
    : postfix_expression
    | '++' unary_expression
    | '--' unary_expression
    | '+' unary_expression
    | '-' unary_expression
    | '~' unary_expression
    | '!' unary_expression
    ;
exp
    : unary_expression        
    | exp '+' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '-' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '*' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '/' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '%' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '|' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '&' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '^' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp ">" exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '<' exp   { $$ = new binopNode($1,$2,$3,@2) }
    | exp '>=' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '<=' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '==' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '!=' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '||' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '&&' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '<<' exp  { $$ = new binopNode($1,$2,$3,@2) }
    | exp '>>' exp  { $$ = new binopNode($1,$2,$3,@2) }
    ;
conditional_expression
    : exp
    | exp '?' expression ':' conditional_expression
    ;    
assignment_expression
    : conditional_expression
    | unary_expression 'ASSIGNMENT_OPERATOR' assignment_expression
    ;
expression
    : assignment_expression
    | expression ',' expression
    ;

/*************************************************************************/
/*        5. basic 从词法TOKEN直接归约得到的节点,自底向上接入头部文法结构    */
/*************************************************************************/
/* 设置变量作用域相关 */
lblock: '{'  ;
rblock: '}'  ;
type_specifier
        : basic_type_name       
        | CONST basic_type_name 
        ;
basic_type_name
        : INT   
        | LONG  
        | LONG LONG 
        | FLOAT 
        | DOUBLE
        | STRING
        ;

