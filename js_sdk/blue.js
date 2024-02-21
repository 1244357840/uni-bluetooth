import {
	basicEventList
} from "./eventList";

/**
 * @description
 */
export default class BluetoothUtil {
	static useLog = false

	static scanTimer = 0; // 扫描设备定时器

	static connectedDevice = {}; // 已经连接的设备

	static maxScanTime = 10000; // 最长扫描时间

	static alreadyStateChange = false;

	static connectSucCode = [-1, 10010] // 连接成功的状态码

	static errorMsg = {
		'-99': '请打开蓝牙或GPS定位',
		'-98': '设备ID错误',
		'-97': '扫描设备超时',
		'-96': '未找到设备',
		'-95': '未匹配到设备服务',
		'-94': '未匹配到服务特征',
		'0': 'ok',
		'10000': '未初始化蓝牙适配器',
		'10001': '当前蓝牙适配器不可用',
		'10002': '没有找到指定设备',
		'10003': '连接失败',
		'10004': '没有找到指定服务',
		'10005': '没有找到指定特征值',
		'10006': '当前连接已断开',
		'10007': '当前特征值不支持此操作',
		'10008': '其余所有系统上报的异常',
		'10009': '系统版本低于 4.3 不支持 BLE',
		'10010': '已连接',
		'10011': '配对设备需要配对码',
		'10012': '连接超时',
		'10013': '连接 deviceId 为空或者是格式不正确',
	}

	static canShowErr = false

	static errModal = 'modal' // 'message' | modal

	/**
	 * loading配置
	 * @param {String} title 显示的文本
	 * @param {Boolean} show 是否自动显示
	 */
	static loadingConfig = {
		show: false,
		title: '连接蓝牙设备中...',
		mask: true
	}

	/**
	 * 匹配服务特征配置 默认自动读取符合特征的UUID
	 * @param {String | RegExp | Function} services 服务UUID
	 * @param {String | RegExp | Function} characteristics 特征UUID
	 */
	static servicesConfig = {
		services: '',
		characteristics: '',
	}

	static logInfo(...arg) {
		if (this.useLog) {
			console.log(...arg)
		}
	}

	static showErrModal(err, errModal = 'modal') {
		const code = err?.errCode || ''
		uni[this.errModal == 'modal' ? 'showModal' : 'showToast']({
			title: this.errorMsg[code] || err?.errMsg || err.message,
			icon: 'none'
		})
	}

	static _toShowErrModal(err) {
		if (this.canShowErr && err?.errCode != 0) {
			this.showErrModal(err, this.errModal)
		}
	}

	static autoShowLoading(open = true) {
		if (this.loadingConfig.show) {
			open ? uni.showLoading({
				title: this.loadingConfig.title,
				mask: this.loadingConfig.mask
			}) : uni.hideLoading()
		}
	}

	/**
	 * @typedef {('string' | 'buffer' | 'hex')} ValueType - 写入的数据类型
	 */

	/**
	 * @typedef {Object} DeviceOption - 设备选项
	 * @property {String} deviceId 设备ID或MAC
	 * @property {Function | RegExp | String} matchServices 匹配服务uuid,不传就匹配所有
	 * @property {Function | RegExp | String} matchWriteUUID 匹配写入蓝牙的特征UUID
	 * @property {Function | RegExp | String} matchNotifyUUID 匹配读取蓝牙的特征UUID
	 * @property {ArrayBuffer} value 写入的数据
	 * @property {Boolean} reloadScan 是否重新扫描设备，不从getBluetoothDevices获取设备
	 * @property {Function} onNotify: 监听消息
	 * @property {Function} onClose: 监听蓝牙断开
	 */

