---
schemaVersion: 1
id: java-001
type: qa
title: JVM组成部分是什么？
category: programming
subcategory: java
tags:
  - Java
  - JVM
  - 类加载器
  - 字节码
  - 执行引擎
difficulty: easy
status: published
aliases: []
related:
  - java-002
  - java-003
created: 2026-01-10
updated: 2026-01-10
---

## 问题

JVM组成部分是什么？

<!-- flip -->

## 答案

JVM可以分为**类加载器**、**运行时数据区**、**执行引擎**、**本地方法接口**和**本地方法库**五个部分组成。

### 运行流程

JVM通过**类加载器将字节码（.class文件）加载到内存并生成class对象**，在**运行时数据区（JVM内存管理区域）**中，使用特定的**执行引擎将字节码翻译成底层系统指令**，再交给CPU执行，这个过程需要**调用其他语言的本地接口（JNI）**实现整个程序的功能。
