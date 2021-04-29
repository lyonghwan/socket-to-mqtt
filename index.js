
/**
 * Enviroments Section
 */
var mqtt = require('mqtt');
var mqttClient  = mqtt.connect('mqtt:/localhost:40001');
var wsClient  = mqtt.connect('ws://localhost:40003/mqtt');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });
var {Pool} = require('pg');


var TOPIC_ORDER_RECV = 'order/recv';
var TOPIC_ORDER_SEND = 'order/send';
var TOPIC_ORDER_STATUS = 'order/status';
var TOPIC_AGV = 'agv';
var TOPIC_ROBOT = 'robot';
var TOPIC_PLC = 'plc';
var TOPIC_VOLT_JOB = 'volt/job';
var TOPIC_VOLT_MONITOR = 'volt/monitoring';


var ORDER_STATUS_WAIT = 'WAIT';
var ORDER_STATUS_INSTRUCT = 'INSTRUCT';
var ORDER_STATUS_WORKING = 'WORKING';
var ORDER_STATUS_DELIVERY = 'DELIVERY';
var ORDER_STATUS_FINISH = 'FINISH';

var ROTBOT_ALL_ID ="ROBOT_ALL"
var ROBOT_ALL_STATUS = 'NORMAL';
var ROBOT_ALL_NORMAL_STATUS = 'NORMAL';


var pool = new Pool({
  host: 'localhost',
  database: 'postgres',
  user: 'postgres',
  password: 'p@stgr#s',
  port: 40002
})
var PRODUCT_MAP = {
	"000001":"1000001",
	"000002":"1000002",
	"000006":"1000006",
	"000007":"1000007",
	"000008":"1000008",
	"000011":"1000011",
	"000012":"1000012",
	"000003":"2000003",
	"000004":"2000004",
	"000005":"2000005",
	"000009":"2000009",
	"000010":"2000010"
}
// var client = pool.connect()

var messageSwitch = () =>{
	mqttClient.on('connect', function () {});
    mqttClient.subscribe(TOPIC_ORDER_RECV,function(err){});
    mqttClient.subscribe(TOPIC_ORDER_SEND,function(err){});
    mqttClient.subscribe(TOPIC_AGV,function(err){});
    mqttClient.subscribe(TOPIC_ROBOT,function(err){});
    mqttClient.subscribe(TOPIC_ORDER_STATUS,function(err){});
    mqttClient.subscribe(TOPIC_VOLT_JOB,function(err){});
    mqttClient.subscribe(TOPIC_VOLT_MONITOR,function(err){});
	mqttClient.on('message',function(topic, message, packet) {
		try{
			switch (topic) {
			  case TOPIC_ORDER_RECV:
				console.log("===========order recv message============");
				console.log(message);
				console.log(message.toString());
			    if(message.toString()==="RESEND"){
			    	reSendOrder();
			    }else if(message.toString()==="RESET"){
			    	resetData();
			    }else if(message.toString()==="CLOSE"){
			    	closeData();
			    }else{
					var messageString = message.toString().replace(/(\r\n|\n|\r)/gm,"");
					var lastIdx = messageString.lastIndexOf("}");
					var firstIdx = messageString.indexOf("{");
					var dataString = messageString.substring(firstIdx,(lastIdx-firstIdx)+100).slice(0,-1);
					var data = JSON.parse(dataString);
				    orderRecvProcess(data);
			    }
			    break;
			  case TOPIC_ORDER_SEND:
			    console.log("===========order send message============");
			    console.log(message.toString());
			  	break;
			  case TOPIC_AGV:
			    console.log("===========agv recv message============");
			    console.log(message.toString());
			    break;
			  case TOPIC_ROBOT:
			    console.log("===========robot recv message============");
			    console.log(message.toString());

			    var messageString = message.toString().replace(/(\r\n|\n|\r)/gm,"");
			    var data = JSON.parse(messageString);
			    var robotAllData = data[ROTBOT_ALL_ID];
			    if(robotAllData && robotAllData.type==='status') ROBOT_ALL_STATUS = robotAllData.value;

			  	break;
			  case TOPIC_PLC:
			    break;
			  case TOPIC_ORDER_STATUS:
			    console.log("===========order status message============");
			    console.log(message.toString());
			    var data = JSON.parse(message.toString());
			    console.log(data.status)
			    if(data.status === ORDER_STATUS_WORKING){
			    	console.log(data.status)
			    	updateOrderStatus(data.order_id, ORDER_STATUS_WORKING);
			    }else if(data.status === ORDER_STATUS_DELIVERY){
			    	console.log(data.status)
			    	finishOrder(data.order_id);
			    }else if(data.status === ORDER_STATUS_FINISH){
			    	console.log(data.status)
			    	updateOrderStatus(data.order_id, ORDER_STATUS_FINISH);
			    }
			    break;
			  default :
			    console.log("===========other message============");
			    console.log(message.toString());
			}
		} catch (e) {
			console.error(e.stack)
		}
	});
	mqttClient.on("error", (error) => { 
	  console.log(e.stack);
	})
}

