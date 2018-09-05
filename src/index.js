const dns = require('dns');
const fs = require('fs');
const parseDomain = require("parse-domain");
const request = require('request');

/**
 * @typedef {object} MXRecord
 * @property {number} priority
 * @property {string} exchange
 */

/**
 * @typedef {object} MXDomain
 * @property {string} host - google
 * @property {string} zone - com
 */

/**
 * Extract Email Provider service name by address
 *
 * @example
 * test@gmail.com -> {name: Google, url: https://gmail.com}
 * team@spark.ry -> {name: Yandex, url: https://mail.yandex.ru}
 */
class ProviderDetector {
  constructor(){
  }

  /**
   * Return hostname of email address
   * @param {string} email
   * @return {string}
   */
  extractHost(email) {
    return email.split('@').pop();
  }

  /**
   * Start to extract Provider by hostname
   * @param {string} email
   * @return {Promise.<{name: string, url: string}>}
   */
  async get(email) {
    const host = this.extractHost(email);
    try {
      const mx = await this.getMX(host);
      const mxDomain = this.getMXDomain(mx);

      /**
       * Get email provider domain by mx hostname
       * @
       */
      let providerDomain = this.findProvider(mxDomain),
        providerUrl = `${mxDomain.host}.${mxDomain.zone}`,
        providerName = '';

      if (providerDomain){

        /**
         * Try to get provider Service Name by domain
         * @type {{name: string, isHttps: boolean}}
         */
        try {
          let service = await this.beutifyProviderName(providerDomain);

          providerName = service.name;
          providerUrl = `http${service.isHttps ? 's' : ''}://${providerDomain}`;

        } catch (providerFetchError) {
          console.log('Can not fetch Provider\'s Service Name', providerFetchError);
        }
      }

      return {
        name: providerName || providerUrl,
        url: providerUrl,
      }
    } catch (mxRequestError){
      throw new Error('Email address is not reachable')
    }
  }

  /**
   * Return DNS MX records by hostname
   * @param {string} host
   * @return {Promise.<string>}
   */
  getMX(host) {
    return new Promise((resolve, reject) => {
      dns.resolveMx(host,
        /**
         * @param {Error} err
         * @param {MXRecord[]} mx
         */
        function(err, mx){
          if (err){
            reject(err);
            return;
          }

          /**
           * Sort records by priority from lowest to greatest
           */
          mx.sort(function (a, b) {
            return a.priority- b.priority;
          });

          /**
           * Return last and more priority record
           */
          resolve(mx.pop().exchange);
        }
      );
    });
  }

  /**
   * Return first-level domain by MX Record
   * @param {string} mxRecord
   * @return {MXDomain}
   */
  getMXDomain(mxRecord){
    /**
     * @type {{tld, domain, subdomain}}
     */
    const parsed = parseDomain(mxRecord);
    return {
      host: parsed.domain,
      zone: parsed.tld
    };
  }

  /**
   * Finds Email Provider in the DB by MX hostname
   * @param {MXDomain} mxDomain
   * @return {string}
   */
  findProvider(mxDomain) {
    const free = fs.readFileSync(__dirname + '/../node_modules/freemail/data/free.txt').toString().split('\n');

    // try to find by host+zone
    let found = free.find( domain => new RegExp(`^${mxDomain.host}.${mxDomain.zone}`).test(domain));

    // if not found, find by host only, bu skip short words
    if (!found && mxDomain.host.length > 5) {
      found = free.find( domain => new RegExp(`^${mxDomain.host}`).test(domain));
    }

    return found;
  }

  /**
   * Trying to improve Provider name
   *
   * @example
   * googlemail.com -> Gmail
   * yandex.ru -> Yandex
   *
   * @param {string} hostname
   * @return {Promise.<{name:string, isHttps: boolean}>}
   */
  beutifyProviderName(hostname){
    return new Promise(((resolve, reject) => {
      const titleRx = /(<\s*title[^>]*>(.+?)<\s*\/\s*title)>/gi;
      request(`http://${hostname}`, function (error, response, body) {
        if (error) {
          reject(error);
          return;
        }

        if (!response){
          reject('Empty response');
          return;
        }

        const { statusCode } = response;

        if (statusCode !== 200) {
          reject(new Error(`Request Failed. Status Code: ${statusCode}`));
          return;
        }

        const isHttps = response.connection && response.connection.encrypted;

        const match = titleRx.exec(body);
        if (match && match[2]) {

          let serviceName = match[2];

          /**
           * "Mail.ru: free email service" -> "Mail.ru"
           *          \
           *            delimiter
           */
          [':', ' - ', ' — ', '–', '"'].forEach( delimiter => {
            if (serviceName.includes(delimiter)){
              serviceName = serviceName.split(delimiter).shift();
            }
          });

          resolve({
            name: serviceName,
            isHttps
          })
        } else {
          reject('Can not extract service title');
        }
      });
    }));
  }
}

/**
 * Support calling form terminal
 * @usage node ./src/index.js test@google.com
 */
const emailFromArgs = process.argv && process.argv.length ? process.argv.find( arg => arg.includes('@')) : null;
if (emailFromArgs){
  new ProviderDetector()
    .get(emailFromArgs)
    .then( service => {
      console.log(service);
      return service;
    })
    .catch( error => {
      console.log('Email provider was not reached:', error);
      throw new Error(error);
    })

}

module.exports = new ProviderDetector();