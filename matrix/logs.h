
/**
 * 该文件的作用: 
 * 1. 实现变参的 print 和 println 函数, 例如调用 print(1,2.2); print("name: ",value);
 * 2. 统一解决多线程 cout 输出 log 信息错位的问题. 将数据存入string logs[100]中;
 */
#ifndef __LOGS__
#define __LOGS__

#include<iostream>
#include <sstream>

using namespace std;

// 参考链接 https://elloop.github.io/c++/2015-11-28/never-proficient-cpp-vaargs
// 函数模板递归出口
template <typename T>
string gen_string(T t) {
    stringstream s;
    s << t;
    return s.str(); 
}

template <typename T, typename ... Args>
string gen_string(T t, Args... args) {
    stringstream ss;
    string s;
    ss << t;
    s = ss.str() + gen_string(args...);  
    return s;
}

#define DEBUG
#ifndef DEBUG// 直接输出至控制台
    template <typename ... Args>
    void print(Args... args) {
        cout<<gen_string(args...);
    }
    template <typename ... Args>
    void println(Args... args) {
        cout<<gen_string(args...)<<endl;
    }
    void end(){

    }

#else // 先缓存至队列, 最后再输出至控制台
    extern int logs_length;
    extern string logs[100];
    template <typename ... Args>
    void print(Args... args) {
        logs[logs_length++] = gen_string(args...);
    }
    template <typename ... Args>
    void println(Args... args) {
        logs[logs_length++] = gen_string(args...) + "\n";
    }
    void end(){
        for(int i=0;i<logs_length;i++){
            cout<<logs[i];
        }
    }
#endif

#endif