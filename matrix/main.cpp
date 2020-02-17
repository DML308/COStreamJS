
#include <iostream>
#include <fstream>
#include <stdlib.h>
#include <pthread.h>
#include "setCpu.h"
#include "lock_free_barrier.h"	//包含barrier函数
#include "Global.h"
#include "GlobalVar.h"
#include "RingBuffer.h"
using namespace std;
int MAX_ITER=1;//默认的执行次数是1



extern void thread_0_fun();
extern void thread_1_fun();
extern void thread_2_fun();

pthread_t tid[3];

void* thread_1_fun_start(void *)
{
  set_cpu(1, tid[1]);
  thread_1_fun();
  return 0;
}


void* thread_2_fun_start(void *)
{
  set_cpu(2, tid[2]);
  thread_2_fun();
  return 0;
}



int main(int argc,char **argv){
  initGlobalVar();
  void setRunIterCount(int,char**);
  setRunIterCount(argc,argv);
  
  set_cpu(0,tid[0]);
  allocBarrier(3);
  
  pthread_create (&tid[1], NULL, thread_1_fun_start, (void*)NULL);
  pthread_create (&tid[2], NULL, thread_2_fun_start, (void*)NULL);
  
  
  thread_0_fun();
  
  return 0;
}
//设置运行次数
void setRunIterCount(int argc,char **argv)
{
  int oc;
  while((oc=getopt(argc,argv,"i:"))!=-1)
  {
    switch(oc)
    {
      case 'i':
      MAX_ITER=atoi(optarg);
      break;
    }
  }
}

