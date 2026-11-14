---
title: "Markdown 常用语法速查"
date: 2024-09-20
description: "Markdown 常用语法汇总：标题、列表、引用、表格、链接、Emoji 等快速参考。"
tags: ["markdown", "writing", "notes"]
---
## 强调
**或__表示字体加粗，*或_表示字体斜体，～～表示删除线

加粗（可以使用快捷键生成加粗符号：Command+b）
```
**bold**
```
**bold**

斜体（可以使用快捷键生成斜体符号：Command+i）
```
_italic_
```
_italic_

删除
```
~~delete~~
```

normal~~delete~~normal


## 标题
在Markdown语法中，添加标题使用#，就会有标题加粗的效果出现。标题分为六个等级，即1个#代表一级标题，2个#代表二级标题，直到六级标题。

# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6

## 列表 

### 有序列表
要创建有序列表，请在每个列表项前添加数字并紧跟一个英文句点。数字不必按数学顺序排列，但是列表应当以数字 1 起始
```
1. First item
2. Second item
3. Third item
    1. Indented item
    2. Indented item
4. Fourth item
```

1. First item
2. Second item
3. Third item
    1. Indented item
    2. Indented item
4. Fourth item

### 无序列表

要创建无序列表，请在每个列表项前面添加破折号 (-)、星号 (*) 或加号 (+) 。缩进一个或多个列表项可创建嵌套列表
```
- First item
- Second item
- Third item
    - Indented item
    - Indented item
- Fourth item
```
- First item
- Second item
- Third item
    - Indented item
    - Indented item
- Fourth item

## 引用
要创建块引用，请在段落前添加一个 > 符号。
```
> import
```
渲染效果如下所示：

> import

### 多个段落的块引用
块引用可以包含多个段落。为段落之间的空白行添加一个 > 符号。
```
> import 1
>
> import 2
```
渲染效果如下：

> import 1
>
> import 2

### 嵌套块引用
块引用可以嵌套。在要嵌套的段落前添加一个 >> 符号。
```
> import 1
>
>> import 2
```
渲染效果如下：

> import 1
>
>> import 2

### 带有其它元素的块引用
块引用可以包含其他 Markdown 格式的元素。并非所有元素都可以使用，你需要进行实验以查看哪些元素有效。
```
> #### title
>
> - label 1
> - label 2
>
>  *italic* nomal **bold**.
```
渲染效果如下：

> #### title
>
> - label 1
> - label 2
>
>  *italic* nomal **bold**.

## 表格

要添加表，请使用三个或多个连字符（---）创建每列的标题，并使用管道（|）分隔每列。您可以选择在表的任一端添加管道。

通过在标题行中的连字符的左侧，右侧或两侧添加冒号（:），将列中的文本对齐到左侧，右侧或中心。
```
| Syntax      | Description | Test Text     |
| :---        |    :----:   |          ---: |
| Header      | Title       | Here's this   |
| Paragraph   | Text        | And more      |
```

呈现的输出如下所示：

| Syntax      | Description | Test Text     |
| :---        |    :----:   |          ---: |
| Header      | Title       | Here's this   |
| Paragraph   | Text        | And more      |


## 链接

超链接Markdown语法代码：
`[超链接显示名](超链接地址 "超链接title")`

[超链接显示名](超链接地址 "超链接title")

### 网址和Email地址

使用尖括号可以很方便地把URL或者email地址变成可点击的链接。
```
<https://markdown.com.cn>
<fake@example.com>
```

<https://markdown.com.cn>
<fake@example.com>

## Emoji 表情

```
去露营了！ :tent: 很快回来。

真好笑！ :joy:
```
去露营了！ :tent: 很快回来。

真好笑！ :joy:

[表情符号简码列表](https://gist.github.com/rxaviers/7360908)