	/**
	 * 主操作函数
	 * @param {DeviceOption} device 连接的设备
	 * @return {{writeValue: Function, close: Function, connected: Function}}
	 */
	static BLE(device) {
		const that = this
		return {
			writeValue: (value, valueType, loop = false) => {
				return that.writeValue({
					...device,
					value,
					valueType,
					loop
				})
			},
			/**
			 * @description 使用任务队列排队写入
			 * @param {Object} option
			 * @param {ArrayBuffer | String} option.value 数据
			 * @param {ValueType} option.valueType 数据类型
			 * @param {Boolean} option.loop 使用循环写入
			 * @param {Number} option.startDelay 执行函数前先sleep多少ms
			 * @param {Number} option.endDelay 执行完函数后sleep多少ms返回结束状态
			 */
			eventListWriteValue: (option) => {
				return new Promise((resolve, reject) => {
					basicEventList.push({
						fn: async () => {
							try {
								await that.writeValue({
									...device,
									value: option.value,
									valueType: option.valueType,
									loop: option.loop
								})
								resolve("【循环写入完毕】")
							} catch (err) {
								reject(err)
							}
						},
						startDelay: option.startDelay,
						endDelay: option.endDelay === undefined ? 100 : option.endDelay, // 默认100ms后执行下一个任务
						cb: resolve
					})
				})
			},
			close: () => {
				return that.closeConnection(device)
			},
			connected: () => {
				return that.toConnectDevice(device)
			}
		}
	}

	static init() {
		if (!this.alreadyStateChange) {
			uni.onBluetoothAdapterStateChange((res) => {
				BluetoothUtil.logInfo('【onBluetoothAdapterStateChange】', res);
				if (!res.available) {
					this.connectedDevice = []
				}
			})
			uni.onBLEConnectionStateChange((res) => {
				BluetoothUtil.logInfo('【onBLEConnectionStateChange】', res);
				if (!res.connected && res.deviceId) {
					const key = this.matchDeviceId(res.deviceId)
					if (key) {
						this.connectedDevice[key]?.onClose && this.connectedDevice[key].onClose()
						this.connectedDevice[key] = null
						BluetoothUtil.logInfo('【断开设备】', key);
					}
				}
			})
			uni.onBLECharacteristicValueChange((res) => {
				BluetoothUtil.logInfo('【onBLECharacteristicValueChange】', res);
				if (res.deviceId) {
					let key = this.matchDeviceId(res.deviceId)
					if (key && this.connectedDevice[key].onNotify) {
						try {
							this.connectedDevice[key].onNotify(res.value)
						} catch {}
					}
				}
			})
			this.alreadyStateChange = true
		}
	}

	/**
	 * matchDeviceId
	 * @description 匹配device.deviceId对应的connectedDevice key
	 * @param {String} deviceId
	 * @return {String}
	 */
	static matchDeviceId(deviceId) {
		for (const key in this.connectedDevice) {
			if (this.connectedDevice[key]?.device?.deviceId == deviceId) {
				return key
			}
		}
		return ''
	}

	/**
	 * onBLECharacteristicValueChange
	 * @description 匹配特征
	 * @param {String} matchUUID 匹配UUID
	 * @param {Array} characteristics
	 * @return {{write, read, notify, uuid}}
	 */
	static onBLECharacteristicValueChange() {

	}

	static closeBluetoothAdapter() {
		return new Promise((resolve, reject) => {
			uni.closeBluetoothAdapter({
				success() {
					this.connectedDevice = []
					BluetoothUtil.logInfo("【closeBluetoothAdapter success】");
					resolve()
				},
				fail(err) {
					console.error("【closeBluetoothAdapter error】", err);
					reject()
				}
			})
		})
	}
	/**
	 * 初始化蓝牙设备
	 */
	static dealOpenAdapter() {
		return new Promise((resolve, reject) => {
			const that = this
			uni.openBluetoothAdapter({
				success(res) {
					BluetoothUtil.logInfo("【初始化蓝牙】", JSON.stringify(res));
					resolve(res)
				},
				fail(err) {
					BluetoothUtil.logInfo("【初始化蓝牙Error】", JSON.stringify(err));
					that._toShowErrModal({
						errCode: '-99'
					})
					reject({
						errCode: '-99',
						errMsg: err?.errMsg
					})
				}
			})
		})
	}

