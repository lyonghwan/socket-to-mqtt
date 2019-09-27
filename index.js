
/**
 * Enviroments Section
 */
var mqtt = require('mqtt');
var mqttClient  = mqtt.connect('mqtt://60.196.69.234:40001');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });
var {Pool} = require('pg');


var TOPIC_ORDER_RECV = 'order/recv';
var TOPIC_ORDER_SEND = 'order/send';
var TOPIC_AGV = 'agv';
var TOPIC_ROBOT = 'robot';
var TOPIC_PLC = 'plc';


var ORDER_STATUS_WAIT = 'WAIT';
var ORDER_STATUS_WORKING = 'WORKING'
var ORDER_STATUS_FINISH = 'FINISH'


var pool = new Pool({
  host: '60.196.69.234',
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
	mqttClient.on('message',function(topic, message, packet) {
		console.log("===========message============");
		console.log(message);
		var dataString = message.toString().replace(/(\r\n|\n|\r)/gm,"").replace('�',"");
		console.log("===========replaced============");
		console.log(dataString);
		try{
			var data = JSON.parse(dataString);
			switch (topic) {
			  case TOPIC_ORDER_RECV:
			    orderRecvProcess(data);
			    break;
			  case TOPIC_ORDER_SEND:
			    console.log(data);
			  	break;
			  case TOPIC_AGV:
			    // orderFinishProcess(data);
			    break;
			  case TOPIC_ROBOT:
			  	break;
			  case TOPIC_PLC:
			    break;
			  default :
			    console.log(`Sorry, there's no topic to use`);
			}
		} catch (e) {
			console.error(e.stack)
		}
	});
}

messageSwitch();

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
		obj.qty = row.SALE_QTY;
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
				    	console.log("===========insert order============");
				    	console.log(order);
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
		   SELECT MIN(ID) FROM ORDERS WHERE STATUS <> 'FINISH'
	   )
	 );`;

var sendNextOrder = () =>{
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
					            			orderRobotType.ip="192.168.0.10"; //TODO: 확인필요
					            			orderRobotType.r_type="robot";
					            			orderRobotType.type ="order";
					            			orderRobotType.command ="03";
					            			orderRobotType.item1 = dataSet.find(order=>{return order.product_cd.startsWith("1")}).product_cd;
					            			orderRobotType.item2 = dataSet.find(order=>{return order.product_cd.startsWith("2")}).product_cd;
					            			updateOrderStatus(dataSet[0].order_id, ORDER_STATUS_WORKING);
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
}

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
var stockUpdate = `UPDATE STOCKS SET CURRENT_QTY= CURRENT_QTY-1, SALE_QTY=SALE_QTY+1 WHERE PRODUCT_CD IN (SELECT PRODUCT_CD FROM ORDERS WHERE ORDER_ID = $1)`;

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
	updateStockbyOrder(order_id,ORDER_STATUS_FINISH);
}