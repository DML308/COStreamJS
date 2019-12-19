
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
void thread_0_fun()
{
  masterSync(4);
  fun fun_2_obj(fun_2_sink_4,test_1_fun_2);
  fun fun_3_obj(fun_3_sink_4,test_1_fun_3);
  char stage[4] = {
    1,0,0,0
  };
  
  for(int _stageNum = 0; _stageNum < 4; _stageNum++){
    if(2 == _stageNum){
      fun_2_obj.runInitScheduleWork();
      fun_3_obj.runInitScheduleWork();
    }
    
    masterSync(4);
    
  }
  
  for(int _stageNum = 4; _stageNum < 2*4+MAX_ITER-1; _stageNum++){
    if(stage[2]){
      fun_2_obj.runSteadyScheduleWork();
      fun_3_obj.runSteadyScheduleWork();
    }
    for(int index=3; index>=1; --index){
      stage[index] = stage[index-1];
    }
    if(_stageNum == MAX_ITER - 1 + 4){
      stage[0] = 0;
    }
    
    masterSync(4);
    
  }
}