	/**
	 * 扫描设备定时器
	 * @description 扫描设备开启超时定时器
	 * @param {Function} fn 回调
	 * @param {Number} scanTime 默认10000ms 最长扫描时间，超过未扫描到则失败. 0: 关闭定时器
	 * @return {Promise}
	 */
	static setScanTimer(fn, scanTime) {
		if (this.scanTimer) clearTimeout(this.scanTimer)
		if (scanTime === 0) return
		const that = this
		this.scanTimer = setTimeout(() => {
			that.stopScan()
			fn()
		}, scanTime)
	}
	/**
	 * 停止扫描设备
	 * @description 停止扫描设备
	 * @return {Promise}
	 */
	static stopScan() {
		if (this.scanTimer) clearTimeout(this.scanTimer)
		uni.stopBluetoothDevicesDiscovery()
	}

	/**
	 * 消息监听
	 * @description 消息监听
	 * @return {Promise}
	 */
	static notifyBLECharacteristicValueChange(option) {
		return new Promise((resolve, reject) => {
			uni.notifyBLECharacteristicValueChange({
				...option,
				success(res) {
					resolve(res)
				},
				fail(err) {
					reject(err)
				}
			})
		})
	}

	/**
	 * 扫描设备
	 * @description 扫描多个设备，全部扫描完毕返回成功
	 * @param {(Array | String)} deviceId 要搜索的设备id
	 * @param {Number} scanTime 默认10000ms 最长扫描时间，超过未扫描到则失败
	 * @return {Promise}
	 */
	static blueScan(deviceId, scanTime = 10000) {
		return new Promise((resolve, reject) => {
			if (typeof deviceId != 'string' && typeof deviceId != 'object') {
				return reject({
					errCode: '-98',
					errMsg: this.errorMsg['-98']
				})
			}
			BluetoothUtil.logInfo("【需要连接的ID】", deviceId);
			const deviceArr = typeof deviceId == 'string' ? [deviceId] : [...deviceId]
			const scanDevice = [] // 扫描出来的设备
			this.setScanTimer(() => {
				if (deviceArr.length == 0) {
					resolve(scanDevice)
				} else {
					reject({
						errCode: '-97',
						errMsg: this.errorMsg['-97']
					})
				}
			}, this.maxScanTime)
			uni.onBluetoothDeviceFound((res) => {
				BluetoothUtil.logInfo("【扫描到设备】", res, res.devices[0]?.localName);
				if (res.devices[0]) {
					for (let i = 0; i < deviceArr.length; i++) {
						const id = deviceArr[i]
						if (this.matchDevice(res.devices[0], id)) {
							scanDevice.push(this.formatDevice(res.devices[0], id))
							deviceArr.splice(i, 1)
							break
						}
					}
				}
				if (deviceArr.length == 0) {
					// 扫描完毕
					uni.stopBluetoothDevicesDiscovery()
					resolve(scanDevice)
				}
			})

			uni.startBluetoothDevicesDiscovery({
				allowDuplicatesKey: true,
				success(res) {
					BluetoothUtil.logInfo("【开启蓝牙搜索】", JSON.stringify(res));
				},
				fail() {
					BluetoothUtil.logInfo("【开启蓝牙搜索Error】", JSON.stringify(res));
				}
			})
		})
	}

	/**
	 * 统一device格式
	 */
	static formatDevice(devices, deviceId) {
		return {
			id: deviceId,
			mac: this.parseMac(devices),
			device: devices
		}
	}

