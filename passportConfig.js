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

module.exports = function(passport) {
  passport.use("local",
    new localStrategy((username, password, done) => {
      connection.query(`SELECT Username, Passcode, id FROM Login.Login WHERE Username = "${username}"`, (error, results, fields) => {
        if (error) return done(error);
        if (results.length===0) return done(null, false);
        const isValid = bcrypt.compare(password, results[0].Passcode);
        user = {username: results[0].Username, id: results[0].id}
        if (isValid) {
          //console.log('VALID');
          return done(null, user);
        }
        else {
          return done(null, false)
        }
      });
    })
  );


// module.exports = function (passport) {
//   passport.use(
//     new localStrategy((username, password, done) => {
//       findUser(username).then(async (user) => {
//           await bcrypt.compare(password, user.password, (err, result) => {
//             if (err) throw err;
//             if (result === true) {
//               return done(null, user);
//             } else {
//               return done(null, false);
//             }
//           });
//       }).catch((err) => {
//         if (err) throw err;
//         return done(null, false)
//       });
//     })
//   );

  passport.serializeUser((user, done) => {
    //console.log('serializing user');
    done(null, user.id);
  });
  passport.deserializeUser((id, done) => {
    //console.log('deserializing user');
    connection.query(`SELECT Username, id FROM Login.Login WHERE id = "${id}"`, (error, results) => {
      const userInformation = {
        username: results[0].Username,
        id: results[0].id
      }
      //console.log(userInformation)
      done(null, userInformation);
    });
    // findId(id).then((user) => {
    //   const userInformation = {
    //     username: user.username,
    //     id: user.id
    //   }
      // console.log('User Information', userInformation);
      // cb(null, userInformation)
    // }).catch((err) => {
    //   cb(err, null);
    // });
  });
};