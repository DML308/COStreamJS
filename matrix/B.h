
#ifndef _B_
#define _B_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class B{
  public:
  B(Buffer<streamData>& B_1_Sink_2,Buffer<streamData>& Source_0_B_1):B_1_Sink_2(B_1_Sink_2),Source_0_B_1(Source_0_B_1){
    steadyScheduleCount = 8;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    B_1_Sink_2.resetTail();
    Source_0_B_1.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    B_1_Sink_2.resetTail();
    Source_0_B_1.resetHead();
  }
  private:
  Producer<streamData>B_1_Sink_2;
  Consumer<streamData>Source_0_B_1;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    Source_0_B_1.updatehead(1);
  }
  
  void pushToken(){
    B_1_Sink_2.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    B_1_Sink_2[0].x=Source_0_B_1[0].x;
    
    pushToken();
    popToken();
  }
};
#endif