	/**
	 * @description 扫描后的device与deviceID匹配
	 * @param {String} deviceId 需要匹配的设备ID
	 * @return {Boolean}
	 */
	static matchDevice(devices, deviceId) {
		// 解析出 Mac 地址
		let arrayMac = this.parseMac(devices)
		const localName = devices?.localName?.toUpperCase() || ''
		const name = devices?.name?.toUpperCase() || ''
		const id = devices?.deviceId?.toUpperCase() || ''

		// 匹配设备
		return [arrayMac, localName, name, id].includes(deviceId?.toUpperCase())
	}

	/**
	 * @description 解析devices Mac地址 从广播包中解析
	 * @param {Object} devices 
	 * @return {String}
	 */
	static parseMac(devices) {
		try {
			if (!devices.advertisData) return ''
			const buff = devices.advertisData.slice(2, 8);
			const arrayBuff = Array.prototype.map.call(new Uint8Array(buff), x => ('00' + x.toString(16)).slice(-2)).join(
				':');
			const arrayMac = arrayBuff.toUpperCase();
			return arrayMac
		} catch (err) {
			BluetoothUtil.logInfo('【解析Mac地址错误】', err);
			return ''
		}
	}

	/**
	 * @description 获取在蓝牙模块生效期间所有已发现的蓝牙设备。包括已经和本机处于连接状态的设备
	 * @param {String} deviceId 需要匹配的设备ID，为空则返回所有
	 * @return {Promise<devices>} devices
	 */
	static getBluetoothDevices(deviceId) {
		return new Promise((resolve, reject) => {
			const _that = this
			uni.getBluetoothDevices({
				success(res) {
					if (!deviceId) return resolve(res.devices)
					BluetoothUtil.logInfo("【getBluetoothDevices】", res.devices);
					for (let i = 0; i < res.devices.length; i++) {
						if (_that.matchDevice(res.devices[i], deviceId)) {
							return resolve(res.devices[i])
						}
					}
					resolve(null)
				},
				fail(err) {
					reject(err)
				}
			})
		})
	}

	/**
	 * 连接设备
	 * @description 连接扫描出来的设备 十秒过期
	 * @param {Object} device 连接的设备
	 * @param {String} device.deviceId 设备ID
	 * @return {Promise}
	 */
	static async createConnect(device) {
		BluetoothUtil.logInfo('【createConnect device】', device);
		return new Promise((resolve, reject) => {
			uni.createBLEConnection({
				deviceId: device.deviceId,
				timeout: 10000,
				success(res) {
					BluetoothUtil.logInfo('【创建连接】', res);
					resolve(res)
				},
				fail(err) {
					BluetoothUtil.logInfo('【创建连接Error】', err);
					if (this.connectSucCode.includes(err.errCode)) {
						// 已经连接
						resolve()
					} else {
						reject(err)
					}
				}
			})
			this.init();
		})
	}

	/**
	 * 断开设备
	 * @description
	 * @param {String} deviceId 设备ID
	 * @return {Promise}
	 */
	static async closeBLEConnection(deviceId) {
		return new Promise((resolve, reject) => {
			uni.closeBLEConnection({
				deviceId,
				success(res) {
					BluetoothUtil.logInfo('【断开连接】', res);
					resolve(res)
				},
				fail(err) {
					BluetoothUtil.logInfo('【断开连接Error】', err);
					reject(err)
				}
			})
		})
	}

	/**
	 * 关闭设备连接
	 * @description
	 * @param {Object} device 连接的设备
	 * @param {String} device.deviceId 设备ID
	 * @return {Promise}
	 */
	static async closeConnection(device) {
		return new Promise(async (resolve, reject) => {
			try {
				let deviceObj = this.connectedDevice[device.deviceId]
				if (deviceObj) {
					deviceId = deviceObj.device?.deviceId
					const res = await this.closeBLEConnection(deviceId)
					this.connectedDevice[device.deviceId] = null
					resolve(res)
				} else {
					// reject({
					// 	msg: 'device_error',
					// 	msg: '未获取到设备'
					// })
				}
			} catch (err) {
				reject(err)
			}
		})
	}
	/**
	 * @description 匹配字符
	 */
	static matchStr(str, matchFn) {
		if (!matchFn) return true
		if (typeof matchFn === 'function') {
			return matchFn(str)
		} else if (matchFn instanceof RegExp) {
			return matchFn.test(str)
		} else if (typeof matchFn === 'string') {
			return matchFn == str
		}
		console.error("【匹配类型错误】")
		return false
	}

