this.ble = BLEUtils.BLE({
	deviceId: this.deviceId,
	notifyCallback: () => {},
	onClose: () => {}
})

this.ble.writeValue(value)
