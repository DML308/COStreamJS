
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
  Source(Buffer<streamData>& S,int steadyC,int initC):S(S){
    steadyScheduleCount = steadyC;
    initScheduleCount = initC;
  }
  
  void runInitScheduleWork() {
    initVarAndState();
    init();
    for(int i=0;i<initScheduleCount;i++){
      work();
    }
    S.resetTail();
  }
  
  void runSteadyScheduleWork() {
    for(int i=0;i<steadyScheduleCount;i++){
      work();
    }
    S.resetTail();
  }
  private:
  Producer<streamData>S;
  int steadyScheduleCount;	//稳态时一次迭代的执行次数
  int initScheduleCount;
  
  void popToken(){
  }
  
  void pushToken(){
    S.updatetail(8);
  }
  void initVarAndState() {
  }
  void init() {
    if(1){
      cout<<1<<endl;
    }
    
  }
  
  void work(){
    
    int i;
    for(i=0;i<8;i++){
      S[i].x=aaa[i];
    }
    
    
    pushToken();
    popToken();
  }
  
};
#endif
