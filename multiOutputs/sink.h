
#ifndef _sink_
#define _sink_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class sink{
  public:
  sink(Buffer<streamData>& fun_2_sink_4,Buffer<streamData>& fun_3_sink_4):fun_2_sink_4(fun_2_sink_4),fun_3_sink_4(fun_3_sink_4){
    steadyScheduleCount = 1;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    fun_2_sink_4.resetHead();
    fun_3_sink_4.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    fun_2_sink_4.resetHead();
    fun_3_sink_4.resetHead();
  }
  private:
  Consumer<streamData>fun_2_sink_4;
  Consumer<streamData>fun_3_sink_4;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    fun_2_sink_4.updatehead(1);
    fun_3_sink_4.updatehead(1);
  }
  
  void pushToken(){
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    cout<<"sink work fun_2_sink_4[0].x = "<<fun_2_sink_4[0].x<<endl;
    cout<<"sink work fun_3_sink_4[0].x = "<<fun_3_sink_4[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
