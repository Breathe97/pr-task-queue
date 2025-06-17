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
  exe: () => Promise<void>
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
  #conditionMap = new Map<T, boolean>() // 条件

  #tasks = new Map<String, Task<T>>() // 任务队列

  #index = 0 // 任务 index 用于生成任务key

  #executing_tasks = new Map<String, Task<T>>() // 正在执行的任务

  /**
   * 初始化条件
   * @example const taskQueue = new PrTaskQueue(['login','isAdmin'])
   * @param conditionKeys 条件keys string[]
   */
  constructor(conditionKeys: T[]) {
    // 设置所有条件为 true
    for (const conditionKey of conditionKeys) {
      this.#conditionMap.set(conditionKey, true)
    }
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

    // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: setCondition:${conditionKey}`, accord)

    this.#conditionMap.set(conditionKey, accord)
    // 每次条件变为true 都可能有以满足条件的任务 需要检查执行对应任务
    if (accord) {
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
      success: (_e: any) => {},
      fail: (_e: any) => {},
      complete: () => {},
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

    // 创建执行函数
    const exe = async () => {
      //  该任务已被删除 该任务正在执行 则跳过
      if (!this.#tasks.get(key) || this.#executing_tasks.get(key)) return

      const isAccord = task.checkAccord() // 是否可以执行

      if (!isAccord) return // 不符合条件

      // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->pr-task-queue: exe ${describe}`)

      this.#executing_tasks.set(key, task) // 记录当前正在执行的任务

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
      await Promise.race([task_promise, timeout_promise])
        .then(async (e) => {
          success(e)
        })
        .catch(async (e) => {
          fail(e)
        })
        .finally(async () => {
          this.#executing_tasks.delete(task.key) // 移除正在执行的状态
          // 非严格模式自动移除该任务
          if (task.strict === false) {
            this.#tasks.delete(task.key) // 移除任务
          }
          clearTimeout(timer) // 移除超时计时器
          complete()
        })
    }

    const task = { key, describe, strict, conditionKeys, func, checkAccord, success, fail, complete, exe }

    this.#tasks.set(key, task) // 添加到队列

    // 尝试执行当前任务
    await exe()

    return task
  }

  /**
   * 尝试执行任务
   */
  executeTasks = async () => {
    const tasks = [...this.#tasks.values()]
    for (const task of tasks) {
      await task.exe() // 执行时自动判断是否符合条件
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
