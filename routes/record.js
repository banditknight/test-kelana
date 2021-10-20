const express = require('express');
const simplify = require('simplify-js');

// recordRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /listings.
const recordRoutes = express.Router();

// This will help us connect to the database
const dbo = require('../db/conn');

recordRoutes.route('/history').get(async function (_req, res) {
  const dbConnect = dbo.getDb();

  try {
    let data = await dbConnect.collection('gpslog').find().toArray();
    return res.status(200).json({
      status: 'success',
      message: 'data berhasil ditampilkan',
      data
    })    
  } catch (error) {
    return res.status(400).json({
      status: 'Error!',
      message: error.message
    })
  }
});

recordRoutes.route('/rechistory').get(async function (_req, res) {
  const dbConnect = dbo.getDb();

  try {
    let data = await dbConnect.collection('gpsrecord').find().toArray();
    return res.status(200).json({
      status: 'success',
      message: 'data berhasil ditampilkan',
      data
    })    
  } catch (error) {
    return res.status(400).json({
      status: 'Error!',
      message: error.message
    })
  }
});

recordRoutes.route('/track').get(async function (_req, res) {
  const dbConnect = dbo.getDb();

  try {
    let data = await dbConnect.collection('gpstrack').find().toArray();
    return res.status(200).json({
      status: 'success',
      message: 'data berhasil ditampilkan',
      data
    })    
  } catch (error) {
    return res.status(400).json({
      status: 'Error!',
      message: error.message
    })
  }
});

recordRoutes.route('/xtrack').get(async function (_req, res) {
  const dbConnect = dbo.getDb();

  try {
    let data = await dbConnect.collection('gpstrack').find().toArray();
    let points = [];
    for (const el in data) {
      if (Object.hasOwnProperty.call(data, el)) {
        const p = data[el];
        if(p.location.coordinates[0]!=0 && p.location.coordinates[1]!=0){
          points.push({x:p.location.coordinates[0],y:p.location.coordinates[1]});
        }
      }
    }
    let s = simplify(points,1,false);

    return res.status(200).json({
      status: 'success',
      message: 'data berhasil ditampilkan',
      s
    })    
  } catch (error) {
    return res.status(400).json({
      status: 'Error!',
      message: error.message
    })
  }
});

// This section will help you get a list of all the records.
recordRoutes.route('/listings').get(async function (_req, res) {
  const dbConnect = dbo.getDb();

  dbConnect
    .collection('listingsAndReviews')
    .find({})
    .limit(50)
    .toArray(function (err, result) {
      if (err) {
        res.status(400).send('Error fetching listings!');
      } else {
        res.json(result);
      }
    });
});

// This section will help you create a new record.
recordRoutes.route('/listings/recordSwipe').post(function (req, res) {
  const dbConnect = dbo.getDb();
  const matchDocument = {
    listing_id: req.body.id,
    last_modified: new Date(),
    session_id: req.body.session_id,
    direction: req.body.direction,
  };

  dbConnect
    .collection('matches')
    .insertOne(matchDocument, function (err, result) {
      if (err) {
        res.status(400).send('Error inserting matches!');
      } else {
        console.log(`Added a new match with id ${result.insertedId}`);
        res.status(204).send();
      }
    });
});

// This section will help you update a record by id.
recordRoutes.route('/listings/updateLike').post(function (req, res) {
  const dbConnect = dbo.getDb();
  const listingQuery = { _id: req.body.id };
  const updates = {
    $inc: {
      likes: 1,
    },
  };

  dbConnect
    .collection('listingsAndReviews')
    .updateOne(listingQuery, updates, function (err, _result) {
      if (err) {
        res
          .status(400)
          .send(`Error updating likes on listing with id ${listingQuery.id}!`);
      } else {
        console.log('1 document updated');
      }
    });
});

// This section will help you delete a record.
recordRoutes.route('/listings/delete/:id').delete((req, res) => {
  const dbConnect = dbo.getDb();
  const listingQuery = { listing_id: req.body.id };

  dbConnect
    .collection('listingsAndReviews')
    .deleteOne(listingQuery, function (err, _result) {
      if (err) {
        res
          .status(400)
          .send(`Error deleting listing with id ${listingQuery.listing_id}!`);
      } else {
        console.log('1 document deleted');
      }
    });
});

module.exports = recordRoutes;
