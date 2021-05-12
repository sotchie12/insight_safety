"use strict";
// Server config
const config = require('../config/config.json');
const util = require('util');
const mysql = require('mysql');
const server_logger = require("./server_logger");

const _bDebug_mode = process.argv.indexOf("debug") >= 0; //If true, spam the console with debug messages
const logger = server_logger.SERVER_LOGGING(config.log_options.LOG_PATH + '/mysql_connection.log', { level: _bDebug_mode ? 'debug' : 'info', add_mqtt: false });


function EMysql() {
  this.pool = null;
  this.pq = null;
}


EMysql.prototype.init = async function(connectionObject) {
  // Set up connection
  this.pool = mysql.createPool(connectionObject);

  this.pQuery = util.promisify(this.pool.query);

  // Connection test
  let connection = await customPromisify(this.pool, this.pool.getConnection, []);
  if (connection) connection.release();

  logger.log('info', `[mysql_connection] Successfully connected to Mysql Database: ${connectionObject.database}`);
};



EMysql.prototype.directPoolQuery = async function(param, optional) {
  let te = null;
  try {
      const result = await this.pQuery.apply(this.pool, [param, optional]);
      logger.log("debug", { result });
      return result;
  } catch (e) {
      te = e;
  }
  if (te) { throw te; }
}


EMysql.prototype.nestedPoolQueryTransaction = async function(aArgv) {
  let te = null;
  try {
      let connection = await customPromisify(this.pool, this.pool.getConnection, []);

      try {
          await customPromisify(connection, connection.beginTransaction, []);
          for (const argv of aArgv) {
              try {
                  await customPromisify(connection, connection.query, argv);
                  await customPromisify(connection, connection.commit, []);
              } catch (e) {
                  logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction error[1]: ` + e);
                  logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction argument[1]: ` + JSON.stringify(aArgv));
                  te = e;
                  await customPromisify(connection, connection.rollback, []);
              }
          }
      } catch (e) {
          logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction error[2]: ` + e);
          logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction argument[2]: ` + JSON.stringify(aArgv));
          te = e;
          await customPromisify(connection, connection.rollback, []);
      }

      connection.release();
  } catch (e) {
      te = e;
      logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction error[3]: ` + e);
      logger.log("debug", `[mysql_connection] nestedPoolQueryTransaction argument[3]: ` + JSON.stringify(aArgv));
  }
  if (te) { throw te; }
}


EMysql.prototype.directPoolQueryTransaction = async function(param, optional) {
    let result = undefined;
    let te = null;
    try {
        let connection = await customPromisify(this.pool, this.pool.getConnection, []);
        try {
            await customPromisify(connection, connection.beginTransaction, []);
            try {
                result = await customPromisify(connection, connection.query, [param, optional]);
                await customPromisify(connection, connection.commit, []);
            } catch (e) {
                logger.log("debug", `[mysql_connection] directPoolQueryTransaction error[1]: ` + e);
                te = e;
                await customPromisify(connection, connection.rollback, []);
            }
        } catch (e) {
            logger.log("debug", `[mysql_connection] directPoolQueryTransaction error[2]: ` + e);
            te = e;
            await customPromisify(connection, connection.rollback, []);
        }
        connection.release();
    } catch (e) {
        logger.log("debug", `[mysql_connection] directPoolQueryTransaction error[3]: ` + e);
        te = e;
    }
    if (te) { throw te; }
    logger.log("debug", `directPoolQueryTransaction result: ${JSON.stringify({ result })}`);
    return result;
}


function customPromisify(scope, fnc, argv) {
  return new Promise((t, f) => {
      const cb = (e, ...res) => { if (e) { f(e); } else { t(...res); } };
      const injected = argv.concat([cb]);
      fnc.apply(scope, injected);
  });
}

module.exports = EMysql;