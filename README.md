uniapp 微信蓝牙连接工具

npm install uni-bluetooth

```
this.ble = BLEUtils.BLE({
	deviceId: this.deviceId,
	onNotify: () => {},
	onClose: () => {}
})

this.ble.writeValue(value)
```
