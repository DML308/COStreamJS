
PROGRAM := a.out
SOURCES := $(wildcard ./*.cpp)
SOURCES += $(wildcard ./src/*.cpp)
OBJS    := $(patsubst %.cpp,%.o,$(SOURCES))
CXX     := g++
CPPFLAGS := -ggdb -Wall -std=c++11
INCLUDE := -I .
LIB     := -lpthread -ldl

.PHONY: clean install
$(PROGRAM): $(OBJS)
	$(CXX) -o $@ $^ $(LIB) $(CFLAGS)
%.o: %.c
	$(CXX) -o $@ -c $< $(CPPFLAGS) $(INCLUDE)
clean:
	rm -f $(OBJS) $(PROGRAM)
install: $(PROGRAM)
	cp $(PROGRAM) ./bin/
    