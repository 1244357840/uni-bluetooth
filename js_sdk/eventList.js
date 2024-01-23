/**
 * @description 异步事件队列
 */

export class EventList {
	list = []; // 事件队列
	isRunning = false; // 是否正在执行
	tagNumber = 0; // 自增tag

	/**
	 * 插入队列后面
	 * @param {Object} option
	 * @param {Function} option.fn 函数
	 * @param {Number} option.startDelay 执行函数前先sleep多少ms
	 * @param {Number} option.endDelay 执行完函数后sleep多少ms返回结束状态
	 * @param {Function} option.cb 回调
	 * @returns {Number} 事件Tag
	 */
	push(option, ...arg) {
		const _option = this.formatOption(option, arg)
		this.list.push(_option)
		this.run()
		return _option.tag
	}
	unshift(option, ...arg) {
		const _option = this.formatOption(option, arg)
		this.list.unshift(_option)
		this.run()
		return _option.tag
	}
	formatOption(option, arg) {
		this.tagNumber += 1
		return {
			fn: option.fn,
			startDelay: option.startDelay || 0,
			endDelay: option.endDelay || 0,
			cb: option.cb || null,
			tag: this.tagNumber,
			arg: arg
		}
	}
	
	async run() {
		if (this.isRunning) return
		this.isRunning = true
		while(this.isRunning && this.list.length) {
			try {
				const eventOption = this.list.shift()
				eventOption.startDelay && await this.sleep(eventOption.startDelay)
				await eventOption.fn(...eventOption.arg)
				eventOption.endDelay && await this.sleep(eventOption.endDelay)
				eventOption.cb && eventOption.cb()
			} catch (err) {
				console.error('run event list error', err)
			}
		}
		this.isRunning = false
	}
	
	sleep(time) {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve()
			}, time)
		})
	}
	
	/**
	 * 移除事件
	 * @param {Number | Object} option 事件函数或事件Tag
	 * @param {Boolean} isTag 是否是tag false为函数
	 */
	rmEvent(option, isTag = true) {
		this.list = this.list.filter(items => {
			return !(((isTag && option == items.tag) || (!isTag && option == items.fn)))
		})
	}
}
// 静态类实现
export class basicEventList {
	static eventList = new EventList()
	static push(...arg) {
		return this.eventList.push(...arg)
	}
	static unshift(...arg) {
		return this.eventList.unshift(...arg)
	}
	static rmEvent(...arg) {
		return this.eventList.rmEvent(...arg)
	}
}