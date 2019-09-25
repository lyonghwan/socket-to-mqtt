
/**
 * Enviroments Section
 */
var net = require('net');
var mqtt = require('mqtt');
var mqttClient  = mqtt.connect('mqtt://60.196.69.234:40001');
var {Client } = require('pg');


const client = new Client({
  host: '60.196.69.234',
  database: 'postgres',
  user: 'postgres',
  password: 'p@stgr#s',
  port: 40002,
})

client.connect()


var server = net.createServer(function(client){
    
    mqttClient.on('connect', function () {});

    client.on('data', function(data){
        mqttClient.publish('topic', data.toString().replace('\n',''));
    });
    
    client.on('end',function(){
        console.log('Client disconnected');
    });

    client.write('Hello');
});


/**
 * ORM SECTION
 */

/**
 * query 실행 기능
 * @param  {SQL} text           SQL String
 * @param  {Array} params         SQL Pram with sequence
 * @param  {Function} sucessCallback Callback if Sucess
 * @param  {Function} errCallback    Callback if error
 * @return {function}                function
 */
var singleQuery = (text, params, sucessCallback,errCallback) => {
	const start = Date.now()
	return client.query(text, params, (err, res) => {
	  const duration = Date.now() - start
	  if (err) {
	  	console.log('SQL ERROR Executed query', text);
	    console.log(err.stack);
	    if(errCallback) errCallback(err);
	  } else {
	  	console.log('executed query', { text, duration, rows: res.rowCount });
	    var rows = res.rows;
	    if(rows.length>1){
	    	if(sucessCallback) sucessCallback(rows);
	    }else{
	    	if(sucessCallback) sucessCallback(rows[0]);
	    }
	  }
	})
}

/**
 * Query Section
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
		   SELECT MIN(ID) FROM ORDERS WHERE STATUS = 'FINISH'
	   )
	 );`;

/**
 * Running이 없는 경우 주문서 선택
 */
var sqlSelectRunningOrderExists = 
     `SELECT COUNT(1)>0 FROM ORDERS WHERE STATUS = 'WORKING'`;

var insertOrder = (orders) => {
	;(async () => {
		try {
		    await client.query('BEGIN')
			var orderCsv = orders.map(e => e.join(",")).join("\n");
		    // const { rows } = await client.query(sqlInsertOrder, [productCd,qty,status,orderDate,name,description,orderId])
		    orderCsv.forEach(function(order){
		    	await client.query(sqlInsertOrder, order);
		    });

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

var selectNextOrder = (orders) =>{
	singleQuery(
		sqlSelectNextOrder,
		null,
		function(){
			//check if order already running
			//if no
			//send mqtt
			//else do not thing
		},
		null);
}

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