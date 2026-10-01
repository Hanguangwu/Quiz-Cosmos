---
schemaVersion: 1
id: java-003
type: qa
title: Java垃圾回收（GC）的常见算法有哪些？
category: programming
subcategory: java
tags:
  - Java
  - GC
  - 分代收集
  - 垃圾回收
  - G1
difficulty: medium
status: published
aliases: []
related:
  - java-001
  - java-002
created: 2026-01-10
updated: 2026-01-10
---

## 问题

Java垃圾回收（GC）的常见算法有哪些？

<!-- flip -->

## 答案

### 常见算法

1. **标记-清除（Mark-Sweep）**：先标记存活对象，再统一回收所有未标记对象。缺点是会产生内存碎片。
2. **复制（Copying）**：将内存分为两块，每次使用一块，GC时将存活对象复制到另一块，清空当前块。无碎片但浪费空间。
3. **标记-整理（Mark-Compact）**：标记存活对象后将它们向一端移动，然后清理边界外的内存。无碎片，效率较低。
4. **分代收集（Generational Collection）**：根据对象存活周期将堆分为新生代、老年代，不同代使用不同回收算法。

### 常见GC实现

Serial、Parallel Scavenge、CMS、G1（Garbage First）、ZGC等。