	/**
	 * getBLEDeviceServices
	 * @description 获取蓝牙设备所有服务
	 * @param {Object} option
	 * @param {String} option.deviceId 连接的设备
	 * @param {Function | RegExp | String} option.matchFn 匹配uuid,不传就匹配所有
	 * @param {Boolean} option.getCharacteristics 是否获取特征
	 * @return {Promise<{services: []}>}
	 */
	static async getBLEDeviceServices(option) {
		const that = this
		let matchUUID = (uuid) => {
			const matchFn = option.matchFn || that.servicesConfig
			return that.matchStr(uuid, matchFn)
		}
		return new Promise((resolve, reject) => {
			uni.getBLEDeviceServices({
				deviceId: option.deviceId,
				success: async (res) => {
					BluetoothUtil.logInfo('【getBLEDeviceServices】', res);
					const services = []
					for (let i = 0; i < res.services.length; i++) {
						let serviceId = res.services[i].uuid
						// if (that.servicesConfig.services && that.servicesConfig.)
						if (matchUUID(serviceId)) {
							if (option.getCharacteristics) {
								const characteristics = await that.getBLEDeviceCharacteristics(option.deviceId, serviceId)
								res.services[i]['getCharacteristics'] = characteristics
							}
							services.push(res.services[i])
						}
					}
					if (services.length) {
						resolve(services)
					} else {
						reject({
							errCode: '-95'
						})
					}
				},
				fail(err) {
					BluetoothUtil.logInfo('【getBLEDeviceServicesError】', err);
					reject(err)
				}
			})
		})
	}

	/**
	 * getBLEDeviceCharacteristics
	 * @description 获取蓝牙设备某个服务中所有特征值(characteristic)。
	 * @param {String} deviceId 连接的设备
	 * @param {String} serviceId 连接的设备
	 * @return {Promise<{}>}
	 */
	static async getBLEDeviceCharacteristics(deviceId, serviceId) {
		return new Promise((resolve, reject) => {
			uni.getBLEDeviceCharacteristics({
				deviceId,
				serviceId,
				success(res) {
					BluetoothUtil.logInfo('【getBLEDeviceCharacteristics】', res);
					resolve(res)
				},
				fail(err) {
					BluetoothUtil.logInfo('【getBLEDeviceCharacteristicsError】', err);
					reject(err)
				}
			})
		})
	}
	/**
	 * @typedef {('write' | 'notify' | 'read' | 'uuid')} MatchType - 匹配类型枚举
	 */
	/**
	 * matchCharacteristics
	 * @description 匹配服务中的特征
	 * @param {Object} option
	 * @param {MatchType} option.matchType 匹配类型
	 * @param {String} option.uuid 要匹配的uuid
	 * @param {Array} option.services
	 * @return {{characteristics, services}}
	 */
	static matchServicesCharacteristics(option) {
		if (!option.services?.length || !option.matchType) {
			throw {
				errCode: '-94',
				errMsg: '未匹配到服务特征'
			}
		}
		for (let i = 0; i < option.services.length; i++) {
			const characteristics = option.services[i].getCharacteristics.characteristics
			const res = this.matchCharacteristics(characteristics, option.matchType == 'uuid' ? option.uuid : undefined)
			if (res[option.matchType]) return {
				characteristics: res[option.matchType],
				services: option.services[i].uuid
			}
		}
		throw {
			errCode: '-94',
			errMsg: '未匹配到服务特征'
		}
	}

