
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
  B(Buffer<streamData>& Out,Buffer<streamData>& In,int steadyC,int initC,int size1,int size2):Out(Out),In(In),size1(size1),size2(size2){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    Out.resetTail();
    In.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    Out.resetTail();
    In.resetHead();
  }
  private:
  Producer<streamData>Out;
  Consumer<streamData>In;
  int size1;
  int size2;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    In.updatehead(1);
  }
  
  void pushToken(){
    Out.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    Out[0].x=In[0].x;
    
    pushToken();
    popToken();
  }
};
#endif
