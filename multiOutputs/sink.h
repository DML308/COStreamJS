
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
  sink(Buffer<streamData>& Out3,Buffer<streamData>& Out4,int steadyC,int initC):Out3(Out3),Out4(Out4){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    Out3.resetHead();
    Out4.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    Out3.resetHead();
    Out4.resetHead();
  }
  private:
  Consumer<streamData>Out3;
  Consumer<streamData>Out4;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    Out3.updatehead(1);
    Out4.updatehead(1);
  }
  
  void pushToken(){
  }
  void initVarAndState() {
  }
  void init() {
  }
  void work(){
    
    cout<<"sink work Out3[0].x = "<<Out3[0].x<<endl;
    cout<<"sink work Out4[0].x = "<<Out4[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