	/**
	 * matchCharacteristics
	 * @description 匹配特征
	 * @param {String} matchUUID 匹配UUID
	 * @param {Array} characteristics
	 * @return {{write, read, notify, uuid}}
	 */
	static matchCharacteristics(characteristics, matchUUID) {
		const that = this
		// 匹配出来的UUID
		let matchRes = {
			write: '',
			read: '',
			notify: '',
			uuid: '',
		}
		const matchFn = (uuid) => {
			const matchuuid = matchUUID || that.servicesConfig.characteristics
			if (!matchuuid) return false
			return that.matchStr(uuid, matchuuid)
		}
		for (let i = 0; i < characteristics.length; i++) {
			const properties = characteristics[i].properties
			// #ifdef MP-WEIXIN
			const uuidKey = 'uuid'
			// #endif
			// #ifdef MP-ALIPAY
			const uuidKey = 'characteristicId'
			// #endif
			const uuid = characteristics[i][uuidKey]
			if (matchFn(uuid)) {
				matchRes.uuid = uuid
				return matchRes
			}
			if (!matchRes.write && properties.write) {
				matchRes.write = uuid
			}
			if (!matchRes.read && properties.read) {
				matchRes.read = uuid
			}
			if (!matchRes.notify && properties.notify) {
				matchRes.notify = uuid
			}
		}
		return matchRes
	}

	/**
	 * 重新连接设备
	 * @param {Object} option
	 * @param {String} option.deviceId 蓝牙设备 id
	 * @return {Promise}
	 */
	static reconnectDevice(option) {
		return new Promise(async (resolve, reject) => {
			try {
				await this.closeConnection({
					deviceId: option.deviceId,
				})
				await this.toConnectDevice({
					deviceId: option.deviceId,
					reloadScan: true
				})
				const device = this.connectedDevice[option.deviceId]
				if (!device) {
					reject({
						errCode: '-96',
						errMsg: this.errorMsg['-96']
					})
				} else {
					resolve(device)
				}
			} catch (err) {
				BluetoothUtil.logInfo(err);
				reject(err)
			}
		})
	}

	/**
	 * 写入数据
	 * @param {Object} option
	 * @param {String} option.deviceId 蓝牙设备 id
	 * @param {String} option.serviceId 蓝牙特征值对应服务的 uuid
	 * @param {String} option.characteristicId 蓝牙特征值的 uuid
	 * @param {ArrayBuffer} option.value 蓝牙设备特征值对应的二进制值
	 * @param {String} option.writeType 蓝牙特征值的写模式设置，有两种模式，iOS 优先 write，安卓优先 writeNoResponse 。微信小程序支持
	 * @param {Boolean} reload 10004的时候是否重新连接
	 * @return {Promise}
	 */
	static writeBLE(option, reload = true) {
		const that = this
		return new Promise((resolve, reject) => {
			BluetoothUtil.logInfo('【写入蓝牙数据的参数】', option);
			uni.writeBLECharacteristicValue({
				...option,
				success: (res) => {
					BluetoothUtil.logInfo('【向蓝牙写入二进制数据成功】', res);
					resolve(res)
				},
				fail: async (err) => {
					BluetoothUtil.logInfo('【向蓝牙写入二进制数据失败】', err)
					if (reload && err?.errCode == 10004) {
						// *** 10004 需要重新扫描附近设备
						try {
							const deviceKey = that.matchDeviceId(option.deviceId)
							BluetoothUtil.logInfo('【开始重新扫描】', deviceKey)
							const device = await that.reconnectDevice({
								deviceId: deviceKey
							})
							const e = await that.writeBLE({
								deviceId: device.device.deviceId,
								serviceId: device.writeServicesId,
								characteristicId: device.writeCharacteristicsId,
								value: option.value,
							}, false)
							resolve(e)
						} catch (err) {
							reject(err)
						}
					} else {
						reject(err)
					}
				}
			})
		})
	}

