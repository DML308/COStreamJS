
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
  Sink(Buffer<streamData>& S,int steadyC,int initC):S(S){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    S.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    S.resetHead();
  }
  private:
  Consumer<streamData>S;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    S.updatehead(1);
  }
  
  void pushToken(){
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    pushToken();
    popToken();
  }
  
};
#endif
