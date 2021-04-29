/**
 * Enviroments Section
 */
var net = require("net");
require("console-stamp")(console, { pattern: "dd/mm/yyyy HH:MM:ss.l" });

var client = net.connect({ port: 2222, host: "localhost" }, function () {
  console.log(connName + " 연결 됨.");
  console.log(`로컬 : ${this.localAddress} / ${this.localPort}`);
  console.log(`리모트 : ${this.remoteAddress} / ${this.remotePort}`);
  //this라고 써도 됨. this = client

  this.setTimeout(500);
  this.setEncoding("utf8");

  this.on("data", function (data) {
    console.log(connName + "한테서 데이터가 옴: " + data.toString());
    client.end();
  });
  this.on("end", function () {
    console.log(connName + "커넥션이 끄너져떠");
  });
  this.on("error", function (err) {
    console.log("에라쓰 : ", JSON.stringify(err));
  });
  this.on("timeout", function () {
    console.log("소켓 타임아웃");
  });
  this.on("close", function () {
    console.log("소켓 닫힘");
  });
});

function writeData(socket, data) {
  var success = !socket.write(data);
  if (!success) {
    (function (socket, data) {
      socket.once("drain", function () {
        writeData(socket, data);
      });
    })(socket, data);
  }
}

var user = getConnection("user");
// writeData(user, "user가 접속해따요!!!!!!!!!!!!!!!!!!!!!!");