	/**
	 * 向设备写入数据
	 * @param {Object} option
	 * @param {String} option.deviceId 蓝牙设备 id
	 * @param {ArrayBuffer} option.value 蓝牙设备特征值对应的二进制值
	 * @return {Promise}
	 */
	static writeDevice(option) {
		const _that = this
		return new Promise(async (resolve, reject) => {
			try {
				const device = _that.connectedDevice[option.deviceId]
				if (!device) reject({
					errCode: '-96',
					errMsg: _that.errorMsg['-96']
				})
				const res = await _that.writeBLE({
					deviceId: device.device.deviceId,
					serviceId: device.writeServicesId,
					characteristicId: device.writeCharacteristicsId,
					value: option.value,
				})
				resolve(res)
			} catch (err) {
				reject(err)
			}
		})
	}
	/**
	 * 连接设备流程 - 写入流程
	 * @param {Object} option
	 * @param {String} option.deviceId 设备ID或MAC
	 * @param {Array} option.services 匹配的设备服务
	 * @param {ArrayBuffer} option.value 写入的数据
	 * @param {Boolean} option.reloadScan 是否重新扫描设备，不从getBluetoothDevices获取设备
	 * @param {ValueType} option.valueType 写入的数据类型,如果不是buffer，就自动转换为buffer
	 * @param {Boolean} option.loop 是否循环写入, 针对数据包过长的数据需要分片写入
	 * @return {Promise}
	 */
	static writeValue(option) {
		return new Promise(async (resolve, reject) => {
			try {
				this.autoShowLoading(true)
				let value = option.value
				if (option.valueType === 'hex') {
					value = this.hex2buf(value)
				} else if (option.valueType === 'string') {
					value = this.str2buf(value)
				}
				await this.toConnectDevice(option)
				// 写入数据
				if (!option.loop) {
					await this.writeDevice({
						deviceId: option.deviceId,
						value: value
					})
				} else {
					await this.loopWriteValue(option, value)
				}
				this.autoShowLoading(false)
				resolve('设备已开启')
			} catch (err) {
				this.autoShowLoading(false)
				reject(err)
			}
		})
	}

	// TODO:
	static loopWriteValue(option, value) {
		return new Promise(async (resolve, reject) => {
			try {
				const packetSize = 20; // 每个小包的大小为20字节
				const len = value.byteLength
				for (let i = 0; i < len; i += packetSize) {
					BluetoothUtil.logInfo(`【循环写入】start = ${i} , end = ${packetSize * (i + 1)}`)
					await this.writeDevice({
						deviceId: option.deviceId,
						value: value.slice(i, packetSize * (i + 1))
					})
				}
				resolve(true)
			} catch (err) {
				reject(err)
			}
		})
	}

	/**
	 * 根据 uuid 获取处于已连接状态的设备。
	 * @param {Array<String>} services
	 * @param {String} mathId
	 * @return {Promise}
	 */
	static getConnectedBluetoothDevices(services, mathId) {
		return new Promise((resolve, reject) => {
			const that = this
			uni.getConnectedBluetoothDevices({
				services: services,
				success(res) {
					BluetoothUtil.logInfo("【getConnectedBluetoothDevices】", res);
					if (mathId.length) {
						for (let i = 0; i < res.devices.length; i++) {
							if (that.matchDeviceId(res.devices[i].deviceId) == mathId) {
								return resolve(true)
							}
						}
						resolve(false)
					} else {
						resolve(res)
					}
				},
				fail(err) {
					BluetoothUtil.logInfo("【getConnectedBluetoothDevices err】", err);
					reject(err)
				}
			})
		})
	}

