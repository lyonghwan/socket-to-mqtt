echo "$(cat SampleOrderJSON.txt)" | nc  localhost 13766

echo "$(cat SampleOrderJSON2.txt)" | nc localhost 13766

mosquitto_pub -h localhost -p 40001 -t 'order/send' -m 'RESEND'

mosquitto_pub -h localhost -p 40001 -t 'order/send' -m 'RESET'

 mv mqtt.log mqtt-20191002.log
 mv socket.log socket-20191002.log
 node socket-server.js >> socket.log &
 node index.js >> mqtt.log &
 