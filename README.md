js 函数的任务队列管理。

## 立即开始

### 安装

```bash
npm i pr-task-queue
```

### 引入

```js
// 按需引入

// 或全量引入
import { PrTaskQueue } from 'pr-task-queue'
```

#### 创建队列

```js
const taskQueue = new PrTaskQueue(['login', 'isAdmin']) // 创建一个队列 队列中含有 是否登录 是否为管理员
```

#### 设置条件

```js
taskQueue.setCondition('login', true) // 已登录
```

#### 添加任务

```js
const func = () => {
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: 已登录`)
}
const taskKey = taskQueue.addTask(func, ['login'], { describe: '这是登录后才执行的函数' })
```

#### 清理任务

```js
taskQueue.clear(['taskKey']) // 清理指定任务
taskQueue.clear() // 清理所有任务
```

#### 查询所有条件当前状态

- 一般用不上 当任务没有安装预期执行可调用查看

```js
const res = taskQueue.getConditions()
```

#### 查询所有待执行任务

- 一般用不上 当任务没有安装预期执行可调用查看

```js
const res = taskQueue.getTasks()
```
