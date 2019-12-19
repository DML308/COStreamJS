
#ifndef _fun_
#define _fun_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class fun{
  public:
  fun(Buffer<streamData>& fun_2_sink_4,Buffer<streamData>& test_1_fun_2):fun_2_sink_4(fun_2_sink_4),test_1_fun_2(test_1_fun_2){
    steadyScheduleCount = 1;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    fun_2_sink_4.resetTail();
    test_1_fun_2.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    fun_2_sink_4.resetTail();
    test_1_fun_2.resetHead();
  }
  private:
  Producer<streamData>fun_2_sink_4;
  Consumer<streamData>test_1_fun_2;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    test_1_fun_2.updatehead(1);
  }
  
  void pushToken(){
    fun_2_sink_4.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"fun init"<<endl;
  }
  
  void work(){
    
    fun_2_sink_4[0].x=test_1_fun_2[0].x*2;
    cout<<"fun work fun_2_sink_4[0].x = ";
    cout<<fun_2_sink_4[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
