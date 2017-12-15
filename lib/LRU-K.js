/**
 * 改进的LRU-K缓存实现
 * 实现原理：分别维护两个链表，历史表和缓存表
 * 数据第一次访问时加入到历史表里，当在历史表里的访问次数达到K时移入到缓存表里，并缓存结果
 * 历史表的数据不缓存结果
 * 缓存表中缓存计算结果，逻辑按照LRU实现
 */

 // 全局操作函数
 const _actions = {
   /**
   * 数组的filter功能改造
   * @param {Array} list - 需要过滤的数组
   * @param {Function} f - 过滤条件
   * @return {Any} 返回匹配条件下的第一个元素
   */
  find (list, f) {
    return list.filter(f)[0]
  },

  /**
   * 深度赋值功能
   * 赋值时如果出现对象的无限循环，立即终止，直接返回
   * @param {Object|Array} obj - 赋值元素
   * @param {Array} cache - 判断对象是否循环
   * @return {Object|Array} 返回深度赋值后的结果
   */
  deepCopy (obj, cache = []) {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    const hit = this.find(cache, c => c.original === obj)
    if (hit) {
      return hit.copy
    }

    const copy = Array.isArray(obj) ? [] : {}
    cache.push({
      original: obj,
      copy
    })

    Object.keys(obj).forEach(key => {
      copy[key] = this.deepCopy(obj[key], cache)
    })

    return copy
  },
 }

// export default
class Cache {
  constructor(fn, options={}) {
    // 需要缓存结果的运行函数
    this.fn = fn
    // 缓存配置
    this.options = options
    // 作用域
    this.scope = options.scope || this
    // 在历史表里访问的次数上限，达到后移入缓存表里
    this.kTimes = options.kTimes || 2
    // 缓存表的存储上限
    this.cacheLimit = options.cacheLimit || 10
    // 历史表对象
    this.keyHistoryMap = Object.create(null)
    // 历史表数量
    this.historySize = 0
    // 缓存表对象
    this.keyCacheMap = Object.create(null)
    // 缓存表数量
    this.cacheSize = 0
    // 原始的函数运行参数
    this.params = null
    // 格式化后的参数
    this.key = null
    // 函数运行的结果
    this.value = null
    // 仿造链表结构，缓存表里的对象都具有head和tail属性，此处为整个表的头尾
    this.cHead = this.cTail = void(0)
  }

  /**
   * 调用的唯一入口函数
   */
  use(...arg) {
    this.params = arg
    this.key = this.getKey(arg)
    // 访问一次数据
    let entry = this.visit()
    return this.value
  }

  /**
   * 获取缓存信息
   * 避免信息的敏感性，只返回长度信息
   */
  getCacheInfo() {
    return {
      historySize: this.historySize,
      cacheSize: this.cacheSize
    }
  }

  /**
   * 访问数据
   * @return {Object} 返回处理好的结果
   */
  visit() {
    // 查看缓存表里是否有缓存的记录
    let entry = this.keyCacheMap[this.key]
    if (entry) {
      // 增加一次缓存表的访问记录
      this.visitCache()
      this.value = entry.value
      return
    }
    // 对历史表进行操作，没有则添加，有则增加访问次数
    entry = this.putHistory()
    // 如果本次访问使得在历史表的记录的访问次数达到要求而添加到缓存表，
    // 则从缓存表读取缓存了的value，如果没有则表示访问次数未达到要求
    // 则需要计算value
    if (entry.value) {
      this.value = entry.value
      return
    }
    this.value = this.evaluate()
    return
  }

  /**
   * 从历史表里删除指定元素
   * @param {String} index 要求删除的key
   * @return {Object} 返回删除的数据
   */

  delHistory(entry) {
    if (this.keyHistoryMap[entry.key]) {
      this.keyHistoryMap[entry.key] = null
    }
    return entry
  }

  /**
   * 访问历史表数据，如果存在则范文历史加一，没有则创建
   * @return {Object} 返回在历史表的记录
   */
  putHistory() {
    let entry = this.keyHistoryMap[this.key]
    if (entry) {
      entry.time ++
      // 访问达到要求，移到缓存表
      if (entry.time === this.kTimes) {
        entry = this.putCache(entry)
        this.delHistory(entry)
      }
    } else {
      entry = {
        key: this.key,
        time: 0
      }
      this.keyHistoryMap[entry.key] = entry
    }
    return entry
  }

  /**
   * 缓存表删除数据时从尾部开始删除
   * @return {object} 被删除的元素
   */
  popCache() {
    const entry = this.cTail
    if (entry) {
      this.cTail = this.cTail.pre
      this.cTail.next = void(0)
      entry.next = entry.pre = void(0)
      this.keyCacheMap[entry.key] = void(0)
      this.cacheSize--
    }
    return entry
  }

  /**
   * 当历史表的数据访问次数达到要求后，向缓存表头部插入数据
   * @param {Object} entry 要求插入的对象
   * @return {Object} 返回插入的值
   */
  putCache(entry) {
    const key = entry.key
    if (!this.keyCacheMap[key]) {
      if (this.cacheSize === this.cacheLimit) {
        this.popCache()
      }
      this.keyCacheMap[key] = {
        key: key,
        value: this.evaluate(),
        next: void(0),
        pre: void(0)
      }
      if (this.cHead) {
        this.cHead.pre = entry
        entry.next = this.cHead
      } else {
        this.cHead = this.cTail = entry
      }
      this.cHead = entry
      this.cacheSize++
    }
    return entry
  }

  /**
   * 访问一次缓存表的记录，将此记录移到头部
   * @param {Object} entry 要求插入的对象
   * @return {Object} 返回插入的值
   */
  visitCache(entry) {
    if (this.keyCacheMap[entry.key] && this.cHead !== entry) {
      this.cHead.pre = entry
      entry.next = this.cHead
      entry.pre = void(0)
      this.cHead = entry
    }
    return entry
  }

  // 计算结果
  evaluate() {
    this.value = this.fn.apply(this.scope, this.params)
    return this.value
  }

  /**
   * 格式化param值作为key
   * @param {params} 参数
   * @return {String} params的string值
   */
  getKey(params) {
    const p = deepCopy(params)
    const length = p.length
    for (let index = 0; index < length; index++) {
      const item = params[index]
      // 如果是函数，不计入
      if (item instanceof Function) {
        p.spice(index, 1)
      }
    }
    return JSON.stringify(p)
  }
}
