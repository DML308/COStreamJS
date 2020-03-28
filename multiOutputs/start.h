
#ifndef _start_
#define _start_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class start{
  public:
  start(Buffer<streamData>& Data,int steadyC,int initC):Data(Data){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    Data.resetTail();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    Data.resetTail();
  }
  private:
  Producer<streamData>Data;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
  }
  
  void pushToken(){
    Data.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"start init"<<endl;
  }
  
  void work(){
    
    Data[0].x=1;
    cout<<"start work Data[0].x = "<<Data[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
