require('dotenv').config({ path: './config.env' });

const net = require('net');
const Parser = require('./parser');
const binutils = require('binutils64');

const express = require('express');
const cors = require('cors');
const dbo = require('./db/conn');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(require('./routes/record'));

const wss = require('ws');
let ws;
const wsServer = new wss.Server({ noServer: true });
wsServer.on('connection', socket => {
  ws = socket;
  ws.on('message', message => console.log(message));
});

// Global error handling
// app.use(function (err, _req, res) {
//   console.error(err.stack);
//   res.status(500).send('Something broke!');
// });

let dblog;
let imei;

function addLog(data){
  if(dblog){
    dblog.collection('gpslog').insertOne(data);
  }
}

function addRecord(data){
  if(dblog){
    dblog.collection('gpsrecord').insertOne(data);
  }
}

function addTrack(data){
  if(dblog){
    dblog.collection('gpstrack').insertOne(data);
  }
}

function sendNotification(message){
  ws.send(message);
}

// perform a database connection when the server starts
dbo.connectToServer(function (err) {
  if (err) {
    console.error(err);
    process.exit();
  }

  dblog = dbo.getDb();

  // start the Express server
  let httpserver = app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
  httpserver.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });

  let server = net.createServer((c) => {

    console.log("client connected");
    c.on('end', () => {
      console.log("client disconnected");
    });

    c.on('data', (data) => {

      try {
        let buffer = data;
        let parser = new Parser(buffer);
        if (parser.isImei) {
          imei = parser.imei;
          c.write(Buffer.alloc(1, 1));
        } else {
          let avl = parser.getAvl();
          // console.log(avl);
          let logdata = avl;
          logdata.imei = imei;

          addLog(logdata);

          for(var i=0;i<avl.number_of_data;i++){
            let rec = avl.records[i];
            addRecord(rec);

            let track = {
              imei: imei,
              timestamp: rec.timestamp,
              speed: rec.gps.speed,
              location: {
                type: "Point",
                coordinates: [rec.gps.longitude, rec.gps.latitude]
              },
            };
            addTrack(track);

            // console.log(rec);
            for(var j=0;j<rec.ioElements.length;j++){
              // console.log(rec.ioElements[j]);
              if(rec.ioElements[j].id==236){
                // sendNotification("Alarm! https://maps.google.com/?q="+rec.gps.latitude+","+rec.gps.longitude);
                sendNotification("{\"lat\":"+rec.gps.latitude+",\"lng\":"+rec.gps.longitude+"}");
              }
            }
          }

          let writer = new binutils.BinaryWriter();
          writer.WriteInt32(avl.number_of_data);

          let response = writer.ByteBuffer;
          c.write(response);
          // console.log("=========\n\n");


        }

      } catch (error) {
        console.log(new Date(),error);
      }

    });

  });

  server.listen(4545, () => { console.log("Sock Server is running on port: 4545"); });

});
