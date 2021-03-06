/**
 * Enviroments Section
 */
var net = require('net');
var mqtt = require('mqtt');
require('console-stamp')(console, { pattern: 'dd/mm/yyyy HH:MM:ss.l' });

var mqttClient  = mqtt.connect('mqtt://localhost:40001');

var TOPIC_ORDER_RECV = 'order/recv';

/**
 * from Socket Server to Mqtt
 * @param  {}
 * @return {[type]}           [description]
 */
var server = net.createServer(function(client){
    console.log('Client connection: ');
    console.log('   local = %s:%s', client.localAddress, client.localPort);
    console.log('   remote = %s:%s', client.remoteAddress, client.remotePort);
	try {
	    client.on('data', function(data){
	    	console.log(data);
	    	console.log(data.toString('hex'));
	      // mqttClient.publish(TOPIC_ORDER_RECV, data);
	    });
	    
	    client.on('end',function(){
	        console.log('Client disconnected');
	    });

		client.on("error", function(err){
			console.log("Caught flash policy server socket error: ")
			console.log(err.stack)
		});

	    client.write('Hello');
	} catch (e) {
	    console.error(e.toString());
	} finally {

	}
});

/**
 * 주문완료 완료
 */

server.listen(13766, function(){
    console.log('Server listening for connections');
});