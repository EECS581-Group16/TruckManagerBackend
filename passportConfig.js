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

//Function to find a user in database
async function findUser(username) {
  return new Promise((resolve, reject) => {
    const q = `SELECT Username, Passcode, id FROM Login.Login WHERE Username = "${username}" `;
    connection.query(q, (err, result) => {
        if (err) reject(new Error('fail'));
        if(result[0]) {
          resolve({username: result[0].Username, password: result[0].Passcode, id: result[0].id});
        }
        reject(new Error('invalid'));
    });
  });
}
async function findId(id) {
  return new Promise((resolve, reject) => {
    const q = `SELECT Username, id FROM Login.Login WHERE id = "${id}" `;
    connection.query(q, (err, result) => {
        if (err) reject(new Error('fail'));
        if(result[0]) resolve({username: result[0].Username, id: result[0].id});
        reject(new Error('invalid'));
    });
  });
}

module.exports = function (passport) {
  passport.use(
    new localStrategy((username, password, done) => {
      findUser(username).then(async (user) => {
          await bcrypt.compare(password, user.password, (err, result) => {
            if (err) throw err;
            if (result === true) {
              return done(null, user);
            } else {
              return done(null, false);
            }
          });
      }).catch((err) => {
        if (err) throw err;
        return done(null, false)
      });
    })
  );

  passport.serializeUser((user, cb) => {
    cb(null, user.id);
  });
  passport.deserializeUser((id, cb) => {
    console.log('here');
    findId(id).then((user) => {
      const userInformation = {
        username: user.username,
        id: user.id
      }
      console.log('User Information', userInformation);
      cb(null, userInformation)
    }).catch((err) => {
      cb(err, null);
    });
  });
};