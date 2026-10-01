---
schemaVersion: 1
id: java-002
type: qa
title: Java内存区域（运行时数据区）包含哪些部分？
category: programming
subcategory: java
tags:
  - Java
  - JVM
  - 内存区域
  - 栈
  - 堆
  - MetaSpace
difficulty: medium
status: published
aliases: []
related:
  - java-001
  - java-003
created: 2026-01-10
updated: 2026-01-10
---

## 问题

Java内存区域（运行时数据区）包含哪些部分？

<!-- flip -->

## 答案

JVM运行时数据区分为以下几个部分：

1. **程序计数器（Program Counter Register）**：记录当前线程执行的字节码行号，线程私有。
2. **Java虚拟机栈（VM Stack）**：存储栈帧，每个方法调用创建一个栈帧（包含局部变量表、操作数栈、方法出口等），线程私有。
3. **本地方法栈（Native Method Stack）**：为Native方法服务，线程私有。
4. **堆（Heap）**：所有对象实例和数组都在堆上分配，线程共享，是GC主要管理的区域。
5. **方法区（Method Area）**：存储已被加载的类信息、常量、静态变量等，线程共享（JDK 8+使用元空间MetaSpace实现）。
