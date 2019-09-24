var net = require('net');
var mqtt = require('mqtt');
var mqttClient  = mqtt.connect('mqtt://localhost:1883');

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

server.listen(13766, function(){
    console.log('Server listening for connections');
});