var str1 =`
struct source{
	int buffer[workLen];
};
RingBuffer<source> ringBuffer(1024,sizeof(source));
int workExecuteTimes=0;

void* thread_io_fun_start(void *arg)
{
	source iobuff;
	ifstream inSource("input.bin",ios::binary);
	for(int i=0;i<workExecuteTimes;i++)
	{
		inSource.read((char*)iobuff.buffer,sizeof(int)* workLen);
		while(!ringBuffer.write((char*)&iobuff));
	}
	return 0;
}`
var str2 = `
ifstream in("input.bin",ios::binary);
in.seekg(0,ios::end);
int length = in.tellg();
in.seekg(0,ios::beg);
workExecuteTimes=length/(sizeof(int)*workLen);
MAX_ITER = (workExecuteTimes-initworkcount)/steadyworkcount;
`
var str3=`
if(!ringBuffer.Initialize())
{
    return -1;
}
pthread_t th;
int ret = pthread_create (&th, NULL, thread_io_fun_start, (void*)NULL);
`
var str4 = `
ret = pthread_join(th,NULL);
if(ret!=0)
{
    cout<<"join error"<<endl;
    return -1;
}
`
export function getIOHandlerStrings(workLen,initworkcount,steadyworkcount){
    str1 = str1.replace(/workLen/g, workLen)
	str1 = str1.replace(/initworkcount/, initworkcount).replace(/steadyworkcount/, steadyworkcount)
    str2 = str2.replace(/initworkcount/, initworkcount).replace(/steadyworkcount/, steadyworkcount)
    str2 = str2.replace(/workLen/g, workLen)
    return [str1,str2,str3,str4]
}

