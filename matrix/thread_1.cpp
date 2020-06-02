
/*该文件定义各thread的入口函数，在函数内部完成软件流水迭代*/
#include "Buffer.h"
#include "Producer.h"
#include "Consumer.h"
#include "Global.h"
#include "AllActorHeader.h"	//包含所有actor的头文件
#include "lock_free_barrier.h"	//包含barrier函数
#include "rdtsc.h"
#include <fstream>
extern int MAX_ITER;
void thread_1_fun()
{
  workerSync(1);
  Sink Sink_1_obj(Source_0_Sink_1,1,0);
  char stage[2] = {
    1,0
  };
  
  for(int _stageNum = 0; _stageNum < 2; _stageNum++){
    if(1 == _stageNum){
      Sink_1_obj.runInitScheduleWork();
    }
    
    workerSync(1);
    
  }
  
  for(int _stageNum = 2; _stageNum < 2*2+MAX_ITER-1; _stageNum++){
    if(stage[1]){
      Sink_1_obj.runSteadyScheduleWork();
    }
    for(int index=1; index>=1; --index){
      stage[index] = stage[index-1];
    }
    if(_stageNum == MAX_ITER - 1 + 2){
      stage[0] = 0;
    }
    
    workerSync(1);
    
  }
}

