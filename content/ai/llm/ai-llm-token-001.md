---
schemaVersion: 1
id: ai-llm-token-001
type: qa
title: 什么是 Token？LLM 的分词如何影响上下文长度与计费？
category: ai
subcategory: llm
tags:
  - LLM
  - Token
  - 分词
  - BPE
  - 上下文窗口
  - API 计费
difficulty: easy
status: published
aliases: []
related: []
created: 2026-01-10
updated: 2026-01-10
---

## 问题

什么是 Token？LLM 的分词如何影响上下文长度与计费？

<!-- flip -->

## 答案

Token 是模型真正读写的计量单位：文本先被 tokenizer 切成 token id 序列，模型再对这些 id 做概率预测。经验上英文约 $1\ \text{token} \approx 4\ \text{chars}$，中文则常常 1 个汉字就要 1～2 个 token。

### 长度对照

| 文本 | 估算 token 数 | 说明 |
| --- | --- | --- |
| `hello` | 1 | 常见英文词整体落在词表内 |
| `Tokenization` | 2～3 | 高频后缀被合并为独立 token |
| `分词` | 2 | 常用汉字通常逐字成 token |

### 分词示例

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")
print(len(enc.encode("进程和线程的区别是什么？")))
```

### 计费公式

$$
C = \frac{T_{\text{in}} + T_{\text{out}}}{10^{6}} \times P
$$

其中 $T_{\text{in}}$、$T_{\text{out}}$ 分别是输入与输出 token 数，$P$ 是每百万 token 的单价。

### 实践清单

- [x] 输入与输出 token 一起占用上下文窗口
- [x] 输出长度受 `max_tokens` 上限约束
- [ ] 预填超长历史会推高成本，需要摘要或检索压缩

### 补充要点

- 主流分词算法是 BPE 及其变体（byte-level BPE、WordPiece、Unigram）。
- 词表从数万到数十万不等；不同模型的 tokenizer 不同，同一段文本的 token 数可能不同。

> 提示：token 数既不等于单词数，也不等于字符数，评估成本时以模型自带的 tokenizer 为准。
