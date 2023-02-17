/*
-Author: Mason Otto
-Name: passportConfig.js
-Last Modified: 2/6/2023
-Description: config file for passport.js in server.js, defines local strategy,
  serializing users, and deserializing users.
*/

const localStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const mysql = require('mysql');
require('dotenv').config();
const SALT = 10;

//Database connection
const connection = mysql.createConnection({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: process.env.RDS_PORT 
});

/*
-Author: Mason Otto
-Description: Local Strategy to be used for passport.js, this goes through and authenticates
  the user off of the credentials provided by the user.
-Returns: Object with user data
-TODO: test further (if needed)

-Last Modified: 2/15/2023 by Ryan Penrod
-Changes: Updated uses of username with employee ID
*/
module.exports = function(passport) {
  passport.use("local",
    new localStrategy({usernameField: "employeeId"},
      (employeeId, password, done) => {
        connection.query(`SELECT Employee_ID, Passcode, id FROM Login.Login WHERE Employee_ID = "${employeeId}"`, async (error, results, fields) => {
          if (error) return done(error);
          if (results.length===0) return done(null, false);
          const isValid = await bcrypt.compare(password, results[0].Passcode);
          user = {employeeId: results[0].Employee_ID, id: results[0].id}
          if (isValid) {
            return done(null, user);
          }
          else {
            return done(null, false)
          }
        });
      })
  );

  //Description: this serializes the user and returns the user id associated with the user
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  //Description: this takes a user id and returns the employeeId of the user and the id of that user
  //TODO: return name, and some other data once that is implemented elsewhere
  passport.deserializeUser((id, done) => {
    connection.query(`SELECT Employee_ID, id, Account_Type FROM Login.Login WHERE id = "${id}"`, (error, results) => {
      const userInformation = {
        employeeId: results[0].Employee_ID,
        id: results[0].id,
        accountType: results[0].Account_Type,
      }
      done(null, userInformation);
    });
  });
};