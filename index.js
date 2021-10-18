require('dotenv').config({ path: './config.env' });

const net = require('net');
const Parser = require('teltonika-parser');
const binutils = require('binutils64');

const express = require('express');
const cors = require('cors');
const dbo = require('./db/conn');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(require('./routes/record'));

// Global error handling
app.use(function (err, _req, res) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

let dblog;

function addLog(data){
  if(dblog){
    dblog.collection('gpslog').insertOne(data);
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
          c.write(Buffer.alloc(1, 1));
        } else {
          let avl = parser.getAvl();
          // console.log(avl);
          addLog(avl);

          // for(var i=0;i<avl.number_of_data;i++){
          //   let rec = avl.records[i];
          //   console.log(rec);
          //   for(var j=0;j<rec.ioElements.length;j++){
          //     console.log(rec.ioElements[j]);
          //   }
          // }
  
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
  
  server.listen(4545, () => { console.log("Sock Server started 4545"); });

});
