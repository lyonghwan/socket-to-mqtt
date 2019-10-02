echo "$(cat SampleOrderJSON.txt)" | nc  60.196.69.234 13766

echo "$(cat SampleOrderJSON2.txt)" | nc 60.196.69.234 13766

mosquitto_pub -h 60.196.69.234 -p 40001 -t 'order/send' -m 'RESEND'

mosquitto_pub -h 60.196.69.234 -p 40001 -t 'order/send' -m 'RESET'