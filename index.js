
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
var query = (text, params, sucessCallback,errCallback) => {
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
 * Order 상태 update
 * @params $1 : orderId, $2 : status 
 * 호출 Sample : query(updateOrderStatus, [orderId,status],
 * 										 function(){},
 * 										 funciton(){})
 */
var updateOrderStatus = "UPDATE ORDERS SET STATUS = $2 WHERE ORDER_ID = $1";

/**
 * Order 상태 update
 * @params $1 : orderId, $2 : status 
 */
var updateOrderStatus = "UPDATE ORDERS SET STATUS = $2 WHERE ORDER_ID = $1";



server.listen(13766, function(){
    console.log('Server listening for connections');
});