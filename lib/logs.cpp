#include<iostream>
#include <sstream>

using namespace std;

// 参考链接 https://elloop.github.io/c++/2015-11-28/never-proficient-cpp-vaargs
// 函数模板递归出口
template <typename T>
string print(T t) {
    stringstream s;
    s << t;
    return s.str(); 
}

template <typename T, typename ... Args>
string print(T t, Args... args) {
    stringstream ss;
    string s;
    ss << t;
    s = ss.str() + print(args...);  
    return s;
}





int main(){
    stringstream s,s2;
    cout<< print(1,2.2, " 345","6\n","7");
}