messageSwitch();


var websocketSwitch = () =>{
	wsClient.on('connect', function () {});
    wsClient.subscribe(TOPIC_ORDER_RECV,function(err){});
    wsClient.subscribe(TOPIC_ORDER_SEND,function(err){});
    wsClient.subscribe(TOPIC_AGV,function(err){});
    wsClient.subscribe(TOPIC_ROBOT,function(err){});
	wsClient.on('message',function(topic, message, packet) {
		var messageString = message.toString().replace(/(\r\n|\n|\r)/gm,"");
	});
	wsClient.on("error", (error) => { 
	  console.log(e.stack);
	})
}

websocketSwitch();
/**
 * 주문 수신 프로세스 시작
 */

/**
 * Order 생성
 * @params product_cd,qty,status,order_date,name,description,order_id
 *         productCd,qty,status,orderDate,name,description,orderId
 *         $1,        $2, $3,    $4,        $5,  $6,         $7
 * 호출 Sample : query(sqlInsertOrder, [productCd,qty,status,orderDate,name,description,orderId],
 * 										 function(){},
 * 										 funciton(){})
 */
var sqlInsertOrder = `INSERT INTO ORDERS(product_cd,qty,status,order_date,name,description,order_id) 
                                  VALUES($1,        $2, $3,    $4,        $5,  $6,         $7) RETURNING id`;

var orderRecvProcess = (data) => {
	// console.log(data.length);
	var orders = covertOrders(data);
	if(orders.length<2){
		console.log("returned")
		return;
	}
	insertOrders(orders)
}

var covertOrders = (data) => {
	var rows = data.PRODUCT;
	//TODO: 제거 
	var date = new Date();
	data.BILL_NO = data.BILL_NO + date.getTime().toString();
	var result= rows.map((row,index)=>{
		var obj = {};
		obj.product_cd = PRODUCT_MAP[row.PROD_CD];
		// obj.qty = row.SALE_QTY;
		obj.qty = 1;
		obj.status  = ORDER_STATUS_WAIT;
		obj.order_date = data.SALE_DATE;
		obj.name = row.PROD_CD;
		obj.description = data.POS_NO;
		obj.order_id = data.BILL_NO;
		return obj;
	});
	var orders = [];
	var firstProd = result.find(order=>{return order.product_cd.startsWith("1")});
	var secondProd = result.find(order=>{return order.product_cd.startsWith("2")});

	if(firstProd){
		orders.push(firstProd)
	}
	if(secondProd){
		orders.push(secondProd)
	}


	return orders;
}

var json2array = (json) => {
    var result = [];
    var keys = Object.keys(json);
    keys.forEach(function(key){
        result.push(json[key]);
    });
    return result;
}

var insertOrders = (orders) => {
	;(async () => {
		//주문수신
		await pool
		  .connect()
		  .then(async client => {
				try {
				    await client.query('BEGIN')
				    
				    orders.forEach(async (order)=>{
				    	var arrOrder = json2array(order);
				    	await client.query(sqlInsertOrder, arrOrder);
				    });
				    await client.query('COMMIT')
				} catch (e) {
				    await client.query('ROLLBACK')
				    throw e
				} finally {
					client.release()
				}
		  })
		//다음 주문 전달
		await sendNextOrder();  
	})().catch(e => console.error(e.stack))
};
/**
 * 주문 수신 프로세스 완료
 */

/**
 * 다음주문 전달
 */

/**
 * WORKING이 없는 경우 주문서 선택
 */
var sqlSelectNextOrder = 
     `SELECT * FROM ORDERS WHERE ORDER_ID IN (
	   SELECT ORDER_ID FROM ORDERS 
	   WHERE ID IN (
		   SELECT MIN(ID) FROM ORDERS WHERE STATUS NOT IN ('FINISH','DELIVERY')
	   )
	 ) order by id;`;

var sendNextOrder = () =>{
	// if(ROBOT_ALL_STATUS===ROBOT_ALL_NORMAL_STATUS){
		;(async () => {
			await pool
			  .connect()
			  .then(async client => {
					try {
						await client.query(sqlSelectNextOrder,null)
						            .then(res => {
						            	var dataSet = res.rows;
						            	if(dataSet && dataSet.length>0){
						            		if(dataSet[0].status===ORDER_STATUS_WAIT){
						            			// {"ip":"192.168.0.10", ”r_type":”robot", ”type":”order” , ”command":”03”, ”item1":”1” , ”item2":”2”, ”item3":”3”}
						            			var orderRobotType = {}
						            			// orderRobotType.ip="192.168.0.10"; //TODO: 확인필요
						            			orderRobotType.order_id=dataSet[0].order_id; 
						            			// orderRobotType.r_type="robot";
						            			orderRobotType.type ="order";
						            			orderRobotType.command ="00";
						            			console.log(dataSet);
						            			orderRobotType.item1 = dataSet.find(order=>{return order.product_cd.startsWith("1")}).product_cd;
						            			orderRobotType.item2 = dataSet.find(order=>{return order.product_cd.startsWith("2")}).product_cd;
						            			updateOrderStatus(dataSet[0].order_id, ORDER_STATUS_INSTRUCT);
						            			mqttClient.publish(TOPIC_ORDER_SEND, JSON.stringify(orderRobotType));
						            		}
						            	}
								    })
					} catch (e) {
					    throw e
					} finally {
						client.release()
					}
			  })
		})().catch(e => console.error(e.stack))
	// }
}

