// import { createApp } from 'vue'
// import './style.css'
// import App from './App.vue'

// createApp(App).mount('#app')

import { PrTaskQueue } from '../../src/PrTaskQueue'
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
