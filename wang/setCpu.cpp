/**
 * 该文件(setCpu)作用是将任务绑定至线程
 * - 在 linux 平台上使用原生提供的 CPU_SET 以及 sched_setaffinity
 * - 在 MacOS 平台上使用其它 api 来实现相同接口, 参考https://yyshen.github.io/2015/01/18/binding_threads_to_cores_osx.html
 * - 在 Windows 平台上还未尝试执行这些代码生成的结果
 */
#if __linux__   // 下面是 linux 平台实现的 set_cpu
#include "setCpu.h"
#include <iostream>
int set_cpu(int i, pthread_t t)
{
	cpu_set_t mask;
	CPU_ZERO(&mask);
	CPU_SET(i, &mask);
	if (-1 == sched_setaffinity(gettid(), sizeof(&mask), &mask))
	{
		cout << "error\t" << i << endl;
		return -1;
	}
	return 0;
}
#elif __APPLE__ // 下面是对应 MacOS 平台实现的 set_cpu
#define SYSCTL_CORE_COUNT "machdep.cpu.core_count"
#include <iostream>
#include <stdio.h>
#include <cmath>
#include <mach/thread_policy.h>
#include <mach/thread_act.h>
#include <sys/sysctl.h>
using namespace std;
typedef struct cpu_set{
	uint32_t count;
}cpu_set_t;

static inline void CPU_ZERO(cpu_set_t *cs) { cs->count = 0; }

static inline void CPU_SET(int num, cpu_set_t *cs) { cs->count |= (1 << num); }

static inline int CPU_ISSET(int num, cpu_set_t *cs) { return (cs->count & (1 << num)); }

int pthread_setaffinity_np(pthread_t thread, size_t cpu_size,cpu_set_t *cpu_set){
	thread_port_t mach_thread;
	int core = 0;
	for (core = 0; core < 8 * cpu_size; core++)
	{
		if (CPU_ISSET(core, cpu_set))
			break;
	}
	printf("binding to core %d\n", core);
	thread_affinity_policy_data_t policy = {core};
	mach_thread = pthread_mach_thread_np(thread);
	thread_policy_set(mach_thread, THREAD_AFFINITY_POLICY,(thread_policy_t)&policy, 1);
	return 0;
}

int set_cpu(int i, pthread_t t)
{
	cpu_set_t mask;
	CPU_ZERO(&mask);
	CPU_SET(i, &mask);
	if (-1 == pthread_setaffinity_np(t, sizeof(&mask), &mask))
	{
		cout << "error\t" << i << endl;
		return -1;
	}
	return 0;
}

#elif _WIN32 // 下面是 Windows 平台的 setCpu
int set_cpu(int i, pthread_t t){
	cout << "代码生成结果暂未支持 windows"<<endl;
	return 0;
}
#endif