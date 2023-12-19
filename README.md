uniapp 微信蓝牙简单操作工具可直接上手使用

npm install uni-bluetooth

github: [ uni-bluetooth ](https://github.com/1244357840/uni-bluetooth)

npm: [ uni-bluetooth ](https://www.npmjs.com/package/uni-bluetooth)


使用代码：
```
// 创建实例
const ble = UniBluetooth.BLE({
	deviceId: 要连接的设备localName或mac地址,
	onNotify: () => {},
	onClose: () => {}
})
// 写入数据
ble.writeValue(value)
```
### UniBluetooth.BLE()

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
|  deviceId  | string | | 是 | 要连接的设备localname或mac地址 |
|  services  | string \| RegExp | | 否 | 指定匹配的设备服务，若不指定则自动查询可操作的服务 |
|  reloadScan  | boolean | false | 否 | 是否重新扫描附近设备，false时先从本地以扫描过的设备中匹配设备 |
|  onNotify  | function | | 否 | 监听设备蓝牙消息 |
|  onClose  | function | | 否 | 监听设备蓝牙断开 |

###### 返回参数

| 属性 | 类型 | 参数 | 说明 |
| --- | --- | --- | --- |
|  writeValue  | function | （value, valueType) | 向设备写入数据 |
|  close  | function | | 断开连接 |
|  connected  | function | | 连接设备 |


### UniBluetooth.writeValue()

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
|  value  | string\|buffer | | 是 | 写入蓝牙设备的数据 |
|  valueType  | string | 'buffer' | 否 | hex \| string \| buffer  value如果不是buffer，则自动转换为buffer |



### 连接流程解析：

1. 初始化蓝牙
```
UniBluetooth.dealOpenAdapter()
```

2. 扫描匹配蓝牙
```
UniBluetooth.blueScan()
```
3. 连接蓝牙
```
UniBluetooth.createConnect()
```
4. 获取设备服务
```
UniBluetooth.getBLEDeviceServices()
```
5. 匹配服务特征
```
UniBluetooth.matchServicesCharacteristics()
```
6. 写入数据
```
UniBluetooth.writeValue()
```

### API
| API   | 类型                 | 参数 | 说明                              |
| ----- | --------------------| --- | ------------------------------- |
| BLE | function | (device) | 创建蓝牙实例 |
| dealOpenAdapter | function |  | 初始化蓝牙 |
| blueScan | function | (deviceId: array \| string, scanTime?: number) | 扫描多个设备，全部扫描完毕返回成功 |
| stopScan | function |  | 停止扫描 |
| getBluetoothDevices | function | (deviceId?:string) | 获取在蓝牙模块生效期间所有已发现的蓝牙设备。包括已经和本机处于连接状态的设备 |
| createConnect | function | (device?: device) | 连接扫描出来的设备 |
| closeBLEConnection | function | (device: device) | 关闭设备连接 |
| getBLEDeviceServices | function | (option: {deviceId: string, matchFn?: function \| RegExp, getCharacteristics: boolean}) | 获取蓝牙设备所有服务 |
| getBLEDeviceCharacteristics | function | (deviceId: string, serviceId: string) | 获取蓝牙设备某个服务中所有特征值(characteristic) |
| reconnectDevice | function | (option:{deviceId: string}) | 重新连接设备 |
| writeBLE | function | (device, reload) | 写入数据 |
| toConnectDevice | function | (device) | 连接设备流程 |
| hex2buf | function | (value) | 16进制转buffer |
| buf2hex | function | (value) | buffer转16进制 |
| str2buf | function | (value) | string转buffer |

###### device参数说明
| 属性 | 类型 | 默认值 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
|  deviceId  | string | | 是 | 要连接的设备localname或mac地址 |
|  services  | string \| RegExp | | 否 | 指定匹配的设备服务，若不指定则自动查询可操作的服务 |

### 常见错误码
| 错误码   | 错误信息                 | 说明                              |
| ----- | -------------------- | ------------------------------- |
| -1 | already connect | 已连接 |
| 0     | ok                   | 正常                              |
| 10000 | not init             | 未初始化蓝牙适配器                       |
| 10001 | not available        | 当前蓝牙适配器不可用                      |
| 10002 | no device            | 没有找到指定设备                        |
| 10003 | connection fail      | 连接失败                            |
| 10004 | no service           | 没有找到指定服务                        |
| 10005 | no characteristic    | 没有找到指定特征值                       |
| 10006 | no connection        | 当前连接已断开                         |
| 10007 | property not support | 当前特征值不支持此操作                     |
| 10008 | system error         | 其余所有系统上报的异常                     |
| 10009 | system not support   | Android 系统特有，系统版本低于 4.3 不支持 BLE |
| 10010 | already connect      | 已连接                             |
| 10011 | need pin             | 配对设备需要配对码                       |
| 10012 | operate time out     | 连接超时                            |
| 10013 | invalid_data         | 连接 deviceId 为空或者是格式不正确 |