/**
 * WORKING이 없는 경우 주문서 선택
 */
var sqlInstructedOrder = 
     `SELECT * FROM ORDERS WHERE status = 'INSTRUCT';`;

var reSendOrder = () =>{
	// if(ROBOT_ALL_STATUS===ROBOT_ALL_NORMAL_STATUS){
		;(async () => {
			await pool
			  .connect()
			  .then(async client => {
					try {
						await client.query(sqlInstructedOrder,null)
						            .then(res => {
						            	console.log(res.rows);
						            	var dataSet = res.rows;
				            			var orderRobotType = {}
				            			orderRobotType.order_id=dataSet[0].order_id; 
				            			orderRobotType.type ="order";
				            			orderRobotType.command ="00";
				            			orderRobotType.item1 = dataSet.find(order=>{return order.product_cd.startsWith("1")}).product_cd;
				            			orderRobotType.item2 = dataSet.find(order=>{return order.product_cd.startsWith("2")}).product_cd;
				            			mqttClient.publish(TOPIC_ORDER_SEND, JSON.stringify(orderRobotType));
								    })
					} catch (e) {
					    throw e
					} finally {
						client.release()
					}
			  })
		})().catch(e => console.error(e.stack))
	// }
}


var sqlResetStock = `UPDATE STOCKS SET CURRENT_QTY= DEFUALT_QTY`;
var sqlResetOrder = `DELETE FROM ORDERS`;

var resetData = () => {
	;(async () => {
		await pool
		  .connect()
		  .then(async client => {
				try {
				    await client.query('BEGIN')
				    await client.query(sqlResetOrder, null);
			   		await client.query(sqlResetStock, null);
				    await client.query('COMMIT')
				} catch (e) {
				    await client.query('ROLLBACK')
				    throw e
				} finally {
					client.release()
				}
		  })
	})().catch(e => console.error(e.stack))
};

// var sqlResetStock = `UPDATE STOCKS SET CURRENT_QTY= DEFUALT_QTY`;
// var sqlResetOrder = `UPDATE ORDERs SET Status = 'FINISH' FROM ORDERS`;

// var closeData = () => {
// 	;(async () => {
// 		await pool
// 		  .connect()
// 		  .then(async client => {
// 				try {
// 				    await client.query('BEGIN')
// 				    await client.query(sqlResetOrder, null);
// 			   		await client.query(sqlResetStock, null);
// 				    await client.query('COMMIT')
// 				} catch (e) {
// 				    await client.query('ROLLBACK')
// 				    throw e
// 				} finally {
// 					client.release()
// 				}
// 		  })
// 	})().catch(e => console.error(e.stack))
// };
/**
 * Order 상태 update
 * @params $1 : orderId, $2 : status 
 * 호출 Sample : query(updateOrderStatus, [orderId,status],
 * 										 function(){},
 * 										 funciton(){})
 */
var sqlUpdateOrderStatus = `UPDATE ORDERS SET STATUS = $2 WHERE ORDER_ID = $1`;


var updateOrderStatus = (orderId, status) => {
	;(async () => {
		await pool
		  .connect()
		  .then(async client => {
				try {
				    await client.query('BEGIN')
			   		await client.query(sqlUpdateOrderStatus, [orderId, status]);
				    await client.query('COMMIT')
				} catch (e) {
				    await client.query('ROLLBACK')
				    throw e
				} finally {
					client.release()
				}
		  })
	})().catch(e => console.error(e.stack))

};

/**
 * 주문완료 사작
 */

/**
 * 재고 업데이트
 * @type {[type]}
 */
var stockUpdate = `UPDATE STOCKS SET CURRENT_QTY= CURRENT_QTY-1 WHERE PRODUCT_CD IN (SELECT NAME FROM ORDERS WHERE ORDER_ID = $1)`;

var updateStockbyOrder = (orderId,status) => {
	;(async () => {
		await pool
		  .connect()
		  .then(async client => {
				try {
				    await client.query('BEGIN')
				    await client.query(sqlUpdateOrderStatus, [orderId, status]);
			   		await client.query(stockUpdate, [orderId]);
				    await client.query('COMMIT')
				} catch (e) {
				    await client.query('ROLLBACK')
				    throw e
				} finally {
					client.release()
				}
		  })
		await sendNextOrder();  
	})().catch(e => console.error(e.stack))

};

var finishOrder = (order_id) =>{
	updateStockbyOrder(order_id,ORDER_STATUS_DELIVERY);
}