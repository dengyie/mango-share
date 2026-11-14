---
title: "HashMap、HashTable 与 ConcurrentHashMap 对比"
date: 2024-10-08
description: "深入剖析三种 Map 在线程安全、性能、null 处理等方面的关键区别与适用场景。"
tags: ["java", "collections", "concurrency"]
---
在 Java 中，`HashMap`、`Hashtable` 和 `ConcurrentHashMap` 是三种常用的哈希表实现。它们都基于键值对存储数据，使用哈希算法来快速查找值，但它们之间存在一些关键的区别，特别是在线程安全、性能和使用场景方面。
## 1. HashMap
HashMap 是 Java 中最常用的哈希表实现，允许存储 null 键和 null 值，并且是非线程安全的。

### 特点：
- **非线程安全**：  
HashMap 不是线程安全的，多个线程同时访问和修改 HashMap 时，可能会导致数据不一致或抛出异常。
- **允许 null 键和值**：  
HashMap 允许一个 null 键和多个 null 值，这与 Hashtable 不同。
- **性能高**：   
由于没有线程同步的开销，HashMap 的性能较高，适合单线程或无并发访问的场景。
- **无序存储**：   
HashMap 不保证元素的顺序，键值对的插入顺序可能与遍历时的顺序不同。
- **内部实现**：  
HashMap 采用数组 + 链表 + 红黑树的结构来解决哈希冲突（Java 8 引入了红黑树以优化极端情况下的性能）。

示例：
``` java
Map<String, Integer> hashMap = new HashMap<>();
hashMap.put("key1", 1);
hashMap.put(null, 2);  // 允许 null 键和值
System.out.println(hashMap.get(null));  // 输出 2
```
### 适用场景：
HashMap 适用于单线程场景，或者明确知道没有多线程并发访问的情况。

## 2. Hashtable
Hashtable 是 Java 早期提供的一个哈希表实现，它是线程安全的，但它的线程安全机制是通过对整个方法加锁实现的，效率相对较低。

### 特点：
- **线程安全**：  
Hashtable 使用 synchronized 关键字对方法进行同步，确保多个线程同时访问时不会发生数据不一致问题。因此，Hashtable 是线程安全的，但锁住的是整个对象，导致性能较低。
- **不允许 null 键和值**：
Hashtable 不允许 null 键和 null 值，如果试图插入 null，会抛出 NullPointerException。
- **无序存储**：
Hashtable 和 HashMap 一样，也不保证存储顺序。
较老的类：Hashtable 是 Java 1.0 引入的类，随着时间的推移，它逐渐被更高效的 HashMap 和 ConcurrentHashMap 所取代。
### 示例：
``` java
Map<String, Integer> hashtable = new Hashtable<>();
hashtable.put("key1", 1);
// hashtable.put(null, 2);  // 会抛出 NullPointerException
``` 
### 适用场景：   
Hashtable 适用于较老的遗留系统，但由于其性能低、设计老旧，通常不建议在新项目中使用。

## 3. ConcurrentHashMap
ConcurrentHashMap 是 Java 5 引入的，旨在提供一种高效的线程安全哈希表实现。与 Hashtable 的全表锁不同，ConcurrentHashMap 采用更细粒度的锁机制，提供了更好的并发性能。

### 特点：
- **高效的线程安全**： 
ConcurrentHashMap 采用**分段锁（Java 7 之前）或CAS 操作（Java 8 之后）**来实现线程安全，而不是对整个表加锁。这允许多个线程同时读写不同的部分，提高了并发性能。
- **不允许 null 键和值**：  
与 Hashtable 一样，ConcurrentHashMap 也不允许 null 键和值。
- **部分有序**：  
ConcurrentHashMap 的插入顺序不保证全局有序，但在某些迭代操作中，它提供了一种弱一致性的迭代器（不会抛出 ConcurrentModificationException）。
- **并发性能优化**：  
ConcurrentHashMap 通过更细粒度的锁和无锁操作（如 CAS）来提升性能，适合高并发环境。  
分段锁设计（Java 7）：将整个哈希表划分为多个段，每个段可以独立加锁，从而减少锁竞争。  
CAS 操作（Java 8）：Java 8 中的 ConcurrentHashMap 使用 CAS（Compare-And-Swap）操作来实现无锁操作，进一步提高并发性能。
### 示例：
```java
Map<String, Integer> concurrentHashMap = new ConcurrentHashMap<>();
concurrentHashMap.put("key1", 1);
// concurrentHashMap.put(null, 2);  // 会抛出 NullPointerException
```
### 适用场景：
ConcurrentHashMap 适用于高并发的场景，特别是在多线程频繁读写数据的情况下。它的设计能够在保证线程安全的同时提供比 Hashtable 更高的性能。

## 4. 总结对比
|特性|	HashMap	|Hashtable|	ConcurrentHashMap|
| ---- | ---- | ---- | ---- |
|线程安全性|	非线程安全	|线程安全，使用方法级别的同步|	线程安全，使用更细粒度的锁或 CAS 操作|
|null 键和值	|允许 null 键和值	|不允许 null 键和值	|不允许 null 键和值|
|并发性能|	不支持并发访问，多线程环境下会出错|	支持并发访问，但性能较低	|支持高并发访问，性能高|
|锁机制	|无锁机制|	对整个对象加锁	|分段锁（Java 7 之前）或 CAS 操作（Java 8）|
|适用场景|	单线程或无并发的环境|	线程安全但性能要求不高的场景	|高并发、多线程场景|
## 5. 选用指南
HashMap：适用于单线程环境或明确不需要线程安全的场景。它的性能高，并且允许 null 键和值。  
Hashtable：适用于较老的遗留代码，但由于性能较低，通常不推荐在现代应用中使用。  
ConcurrentHashMap：适用于高并发环境，在需要线程安全但又追求高性能的场景下是最好的选择。
