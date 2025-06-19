interface Options {
  /**
   * 调试模式
   */
  debug?: boolean
}

interface Task<T> {
  /**
   * 任务唯一标识
   */
  key: string
  /**
   * 任务描述
   */
  describe: string
  /**
   * 严格模式
   * @description 如果开启 则不自动清除该任务 需要由外部调用 taskQueue.clear([task.key]) 来清除
   * @description 如果关闭 则无论任务执行的结果 只要该任务符合并且执行过一次则自动销毁
   */
  strict: boolean
  /**
   * 任务执行条件 (当所有条件均为true时 该任务才执行)
   */
  conditionKeys: T[]
  /**
   * 是否正在运行
   */
  runing: boolean
  /**
   * 任务函数
   */
  func: () => Promise<unknown>
  /**
   * 当前任务是否符合执行条件
   */
  checkAccord: () => boolean
  /**
   * 任务完成
   */
  success: (_e: any) => void
  /**
   * 任务失败
   */
  fail: (_e: any) => void
  /**
   * 任务结束
   */
  complete: () => void
  /**
   * 执行任务
   */
  run: () => Promise<void>
  /**
   * 重试任务
   */
  retry: () => Promise<void>
  /**
   * 清除任务
   */
  clear: () => void
}

interface CreateTask<T> {
  /**
   * 任务描述
   */
  describe?: string
  /**
   * 严格模式
   * @description 如果开启 则不自动清除该任务 需要由外部调用 taskQueue.clear([task.key]) 来清除
   * @description 如果关闭 则无论任务执行的结果 只要该任务符合并且执行过一次则自动销毁
   */
  strict?: boolean
  /**
   * 任务超时时间(ms) 任务超时也属于任务执行结果
   */
  timeout?: number
  /**
   * 任务执行条件 (当所有条件均为true时 该任务才执行)
   */
  conditionKeys: T[]
  /**
   * 任务函数
   */
  func: () => Promise<unknown>
  /**
   * 任务完成
   */
  success?: (_e: any) => void
  /**
   * 任务失败
   */
  fail?: (_e: any) => void
  /**
   * 任务结束
   */
  complete?: () => void
}

export class PrTaskQueue<T extends string> {
  #options = {
    debug: false
  }

  #conditionMap = new Map<T, boolean>() // 条件

  #tasks = new Map<String, Task<T>>() // 任务队列

  #index = 0 // 任务 index 用于生成任务key

  /**
   * 初始化条件
   * @example const taskQueue = new PrTaskQueue(['login','isAdmin'])
   * @param conditionKeys 条件keys string[]
   */
  constructor(conditionKeys: T[], _options: Options = {}) {
    // 设置所有条件为 true
    for (const conditionKey of conditionKeys) {
      this.#conditionMap.set(conditionKey, true)
    }
    this.#options = { debug: false, ..._options }
  }

  /**
   * 设置条件
   * @param conditionKey 条件名
   * @param accord 条件状态
   */
  setCondition = async (conditionKey: T, accord: boolean) => {
    const had = this.#conditionMap.has(conditionKey)
    if (!had) {
      throw new Error('You have set an incorrect condition. If this is necessary, you need to define it first during instantiation.')
    }

    const old_accord = this.#conditionMap.get(conditionKey)

    this.#conditionMap.set(conditionKey, accord)

    // 当条件由false变为true 需要检查可执行的任务
    if (old_accord === false && accord) {
      await this.executeTasks()
    }
  }

  /**
   * 创建任务
   * @param options.describe 描述信息
   * @param options.conditionKeys 执行条件 （所有条件符合时才执行该任务）
   * @param options.func 任务函数
   */
  createTask = async (options: CreateTask<T>) => {
    const _options = {
      describe: '',
      strict: false,
      timeout: 0,
      success: async (_e: any) => {},
      fail: async (_e: any) => {},
      complete: async () => {},
      ...options
    }

    const { describe, strict, timeout, conditionKeys, func, success, fail, complete } = _options

    const key = `${this.#index++}` // 任务唯一key

    // 检查条件
    const checkAccord = () => {
      let accord = true // 默认符合条件

      for (const conditionKey of conditionKeys) {
        // 只要有一项条件不符合 则直接跳出循环
        if (!this.#conditionMap.get(conditionKey)) {
          accord = false
          break
        }
      }

      return accord
    }

    let timer = 0

    // 清除函数
    const clear = () => {
      if (this.#options.debug) {
        console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->pr-task-queue: task ${describe} (${key}) delete`)
      }
      this.#tasks.delete(key)
    }

    // 创建执行函数
    const run = async () => {
      //  该任务已被删除 该任务正在执行 则跳过
      if (!this.#tasks.get(key) || task.runing) return

      task.runing = true

      if (this.#options.debug) {
        console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->pr-task-queue: task ${describe} (${key}) run`)
      }

      // 执行函数
      const task_promise = task.func()

      const timeout_promise = new Promise((_res, rej) => {
        // 如果有超时时间
        if (timeout) {
          timer = setTimeout(() => {
            rej(`task: ${key} (${describe}) is timeout.`)
          }, timeout)
        }
      })

      // 使用 race 当超时后终止任务的进行
      return Promise.race([task_promise, timeout_promise])
        .finally(() => {
          // 非严格模式自动移除该任务
          if (task.strict === false) {
            task.clear() // 移除任务
          }
          clearTimeout(timer) // 移除超时计时器
          task.runing = false // 结束运行状态
          complete()
        })
        .then((e) => {
          success(e)
        })
        .catch((e) => {
          fail(e)
        })
    }

    // 创建重试函数
    const retry = () => {
      task.runing = false // 结束运行状态
      return run()
    }

    const task = { key, describe, strict, conditionKeys, runing: false, func, checkAccord, success, fail, complete, run, retry, clear }

    this.#tasks.set(key, task) // 添加到队列

    // 尝试执行当前任务
    const isAccord = task.checkAccord() // 是否可以执行
    if (isAccord) {
      await task.run()
    }

    return task
  }

  /**
   * 尝试执行任务
   */
  executeTasks = async () => {
    const tasks = [...this.#tasks.values()]
    for (const task of tasks) {
      const isAccord = task.checkAccord() // 是否可以执行
      if (isAccord) {
        await task.run()
      }
    }
  }

  /**
   * 清理任务
   * @param taskKey 任务keys
   */
  clear = (taskKeys: string[] = []) => {
    if (taskKeys.length === 0) {
      this.#tasks = new Map()
      return
    }
    for (const taskKey of taskKeys) {
      this.#tasks.delete(taskKey)
    }
  }

  /**
   * 查询所有条件当前状态
   */
  getConditions = () => Object.fromEntries(this.#conditionMap)

  /**
   * 查询所有待执行任务
   */
  getTasks = () => this.#tasks
}
