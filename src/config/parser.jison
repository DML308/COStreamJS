
/* lexer */
%lex
%%

\s+                                                         /* skip whitespace */
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

[a-zA-Z_][a-zA-Z0-9_]*                                      return 'IDENTIFIER'

"##"|"++"|"--"|">>"|">>"|"<="|">="|"=="|"!="|"&&"|"||"      return yytext
"*="|"/="|"+="|"-="|"<<="|">>="|"&="|"^="|"|="              return 'ASSIGNMENT_OPERATOR'
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
translation_unit
    : external_declaration                  { $$ = [$1] }
    | translation_unit external_declaration { $$.push($2) }
    ;

external_declaration
    : function_definition
    | declaration
    ;
/*************************************************************************/
/*              1.1 declaration 由下面2种文法+2个基础组件组成                */
/*                      1.1.1 declaring_list                             */
/*                      1.1.2 stream_declaring_list                      */
/*                      1.1.3 initializer                                */
/*************************************************************************/ 
declaration
    : declaring_list ';'                          { $$ = $1 }
    ;
declaring_list:
      type_specifier   init_declarator_list       { $$ = new declareNode(mergeLoc(@1,@2),$1,$2) }
    ;
init_declarator_list
    : init_declarator                             { $$ = [$1] }
    | init_declarator_list ',' init_declarator    { $$.push($3) }
    ;

init_declarator
    : declarator                                  { $$ = $1      }
    | declarator '=' initializer                  { $$ = new declarator(mergeLoc(@1,@3),$1,$2);$$.initializer = $3 }
    ;

declarator
    : IDENTIFIER                                  { $$ = $1                                                 }
    | '(' declarator ')'                          { error("暂未支持该种declarator的写法")                      }
    | declarator '[' constant_expression ']'      { $$ = new declarator(mergeLoc(@1,@4),$1,$2,$3,$4)        }
    | declarator '[' ']'                          { $$ = new declarator(mergeLoc(@1,@3),$1,$2,undefined,$3) }
    | declarator '(' parameter_type_list ')'      { $$ = new declarator(mergeLoc(@1,@4),$1,$2,$3,$4)        }
    | declarator '(' identifier_list ')'          { $$ = new declarator(mergeLoc(@1,@4),$1,$2,$3,$4)        }
    | declarator '(' ')'                          { $$ = new declarator(mergeLoc(@1,@3),$1,$2,undefined,$3) }
    ;
identifier_list
    : IDENTIFIER                                  { $$ = $1 }
    | identifier_list ',' IDENTIFIER              { $$ = $1 instanceof Array ? $1.concat($3) : [$1,$3] }
    ;    
/*************************************************************************/
/*                      1.1.3 initializer                                */
/*************************************************************************/
initializer
    : assignment_expression
    | '{' initializer_list '}'                    { $$ = $2 }
    | '{' initializer_list ',' '}'                { $$ = $2 }
    ;

initializer_list
    : initializer                                 { $$ = $1 }
    | initializer_list ',' initializer            { $$ = $1 instanceof Array ? $1.concat($3) : [$1,$3]}
    ;
/*************************************************************************/
/*              1.2 function_definition 函数声明                          */
/*                      1.2.1 parameter_type_list                        */
/*                      1.2.1 function_body                              */
/*************************************************************************/
function_definition
    : type_specifier declarator compound_statement { $$ = new function_definition(mergeLoc(@1,@3),$1,$2,$3) }
    ;

parameter_type_list
    : parameter_declaration                         { $$ = [$1]   }
    | parameter_type_list ',' parameter_declaration { $$.push($3) }
    ;

parameter_declaration
    : type_specifier declarator         { $$ = new parameter_declaration(mergeLoc(@1,@2),$1,$2) }
    ;
/*************************************************************************/
/*        3. statement 花括号内以';'结尾的结构是statement                    */
/*************************************************************************/    
statement
    : labeled_statement
    | compound_statement
    | expression_statement
    | selection_statement
    | iteration_statement
    | jump_statement
    | declaration
    ;
labeled_statement
    : CASE constant_expression ':' statement    { $$ = new labeled_statement(mergeLoc(@1,@4),$1,$2,$3,$4)}
    | DEFAULT ':' statement                     { $$ = new labeled_statement(mergeLoc(@1,@3),$1,undefined,$2,$3)}
    ;
compound_statement
    : '{' '}'                  { $$ = new blockNode(mergeLoc(@1,@2),$1,undefined,$2) } 
    | '{' statement_list '}'   { $$ = new blockNode(mergeLoc(@1,@3),$1,$2,$3) }
    ;