	/**
	 * 连接设备流程
	 * @param {DeviceOption} option
	 * @return {Promise}
	 */
	static async toConnectDevice(option) {
		return new Promise(async (resolve, reject) => {
			let handleDevice
			try {
				await this.dealOpenAdapter()
				BluetoothUtil.logInfo('【connectedDevice】', this.connectedDevice);
				handleDevice = this.connectedDevice[option.deviceId]
				let isConnect = false; // 是否已经连接
				isConnect = await this.getConnectedBluetoothDevices(handleDevice ? [handleDevice.writeServicesId] : [],
					option.deviceId)
				if (!handleDevice) {
					let scanDevice = []
					if (!option.reloadScan) {
						// 先从已经扫描过的设备获取
						let deviceResult = await this.getBluetoothDevices(option.deviceId)
						BluetoothUtil.logInfo('【deviceResult】', deviceResult);
						if (!deviceResult) {
							scanDevice = await this.blueScan(option.deviceId) // 扫描设备
						} else {
							scanDevice = [this.formatDevice(deviceResult, option.deviceId)]
						}
					} else {
						scanDevice = await this.blueScan(option.deviceId) // 扫描设备
					}
					handleDevice = scanDevice[0]
				}
				if (!handleDevice) {
					return reject({
						errCode: '-96',
						errMsg: this.errorMsg['-96']
					})
				}
				BluetoothUtil.logInfo('【handleDevice】', handleDevice);
				if (!isConnect) {
					await this.createConnect({
						deviceId: handleDevice.device.deviceId
					}) // 连接设备
				}
				// 获取写入的特征
				if (!handleDevice.services || !handleDevice.writeCharacteristicsId || !handleDevice.writeServicesId) {
					// 获取设备服务
					const services = await this.getBLEDeviceServices({
						deviceId: handleDevice.device.deviceId,
						getCharacteristics: true,
						matchFn: option.matchServices
					})
					const matchRes = this.matchServicesCharacteristics({
						matchType: option.matchWriteUUID ? 'uuid' : 'write',
						services: services,
						uuid: option.matchWriteUUID || ''
					})
					const newDevice = {
						...option,
						deviceId: option.deviceId,
						device: {
							...handleDevice.device
						},
						services,
						writeCharacteristicsId: matchRes.characteristics,
						writeServicesId: matchRes.services,
					}
					this.connectedDevice[newDevice.deviceId] = newDevice
				}
				// 监听消息
				if (option.onNotify) {
					const matchNotify = this.matchServicesCharacteristics({
						matchType: option.matchNotifyUUID ? 'uuid' : 'notify',
						services: this.connectedDevice[option.deviceId].services,
						uuid: option.matchNotifyUUID
					})
					BluetoothUtil.logInfo('【matchNotify】', matchNotify);
					this.connectedDevice[option.deviceId].onNotify = option.onNotify
					try {
						this.notifyBLECharacteristicValueChange({
							deviceId: handleDevice.device.deviceId,
							serviceId: matchNotify.services,
							characteristicId: matchNotify.characteristics,
							state: true
						})
					} catch (err) {
						BluetoothUtil.logInfo('【消息监听失败】', err);
					}
				}
				if (option.onClose) {
					this.connectedDevice[option.deviceId].onClose = option.onClose
				}
				resolve()
			} catch (err) {
				if (handleDevice.device.deviceId) {
					this.closeBLEConnection(handleDevice.device.deviceId)
				}
				reject(err)
			}
		})
	}

	/**
	 * 处理buffer数据
	 * @param {Object} buffer
	 */
	static buf2hex(buffer) {
		return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
	}

	/**
	 * 处理buffer数据 value是16进制
	 * @param {String} value
	 */
	static hex2buf(hexString) {
		const bytes = [];
		for (let i = 0; i < hexString.length; i += 2) {
			bytes.push(parseInt(hexString.substr(i, 2), 16));
		}
		return new Uint8Array(bytes).buffer;
	}

	/**
	 * 处理buffer数据
	 * @param {String} value
	 */
	static str2buf(string) {
		const array = new Uint8Array(string.length);
		for (let i = 0; i < string.length; i++) {
			array[i] = string.charCodeAt(i);
		}
		return array.buffer;
	}
}