
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
  fun(Buffer<streamData>& FunOut,Buffer<streamData>& FunIn,int steadyC,int initC):FunOut(FunOut),FunIn(FunIn){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    FunOut.resetTail();
    FunIn.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    FunOut.resetTail();
    FunIn.resetHead();
  }
  private:
  Producer<streamData>FunOut;
  Consumer<streamData>FunIn;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    FunIn.updatehead(1);
  }
  
  void pushToken(){
    FunOut.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"fun init"<<endl;
  }
  
  void work(){
    
    FunOut[0].x=FunIn[0].x*2;
    cout<<"fun work FunOut[0].x = ";
    cout<<FunOut[0].x<<endl;
    
    pushToken();
    popToken();
  }
  
};
#endif
