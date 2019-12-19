
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
  start(Buffer<streamData>& start_0_test_1):start_0_test_1(start_0_test_1){
    steadyScheduleCount = 1;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    start_0_test_1.resetTail();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    start_0_test_1.resetTail();
  }
  private:
  Producer<streamData>start_0_test_1;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
  }
  
  void pushToken(){
    start_0_test_1.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"start init"<<endl;
  }
  
  void work(){
    
    start_0_test_1[0].x=1;
    cout<<"start work start_0_test_1[0].x = "<<start_0_test_1[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
