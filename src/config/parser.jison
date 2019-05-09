
/* lexer */
%lex
%%

\s+                                                         /* skip whitespace */
[+-]?(0[xb])?[0-9]+(\.[0-9]+)?([Ee][+-]?[0-9]+?)?\b         return 'NUMBER'
[A-z_][0-9A-z]*                                             return 'IDENTIFIER'

[+-\\*\\/%&|~!()]     return yytext
"!"                   return '!'
"%"                   return '%'
"("                   return '('
")"                   return ')'
"PI"                  return 'PI'
"E"                   return 'E'
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
