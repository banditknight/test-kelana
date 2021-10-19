require('dotenv').config({ path: './config.env' });

const net = require('net');
const Parser = require('./parser');
const binutils = require('binutils64');

const express = require('express');
const cors = require('cors');
const dbo = require('./db/conn');

const { Client } = require('whatsapp-web.js');
const client = new Client();

const qr = require("qrcode");

const PORT = process.env.PORT || 5000;
const app = express();

let waqr = "http://ombak.id";

app.use(cors());
app.use(express.json());
app.use(require('./routes/record'));

app.get("/botlogin",(req,res)=>{
  qr.toDataURL(waqr,(err,src)=>{
    if (err) res.send("Error occured");
    res.send("<img src=\""+src+"\" />");
  });
});

client.on('qr', (qr) => {
  // Generate and scan this code with your phone
  waqr = qr;
  console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
  waqr = "http://ombak.id";
  console.log('WA Client is ready!');
});

client.on('message', msg => {
  if (msg.body == 'tes') {
    msg.reply('tis');
  }
});

client.initialize();

// Global error handling
// app.use(function (err, _req, res) {
//   console.error(err.stack);
//   res.status(500).send('Something broke!');
// });

async function sendWA(number,message){
  const sanitized_number = number.toString().replace(/[- )(]/g, ""); // remove unnecessary chars from the number
  const final_number = `62${sanitized_number.substring(sanitized_number.length - 10)}`; // add 91 before the number here 91 is country code of India

  const number_details = await client.getNumberId(final_number); // get mobile number details

  if (number_details) {
    const sendMessageData = await client.sendMessage(number_details._serialized, message); // send message
  } else {
    console.log(final_number, "Mobile number is not registered");
  }
}

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

// perform a database connection when the server starts
dbo.connectToServer(function (err) {
  if (err) {
    console.error(err);
    process.exit();
  }

  dblog = dbo.getDb();

  // start the Express server
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
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
                sendWA("8112641739","Alarm! https://maps.google.com/?q="+rec.gps.latitude+","+rec.gps.longitude);
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
