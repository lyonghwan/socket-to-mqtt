
/**
 * Enviroments Section
 */
var net = require('net');
var mqtt = require('mqtt');
var mqttClient  = mqtt.connect('mqtt://60.196.69.234:40001');
var {Pool, Client } = require('pg');

const TOPIC_ORDER_RECV = 'order/recv';
const TOPIC_ORDER_SEND = 'order/send';
const TOPIC_AGV = 'agv';
const TOPIC_ROBOT = 'robot';


const ORDER_STATUS_WAIT = 'WAIT';
const ORDER_STATUS_WORKING = 'WORKING'
const ORDER_STATUS_FINISH = 'FINISH'

// var app = require('express')();
// var http = require('http').createServer(app)


/**
 * DB Connnect
 * @type {pgClient}
 */
// const client = new Client({
//   host: '60.196.69.234',
//   database: 'postgres',
//   user: 'postgres',
//   password: 'p@stgr#s',
//   port: 40002,
// })

const pool = new Pool({
  host: '60.196.69.234',
  database: 'postgres',
  user: 'postgres',
  password: 'p@stgr#s',
  port: 40002
})

// const client = pool.connect()


/**
 * from Socket Server to Mqtt
 * @param  {}
 * @return {[type]}           [description]
 */
var server = net.createServer(function(client){
	messageSwitch();
    client.on('data', function(data){
        mqttClient.publish(TOPIC_ORDER_RECV, data);
    });
    
    client.on('end',function(){
        console.log('Client disconnected');
    });

    client.write('Hello');
});

var messageSwitch = () =>{
	mqttClient.on('connect', function () {});
    mqttClient.subscribe(TOPIC_ORDER_RECV,function(err){});
    mqttClient.subscribe(TOPIC_ORDER_SEND,function(err){});
    mqttClient.subscribe(TOPIC_AGV,function(err){});
    mqttClient.subscribe(TOPIC_ROBOT,function(err){});
	mqttClient.on('message',function(topic, message, packet) {
		var dataString = message.toString();
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
		  default :
		    console.log(`Sorry, there's no topic to use`);
		}
	});
}

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
	var orders = covertOrders(data);
	insertOrders(orders)
}

var covertOrders = (data) => {
	var rows = data.PRODUCT;
	var orders= rows.map((row,index)=>{
		var obj = {};
		obj.product_cd = row.PROD_CD;
		obj.qty = row.SALE_QTY;
		obj.status  = ORDER_STATUS_WAIT;
		obj.order_date = data.SALE_DATE;
		obj.name = row.PROD_CD;
		obj.description = data.POS_NO;
		obj.order_id = data.BILL_NO;
		return obj;
	});
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
				    console.log(orders);
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
					            		// if(dataSet[0].status===ORDER_STATUS_WAIT){
					            			mqttClient.publish(TOPIC_ORDER_SEND, JSON.stringify(dataSet));
					            		// }
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
 * Query Section
 */

/**
 * Order 상태 update
 * @params $1 : orderId, $2 : status 
 * 호출 Sample : query(updateOrderStatus, [orderId,status],
 * 										 function(){},
 * 										 funciton(){})
 */
var sqlUpdateOrderStatus = `UPDATE ORDERS SET STATUS = $2 WHERE ORDER_ID = $1`;

/**
 * Running이 없는 경우 주문서 선택
 */
var sqlSelectNextOrder = 
     `SELECT * FROM ORDERS WHERE ORDER_ID IN (
	   SELECT ORDER_ID FROM ORDERS 
	   WHERE ID IN (
		   SELECT MIN(ID) FROM ORDERS WHERE STATUS <> 'FINISH'
	   )
	 );`;

/**
 * Running이 없는 경우 주문서 선택
 */
var sqlSelectRunningOrderExists = 
     `SELECT COUNT(1)>0 FROM ORDERS WHERE STATUS = 'WORKING'`;


var updateOrderStatus = (status) => {
	;(async () => {
	    // const { rows } = await client.query(sqlInsertOrder, [productCd,qty,status,orderDate,name,description,orderId])
		try {
		    await client.query('BEGIN')
	   		await client.query(sqlUpdateOrderStatus, status);
		    await selectNextOrder();
		    await client.query('COMMIT')
		} catch (e) {
		    await client.query('ROLLBACK')
		    throw e
		} finally {
			client.release()
		}
	})().catch(e => console.error(e.stack))
};


var checkIfOrderWorking = (orders) =>{
	var isExists = true;
	singleQuery(
		sqlSelectRunningOrderExists,
		null,
		function(){
			isExists = false;
		},
		null);
	return isExists;
}

server.listen(13766, function(){
    console.log('Server listening for connections');
});

// app.get('/', function(req, res){
//   res.sendFile(__dirname + '/index.html');
// });

// http.listen(3000, function(){
//   console.log('listening on *:3000');
// });