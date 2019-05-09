
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

[-*+/%&|~!()\[\]{}'"#,\.?:;=<>]                             return yytext
"##"|"++"|"--"|">>"|">>"|"<="|">="|"=="|"!="|"&&"|"||"|"*="|"/="|"+="|"-="|"<<="|">>="|"&="|"^="|"|="    return yytext

<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%left '+' '-'
%left '*' '/'
%left '^'
%right '!'
%right '%'
%left UMINUS

%start expressions

%% /* language grammar */

expressions
    : e EOF
        { return $1; }
    ;

e
    : e '+' e
        { $$ = { value: $1.value+$3.value }; $$.left = $1; $$.op = '+'; $$.right = $3;console.log(@3)}
    | e '-' e
        { $$ = { value: $1.value-$3.value }; $$.left = $1; $$.op = '-'; $$.right = $3;console.log(@1)}
    |e '*' e
        { $$ = { value: $1.value*$3.value }; $$.left = $1; $$.op = '*'; $$.right = $3;console.log(@1)}
    |e '/' e
        { $$ = { value: $1.value/$3.value }; $$.left = $1; $$.op = '/'; $$.right = $3;console.log(@1)}
    | NUMBER 
        { $$ = { value: Number($1)}; line(@1,$1) }
    | IDENTIFIER
        { $$ = { value: String($1)}; line(@1,$1) }
    ;
