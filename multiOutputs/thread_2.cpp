
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
void thread_2_fun()
{
  workerSync(2);
  test test_1_obj(test_1_fun_2,test_1_fun_3,start_0_test_1,1,0);
  char stage[4] = {
    1,0,0,0
  };
  
  for(int _stageNum = 0; _stageNum < 4; _stageNum++){
    if(1 == _stageNum){
      test_1_obj.runInitScheduleWork();
    }
    
    workerSync(2);
    
  }
  
  for(int _stageNum = 4; _stageNum < 2*4+MAX_ITER-1; _stageNum++){
    if(stage[1]){
      test_1_obj.runSteadyScheduleWork();
    }
    for(int index=3; index>=1; --index){
      stage[index] = stage[index-1];
    }
    if(_stageNum == MAX_ITER - 1 + 4){
      stage[0] = 0;
    }
    
    workerSync(2);
    
  }
}

