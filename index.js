/**
 * @description
 */
export default class BluetoothUtil {

	static scanTimer = 0; // 扫描设备定时器

	static connectedDevice = {}; // 已经连接的设备

	static maxScanTime = 10000; // 最长扫描时间

	static alreadyStateChange = false;

	static connectSucCode = [-1, 10010] // 连接成功的状态码

	static errorMsg = {
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

	/**
	 * 连接设备流程
	 * @param {Object} device 连接的设备
	 * @param {String} device.deviceId 设备ID或MAC
	 * @param {Array} device.services 设备服务
	 * @param {Boolean} device.reloadScan 是否重新扫描设备，不从getBluetoothDevices获取设备
	 * @param {Function} device.onNotify: 监听消息
	 * @param {Function} device.onClose: 监听蓝牙断开
	 * @return {{writeValue: Function, close: Function, connected: Function}}
	 */
	static BLE(device) {
		const that = this
		return {
			writeValue: (value, valueType) => {
				return that.writeValue({
					...device,
					value,
					valueType,
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
				console.log('【onBluetoothAdapterStateChange】', res);
				if (!res.available) {
					this.connectedDevice = []
				}
			})
			uni.onBLEConnectionStateChange((res) => {
				console.log('【onBLEConnectionStateChange】', res);
				if (!res.connected && res.deviceId) {
					const key = this.matchDeviceId(res.deviceId)
					if (key) {
						this.connectedDevice[key]?.onClose && this.connectedDevice[key].onClose()
						this.connectedDevice[key] = null
						console.log('【断开设备】', key);
					}
				}
			})
			uni.onBLECharacteristicValueChange((res) => {
				console.log('【onBLECharacteristicValueChange】', res);
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

	/**
	 * 初始化蓝牙设备
	 */
	static dealOpenAdapter() {
		return new Promise((resolve, reject) => {
			uni.openBluetoothAdapter({
				success(res) {
					console.log("【初始化蓝牙】", JSON.stringify(res));
					resolve(res)
				},
				fail(err) {
					console.log("【初始化蓝牙Error】", JSON.stringify(err));
					reject(err)
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
	 * @param {Number} delay 延时返回成功（安卓平台上，在调用 notifyBLECharacteristicValueChange 成功后立即调用 writeBLECharacteristicValue 接口，在部分机型上会发生 10008 系统错误）
	 * @return {Promise}
	 */
	static notifyBLECharacteristicValueChange(option, delay = 100) {
		return new Promise((resolve, reject) => {
			uni.notifyBLECharacteristicValueChange({
				...option,
				success(res) {
					setTimeout(() => {
						resolve(res)
					}, delay)
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
					type: 'error',
					msg: '设备ID错误'
				})
			}
			console.log("【需要连接的ID】", deviceId);
			const deviceArr = typeof deviceId == 'string' ? [deviceId] : [...deviceId]
			const scanDevice = [] // 扫描出来的设备
			this.setScanTimer(() => {
				if (deviceArr.length == 0) {
					resolve(scanDevice)
				} else {
					reject({
						type: 'timeout',
						msg: '扫描设备超时'
					})
				}
			}, this.maxScanTime)
			uni.onBluetoothDeviceFound((res) => {
				console.log("【扫描到设备】", res, res.devices[0]?.localName);
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
				// allowDuplicatesKey: true,
				success(res) {
					console.log("【开启蓝牙搜索】", JSON.stringify(res));
				},
				fail() {
					console.log("【开启蓝牙搜索Error】", JSON.stringify(res));
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
			console.log('【解析Mac地址错误】', err);
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
					console.log("【getBluetoothDevices】", res.devices);
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
		console.log('【createConnect device】', device);
		return new Promise((resolve, reject) => {
			uni.createBLEConnection({
				deviceId: device.deviceId,
				timeout: 10000,
				success(res) {
					console.log('【创建连接】', res);
					resolve(res)
				},
				fail(err) {
					console.log('【创建连接Error】', err);
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
					console.log('【断开连接】', res);
					resolve(res)
				},
				fail(err) {
					console.log('【断开连接Error】', err);
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
					reject({
						msg: 'device_error',
						msg: '未获取到设备'
					})
				}
			} catch (err) {
				reject(err)
			}
		})
	}

	/**
	 * getBLEDeviceServices
	 * @description 获取蓝牙设备所有服务
	 * @param {Object} option
	 * @param {String} option.deviceId 连接的设备
	 * @param {Function | RegExp} option.matchFn 匹配uuid,不传就匹配所有
	 * @param {Boolean} option.getCharacteristics 是否获取特征
	 * @return {Promise<{services: []}>}
	 */
	static async getBLEDeviceServices(option) {
		let matchUUID = (uuid) => {
			if (!option.matchFn) return true
			if (typeof option.matchFn === 'function') {
				return option.matchFn(uuid)
			} else if (typeof option.matchFn === 'string') {
				return option.matchFn == uuid || new RegExp(option.matchFn, 'ig').test(uuid)
			} else {
				return option.matchFn.test(uuid)
			}
		}
		const that = this
		return new Promise((resolve, reject) => {
			uni.getBLEDeviceServices({
				deviceId: option.deviceId,
				success: async (res) => {
					console.log('【getBLEDeviceServices】', res);
					const services = []
					for (let i = 0; i < res.services.length; i++) {
						let serviceId = res.services[i].uuid
						if (matchUUID(serviceId)) {
							if (option.getCharacteristics) {
								const characteristics = await that.getBLEDeviceCharacteristics(option.deviceId, serviceId)
								res.services[i]['getCharacteristics'] = characteristics
							}
							services.push(res.services[i])
						}
					}
					resolve(services)
				},
				fail(err) {
					console.log('【getBLEDeviceServicesError】', err);
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
					console.log('【getBLEDeviceCharacteristics】', res);
					resolve(res)
				},
				fail(err) {
					console.log('【getBLEDeviceCharacteristicsError】', err);
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
				type: 'match_error',
				msg: '匹配特征参数错误'
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
	}

	/**
	 * matchCharacteristics
	 * @description 匹配特征
	 * @param {String} matchUUID 匹配UUID
	 * @param {Array} characteristics
	 * @return {{write, read, notify, uuid}}
	 */
	static matchCharacteristics(characteristics, matchUUID) {
		// 匹配出来的UUID
		let matchRes = {
			write: '',
			read: '',
			notify: '',
			uuid: '',
		}
		for (let i = 0; i < characteristics.length; i++) {
			const properties = characteristics[i].properties
			const uuid = characteristics[i].uuid
			if (matchUUID && new RegExp(matchUUID, 'ig').test(uuid)) {
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
				const device = this.connectedDevice[deviceKey]
				if (device) {
					reject({
						msg: '重新连接设备失败'
					})
				} else {
					resolve(device)
				}
			} catch (err) {
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
			console.log('【写入蓝牙数据的参数】', option);
			uni.writeBLECharacteristicValue({
				...option,
				success: (res) => {
					console.log('【向蓝牙写入二进制数据成功】', res);
					resolve(res)
				},
				fail: async (err) => {
					console.log('【向蓝牙写入二进制数据失败】', err)
					if (reload && err?.errCode == 10004) {
						// *** 10004 需要重新扫描附近设备
						try {
							const deviceKey = that.matchDeviceId(option.deviceId)
							console.log('【开始重新扫描】', deviceKey)
							const device = that.reconnectDevice({
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
					type: 'device_undefined',
					msg: '未获取到设备信息'
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
	 * @typedef {('string' | 'buffer' | 'hex')} ValueType - 写入的数据类型
	 */
	/**
	 * 连接设备流程 - 写入流程
	 * @param {Object} option
	 * @param {String} option.deviceId 设备ID或MAC
	 * @param {Array} option.services 匹配的设备服务
	 * @param {ArrayBuffer} option.value 写入的数据
	 * @param {Boolean} option.reloadScan 是否重新扫描设备，不从getBluetoothDevices获取设备
	 * @param {ValueType} option.valueType 写入的数据类型,如果不是buffer，就自动转换为buffer
	 * @return {Promise}
	 */
	static writeValue(option) {
		return new Promise(async (resolve, reject) => {
			try {
				let value = option.value
				if (option.valueType === 'hex') {
					value = this.hex2buf(value)
				} else if (option.valueType === 'string') {
					value = this.str2buf(value)
				}
				await this.toConnectDevice(option)
				// 写入数据
				await this.writeDevice({
					deviceId: option.deviceId,
					value: value
				})
				resolve('设备已开启')
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
					console.log("【getConnectedBluetoothDevices】", res);
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
					console.log("【getConnectedBluetoothDevices err】", err);
					reject(err)
				}
			})
		})
	}

	/**
	 * 连接设备流程
	 * @param {Object} option
	 * @param {String} option.deviceId 设备ID或MAC
	 * @param {Array} option.services 匹配的设备服务
	 * @param {ArrayBuffer} option.value 写入的数据
	 * @param {Boolean} option.reloadScan 是否重新扫描设备，不从getBluetoothDevices获取设备
	 * @param {Function} option.onNotify: 监听消息
	 * @param {Function} option.onClose: 监听蓝牙断开
	 * @return {Promise}
	 */
	static async toConnectDevice(option) {
		return new Promise(async (resolve, reject) => {
			try {
				await this.dealOpenAdapter()
				console.log('【connectedDevice】', this.connectedDevice);
				let handleDevice = this.connectedDevice[option.deviceId]
				let isConnect = false; // 是否已经连接
				if (handleDevice) {
					isConnect = await this.getConnectedBluetoothDevices([handleDevice.writeServicesId], option.deviceId)
				}
				if (!handleDevice) {
					let scanDevice = []
					if (!option.reloadScan) {
						// 先从已经扫描过的设备获取
						let deviceResult = await this.getBluetoothDevices(option.deviceId)
						console.log('【deviceResult】', deviceResult);
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
						type: 'device_error',
						msg: '搜索不到设备'
					})
				}
				console.log('【handleDevice】', handleDevice);
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
						matchFn: option.services
					})
					const matchRes = this.matchServicesCharacteristics({
						matchType: 'write',
						services: services,
					})
					const newDevice = {
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
						matchType: 'notify',
						services: this.connectedDevice[option.deviceId].services,
					})
					console.log('【matchNotify】', matchNotify);
					this.connectedDevice[option.deviceId].onNotify = option.onNotify
					try {
						await this.notifyBLECharacteristicValueChange({
							deviceId: handleDevice.device.deviceId,
							serviceId: matchNotify.services,
							characteristicId: matchNotify.characteristics,
							state: true
						})
					} catch (err) {
						console.log('【消息监听失败】', err);
					}
				}
				if (option.onClose) {
					this.connectedDevice[option.deviceId].onClose = option.onClose
				}
				resolve()
			} catch (err) {
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