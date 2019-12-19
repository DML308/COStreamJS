
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
  masterSync(3);
  B B_1_obj(B_1_Sink_2,Source_0_B_1);
  char stage[3] = {
    1,0,0
  };
  
  for(int _stageNum = 0; _stageNum < 3; _stageNum++){
    if(1 == _stageNum){
      B_1_obj.runInitScheduleWork();
    }
    
    masterSync(3);
    
  }
  
  for(int _stageNum = 3; _stageNum < 2*3+MAX_ITER-1; _stageNum++){
    if(stage[1]){
      B_1_obj.runSteadyScheduleWork();
    }
    for(int index=2; index>=1; --index){
      stage[index] = stage[index-1];
    }
    if(_stageNum == MAX_ITER - 1 + 3){
      stage[0] = 0;
    }
    
    masterSync(3);
    
  }
}

