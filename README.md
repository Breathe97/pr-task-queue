js 函数的任务队列管理。

- 支持任意函数添加至队列。
- 添加后由外部管理任务消费状态：消费成功-移除 消费失败-重试/移除

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

#### 示例

```js
const taskQueue = new PrTaskQueue(['a', 'b', 'c'])
taskQueue.setCondition('a', false)
taskQueue.setCondition('b', false)
taskQueue.setCondition('c', false)

const task = await taskQueue.createTask({
  strict: true,
  timeout: 1200,
  describe: '测试任务',
  conditionKeys: ['a'],
  func: () => {
    return new Promise(async (res, rej) => {
      const random = Math.random() * 1000
      await new Promise((resolve) => setTimeout(() => resolve(true), 500 + random))
      if (random > 500) {
        res({ state: true })
      } else {
        rej({ state: false })
      }
    })
  }
})

task.success = (e) => {
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: success`, e)
  taskQueue.clear([task.key])
}

task.fail = async (e) => {
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: fail`, e)
  await new Promise((resolve) => setTimeout(() => resolve(true), 1000))
  await task.exe() // 再次执行该任务 只有启用 strict=true 时 才能再次调用 task.exe()
}

task.complete = () => {
  console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: complete`)
}

setInterval(() => {
  const random = Math.random()
  taskQueue.setCondition('a', random >= 0.5)
}, 5000)
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
