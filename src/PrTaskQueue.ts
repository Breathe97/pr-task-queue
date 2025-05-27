export class PrTaskQueue<T extends string> {
  #conditionMap = new Map<T, boolean>() // 条件

  #tasks: Array<{ key: string; strict: boolean; func: Function; conditionKeys: T[]; describe: string }> = [] // 待执行函数

  index // 任务 index

  /**
   * 初始化条件
   * @example const taskQueue = new PrTaskQueue(['login','isAdmin'])
   * @param conditionKeys 条件keys string[]
   */
  constructor(conditionKeys: T[]) {
    this.index = 0
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
  setCondition = (conditionKey: T, accord: boolean) => {
    this.#conditionMap.set(conditionKey, accord)
    // 每次条件变为true 都可能有以满足条件的任务 需要遍历一次进行执行
    if (accord) {
      this.#checkExecute()
    }
  }

  /**
   * 添加待执行任务
   * @param func 待执行任务
   * @param conditionKeys 依赖条件 （所有条件符合时才执行该任务）
   * @param options.key 任务唯一键
   * @param options.strict 是否为严格任务 （任务执行后不会主动从队列移除 需要手动调用 clear 进行移除）
   * @param options.describe 描述信息
   */
  addTask = (func: Function, conditionKeys: T[], options: { key?: string; strict?: boolean; describe?: string } = {}) => {
    const _options = { key: '', strict: false, describe: '', ...options }

    let { key, strict, describe } = _options
    if (!key) {
      key = `${this.index++}`
    } else {
      this.clear([key]) // 如果是自定义key 则需要查询是否已存在 并删除该任务
    }

    const task = { key, func, conditionKeys, describe, strict }
    this.#tasks.unshift(task)

    // 检查该任务是否可以执行
    const accord = this.checkConditions(conditionKeys)

    // 符合条件
    if (accord) {
      func()
      // 非严格模式
      if (!strict) {
        this.clear([key])
      }
    }

    return key
  }

  /**
   * 清理任务
   * @param taskKey 任务keys
   */
  clear = (taskKeys: string[] = []) => {
    // 删除所有
    if (taskKeys.length === 0) {
      this.#tasks = []
      return
    }

    for (const taskKey of taskKeys) {
      const index = this.#tasks.findIndex((item) => item.key === taskKey)
      if (index !== -1) {
        this.#tasks.splice(index, 1) // 移除改任务
      }
    }
  }

  /**
   * 查询所有条件当前状态
   */
  getConditions = () => {
    const obj = Object.fromEntries(this.#conditionMap)
    return obj
  }

  /**
   * 查询所有待执行任务
   */
  getTasks = () => {
    const arr = []
    for (const task of this.#tasks) {
      const { key, describe, conditionKeys } = task
      arr.push({ key, describe, conditionKeys })
    }
    return arr
  }

  /**
   * 检查是否符合条件
   * @param conditionKeys 依赖条件 string[]
   */
  checkConditions = (conditionKeys: T[]) => {
    let accord = true // 默认符合
    for (const conditionKey of conditionKeys) {
      const _accord = this.#conditionMap.get(conditionKey)
      // 只有有一个条件不符合 直接跳出判断不符合
      if (_accord === false) {
        accord = false
        break
      }
    }
    return accord
  }

  /**
   * 检查所有函数并执行
   */
  #checkExecute = () => {
    const length = this.#tasks.length
    for (let i = length; i > 0; i--) {
      const index = i - 1
      const item = this.#tasks[index]
      const { conditionKeys, func, strict } = item
      const accord = this.checkConditions(conditionKeys)
      {
        if (!accord) return // 不符合条件 不执行
        func() // 执行函数
      }

      {
        if (strict) return // 严格任务 不自动移除队列
        this.#tasks.splice(index, 1) // 移除函数记录
      }
    }
  }
}
