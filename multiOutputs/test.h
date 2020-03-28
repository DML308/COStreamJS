
#ifndef _test_
#define _test_
#include <string>
#include <iostream>
#include "Buffer.h"
#include "Consumer.h"
#include "Producer.h"
#include "Global.h"
#include "GlobalVar.h"
using namespace std;
class test{
  public:
  test(Buffer<streamData>& Out1,Buffer<streamData>& Out2,Buffer<streamData>& In1,int steadyC,int initC):Out1(Out1),Out2(Out2),In1(In1){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    Out1.resetTail();
    Out2.resetTail();
    In1.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    Out1.resetTail();
    Out2.resetTail();
    In1.resetHead();
  }
  private:
  Producer<streamData>Out1;
  Producer<streamData>Out2;
  Consumer<streamData>In1;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    In1.updatehead(1);
  }
  
  void pushToken(){
    Out1.updatetail(1);
    Out2.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"test init"<<endl;
  }
  
  void work(){
    
    Out1[0].x=In1[0].x+1;
    Out2[0].x=In1[0].x+2;
    cout<<"test work Out1[0].x = ";
    cout<<Out1[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
