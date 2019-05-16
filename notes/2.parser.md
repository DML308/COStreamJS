## 故意把 '=' 和其它 ASSIGNMENT_OPERATOR 分开
是因为在 int i = 1中只能使用 '=', 这样做是为了不引起语义冲突
## for(int i=0;;) => for(i=0;;)
这里暂不支持 for 里声明变量
