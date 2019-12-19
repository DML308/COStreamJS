
#ifndef _Sink_
#define _Sink_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class Sink{
  public:
  Sink(Buffer<streamData>& B_1_Sink_2):B_1_Sink_2(B_1_Sink_2){
    steadyScheduleCount = 8;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    B_1_Sink_2.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    B_1_Sink_2.resetHead();
  }
  private:
  Consumer<streamData>B_1_Sink_2;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    B_1_Sink_2.updatehead(1);
  }
  
  void pushToken(){
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    cout<<B_1_Sink_2[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
