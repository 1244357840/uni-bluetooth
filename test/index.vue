<template>
	<view>
		<view style="margin-top: 10px;">
			<view>测试</view>
		</view>
		<view style="padding: 20rpx;" class="table">
			<view>设备ID:<input v-model="deviceId" type="text" /> </view>
			<view>服务ID:<input v-model="sereviceID" type="text" /></view>
			<view>特征ID:<input v-model="characteristicsID" type="text" /></view>
			<button @click="toScan">扫描设备</button>
			<button @click="open(1)">开启1号仓口</button>
			<button @click="open(2)">开启2号仓口</button>
			<button @click="open(3, 5)">开启充电5分钟</button>
			<button @click="open(3, 60)">开启充电一小时</button>
			<button @click="closeBLE">关闭蓝牙</button>
		</view>
	</view>
</template>

<script>
	import BlueUtils from '../../js_sdk/y-bluetooth/y-bluetooth/index.js'
	import BlueData from './utils-blue.js'
	export default {
		data() {
			return {
				deviceId: 'DEVICEID123',
				ble: {
					deviceId: '',
					handler: null,
				},
				nowIndex: 0,
				sereviceID: "0000AE30-0000-1000-8000-00805F9B34FB",
				characteristicsID: "0000AE01-0000-1000-8000-00805F9B34FB",
			}
		},
		methods: {
			closeBLE() {
				BlueUtils.closeBluetoothAdapter()
				this.ble = {
					deviceId: '',
					handler: null,
				}
			},
			async open(type, num) {
				// 服务：0000AE30-0000-1000-8000-00805F9B34FB
				// 特征：0000AE01-0000-1000-8000-00805F9B34FB
				BlueUtils.loadingConfig.show = true // 开启loading
				BlueUtils.useLog = true // 打印console.log
				if (!this.deviceId) {
					return uni.showToast({
						title: '请扫描设备',
						icon: 'none'
					})
				}
				if (this.ble.deviceId != this.deviceId || !this.ble.handler) {
					this.ble = {
						deviceId: this.deviceId,
						handler: BlueUtils.BLE({
							deviceId: this.deviceId,
							reloadScan: true,
							matchServices: this.sereviceID, // 可以不传
							matchWriteUUID: this.characteristicsID,  // 可以不传
						})
					}
				}
				const nowIndex = ++this.nowIndex
				try {
					if (type == 1 || type == 2) {
						await this.ble.handler.eventListWriteValue({
							value: "010041240100640000000000006a42",
							valueType: 'hex',
							endDelay: 2000, // 延迟两秒后才会执行下一个eventListWriteValue
							loop: true
						})
						console.log("【写入次数】", nowIndex);
					} else {
						await this.ble.handler.eventListWriteValue({
							value: "010012345670640000000000006a46",
							endDelay: 2000,
							valueType: 'hex',
							loop: true
						})
						console.log("【写入次数】", nowIndex);
					}
					console.log('device list', BlueUtils.connectedDevice)
				} catch (err) {
					console.log('catch ', err)
					BlueUtils.showErrModal(err) // 错误提示
				}
			},
			toScan() {
				const that = this
				uni.scanCode({
					success(res) {
						console.log(res);
						const url = res.result
						const code = url.match(/.*[id|shopping]=(.*)/) // 解析设备二维码
						if (!code) {
							return uni.showToast({
								title: '请扫描正确的二维码',
								icon: 'none'
							})
						}
						that.deviceId = code[1]
					}
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	.table {
		>view {
			margin: 14rpx 0;
		}

		button {
			margin: 14rpx 0;
		}
	}
</style>