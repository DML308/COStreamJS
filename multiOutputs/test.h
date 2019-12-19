
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
  test(Buffer<streamData>& test_1_fun_2,Buffer<streamData>& test_1_fun_3,Buffer<streamData>& start_0_test_1):test_1_fun_2(test_1_fun_2),test_1_fun_3(test_1_fun_3),start_0_test_1(start_0_test_1){
    steadyScheduleCount = 1;
    initScheduleCount = 0;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    test_1_fun_2.resetTail();
    test_1_fun_3.resetTail();
    start_0_test_1.resetHead();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    test_1_fun_2.resetTail();
    test_1_fun_3.resetTail();
    start_0_test_1.resetHead();
  }
  private:
  Producer<streamData>test_1_fun_2;
  Producer<streamData>test_1_fun_3;
  Consumer<streamData>start_0_test_1;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
    start_0_test_1.updatehead(1);
  }
  
  void pushToken(){
    test_1_fun_2.updatetail(1);
    test_1_fun_3.updatetail(1);
  }
  void initVarAndState() {
  }
  void init() {
    cout<<"test init"<<endl;
  }
  
  void work(){
    
    test_1_fun_2[0].x=start_0_test_1[0].x+1;
    test_1_fun_3[0].x=start_0_test_1[0].x+2;
    cout<<"test work test_1_fun_2[0].x = ";
    cout<<test_1_fun_2[0].x<<endl;
    
    pushToken();
    popToken();
  }
};
#endif
