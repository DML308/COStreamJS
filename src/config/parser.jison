
/* lexer */
%lex
%%

\s+                                                         /* skip whitespace */
[+-]?(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b         return 'NUMBER'
[A-z_][0-9A-z]*                                             return 'IDENTIFIER'

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

[-*+/%&|~!()\[\]{}'"#,\.?:;<>]                              return yytext
"##"|"++"|"--"|">>"|">>"|"<="|">="|"=="|"!="|"&&"|"||"      return yytext
"="|"*="|"/="|"+="|"-="|"<<="|">>="|"&="|"^="|"|="          return 'ASSIGNMENT_OPERATOR'

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

%right ASSIGNMENT_OPERATOR
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
%right plusOrMinus
%right prefixIncOrDec
%left  '.'
%left  arrayIndex
%left  functionCall 
%left  suffixIncOrDec

%start expressions

%% /* language grammar */
/************************************************************************/
/*              1. 文法一级入口,由下面三种文法组成                           */
/*                 1.1. declaration 声明                                 */
/*                 1.2. function.definition 函数声明                      */
/*                 1.3. composite.definition 数据流计算单元声明             */
/*************************************************************************/
/*************************************************************************/
/*        4. exp 计算表达式头节点                        */
/*************************************************************************/
expressions
    : exp EOF
        { return $1; }
    ;

exp
    : exp '+' exp
        { $$ = { value: $1.value+$3.value }; $$.left = $1; $$.op = '+'; $$.right = $3;console.log(@3)}
    | exp '-' exp
        { $$ = { value: $1.value-$3.value }; $$.left = $1; $$.op = '-'; $$.right = $3;console.log(@1)}
    |exp '*' exp
        { $$ = { value: $1.value*$3.value }; $$.left = $1; $$.op = '*'; $$.right = $3;console.log(@1)}
    |exp '/' exp
        { $$ = { value: $1.value/$3.value }; $$.left = $1; $$.op = '/'; $$.right = $3;console.log(@1)}
    | NUMBER 
        { $$ = { value: Number($1)}; line(@1,$1) }
    | IDENTIFIER
        { $$ = { value: String($1)}; line(@1,$1) }
    | INT { $$ = { value: $1 }}
    | exp 'ASSIGNMENT_OPERATOR' e     {  console.log($2); $$ = {} }
    ;