statement_list
    : statement                { $$ = $1 ? [$1] : []   }
    | statement_list statement { if($2) $$.push($2)    }
    ;
expression_statement
    : ';'                       { $$ = undefined }
    | expression ';'            { $$ = $1 }
    ;
selection_statement
    : IF '(' expression ')' statement %prec IF_WITHOUT_ELSE 
      { $$ = new selection_statement(mergeLoc(@1,@5),$1,$2,$3,$4,$5)        }
    | IF '(' expression ')' statement ELSE statement
      { $$ = new selection_statement(mergeLoc(@1,@5),$1,$2,$3,$4,$5,$6,$7)  }
    | SWITCH '(' expression ')' statement
      { $$ = new selection_statement(mergeLoc(@1,@5),$1,$2,$3,$4,$5)        }
    ;
iteration_statement
    : WHILE '(' expression ')' statement 
      { $$ = new whileNode(mergeLoc(@1,@5),$3,$5) }
    | DO statement WHILE '(' expression ')' ';' 
      { $$ = new doNode(mergeLoc(@1,@7),$5,$2)    }
    | FOR '(' expression_statement expression_statement ')' statement
      { $$ = new forNode(mergeLoc(@1,@6),$3,$4,undefined,$6)    }
    | FOR '(' expression_statement expression_statement expression ')' statement
      { $$ = new forNode(mergeLoc(@1,@6),$3,$4,$5,$7) }
    ;
jump_statement
    : CONTINUE ';'          { $$ = new jump_statement(@1,$1) }
    | BREAK ';'             { $$ = new jump_statement(@1,$1) }
    | RETURN ';'            { $$ = new jump_statement(@1,$1) }
    | RETURN expression ';' { $$ = new jump_statement(@1,$1,$2) }
    ;    

/*************************************************************************/
/*        4. expression 计算表达式头节点                                    */
/*************************************************************************/
primary_expression
    : IDENTIFIER            
    | 'NUMBER'              { $$ = new constantNode(@1,$1) }
    | STRING_LITERAL        { $$ = new constantNode(@1,$1) }
    | '(' expression ')'    { $$ = new parenNode(@1,$2)    }
    ;

postfix_expression
    : primary_expression                          
    | postfix_expression '[' expression ']'                 { $$ = new arrayNode(@1,$1,$3)    }
    | postfix_expression '(' ')'
    | postfix_expression '(' argument_expression_list ')'   { $$ = new callNode(@1,$1,$3)     }
    | postfix_expression '.' IDENTIFIER                     { $$ = new binopNode(@1,$1,$2,$3) }
    | postfix_expression '++'                               { $$ = new unaryNode(@1,$1,$2)    }
    | postfix_expression '--'                               { $$ = new unaryNode(@1,$1,$2)    }
    ;

argument_expression_list
    : assignment_expression                                 { $$ = [$1]   }
    | argument_expression_list ',' assignment_expression    { $$.push($3) }
    ;

unary_expression
    : postfix_expression                
    | '++' unary_expression             { $$ = new unaryNode(@1,$1,$2) }
    | '--' unary_expression             { $$ = new unaryNode(@1,$1,$2) }
    | unary_operator unary_expression   { $$ = new unaryNode(@1,$1,$2) }
    ;

unary_operator
    : '+'
    | '-'
    | '~'
    | '!'
    ;

exp
    : unary_expression
    | exp "*" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "/" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "+" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "-" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "%" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "^" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "|" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "&" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "<" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp ">" exp   { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "<=" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp ">=" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "==" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "!=" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "<<" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp ">>" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "||" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    | exp "&&" exp  { $$ = new binopNode(@2,$1,$2,$3) }
    ;

conditional_expression
    : exp
    | exp '?' expression ':' conditional_expression { $$ = new ternaryNode(mergeLoc(@1,@5),$1,$3,$5) }
    ;

assignment_expression
    : conditional_expression
    | unary_expression assignment_operator assignment_expression    { $$ = new binopNode(mergeLoc(@1,@3),$1,$2,$3) }
    ;
assignment_operator:
      '='
    | ASSIGNMENT_OPERATOR
    ;
expression
    : assignment_expression
    | expression ',' assignment_expression {
         if($1 instanceof Array) $$.push($3)
         else if($1 instanceof expNode) $$ = [$1,$3]
         else error("error at `expression ','` ") 
      }
    ;

constant_expression
    : conditional_expression
    ;

/*************************************************************************/
/*        5. basic 从词法TOKEN直接归约得到的节点,自底向上接入头部文法结构        */
/*************************************************************************/
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