
#ifndef _Source_
#define _Source_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class Source{
  public:
  Source(Buffer<streamData>& Source_0_B_1):Source_0_B_1(Source_0_B_1){
    steadyScheduleCount = 1;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    Source_0_B_1.resetTail();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    Source_0_B_1.resetTail();
  }
  private:
  Producer<streamData>Source_0_B_1;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  int i;
  
  void popToken(){
  }
  
  void pushToken(){
    Source_0_B_1.updatetail(8);
  }
  void initVarAndState() {
  }
  void init() {
    i=0;
    if(1){
      cout<<1<<endl;
    }
    
  }
  
  void work(){
    
    for(i=0;i<8;i++){
      Source_0_B_1[i].x=aaa[i];
    }
    
    
    pushToken();
    popToken();
  }
};
#endif
