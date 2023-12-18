```
this.ble = BLEUtils.BLE({
	deviceId: this.deviceId,
	onNotify: () => {},
	onClose: () => {}
})

this.ble.writeValue(value)
```
