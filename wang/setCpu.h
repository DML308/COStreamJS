#ifndef _SET_CPU_H_
#define _SET_CPU_H_
#include <sched.h>
#include <sys/types.h>
#include <iostream>
#include <unistd.h> //getpid()
#include <sys/syscall.h>
using namespace std;

#if __linux__
#define gettid() syscall(__NR_gettid)
#endif

int set_cpu(int i, pthread_t t);

#endif