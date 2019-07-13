const express = require('express')
const bodyParser = require('body-parser')
const massive = require('massive')
const utility = require('utility')

massive({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  database: 'ScheduleUs',
  password: 'Candilaria1',
}).then(db => {

	var app = express()
	app.use(bodyParser.json())

	app.get('/createevent', function (req, res) {
      db.Events.insert({
          EventID: req.EventID,
          EventClientID: req.EventClientID,
          Name: req.Name,
          Address: req.Address,
          City: req.City,
          State: req.State,
          PostalCode: req.PostalCode,
          EventType: req.EventType,
          IsRecurring: req.IsRecurring,
          CreationDate: new Date().now,
          EventDescription: req.EventDescription,
          NeedsSchedule: true,
          UtcOffset: 
      })
	})
});
