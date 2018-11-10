var request = require("request");
var crypto = require("crypto");
var querystring = require("querystring");

function LBCClient(key, secret, opt) {
  var self = this;
  var config = {
    url: "https://localbitcoins.com/api",
    key: key,
    secret: secret,
    opt: opt,
    timeoutMS: 5000
  };

  /**
   * This method makes a public or private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  function api(method, params, callback) {
    var defaultMethods = {
      public: [],
      private: [
        "ad-get",
        "myself",
        "dashboard",
        "dashboard/released",
        "dashboard/canceled",
        "dashboard/closed",
        "dashboard/released/buyer",
        "dashboard/canceled/buyer",
        "dashboard/closed/buyer",
        "dashboard/released/seller",
        "dashboard/canceled/seller",
        "dashboard/closed/seller"
      ],
      get: [
        "contact_info/",
        "recent_messages",
        "notifications",
        "ad-get",
        "ad-get/"
      ],
      post: [
        "contact_message_post/",
        "contact_create/",
        "ad-equation/",
        "contact_cancel/",
        "contact_release/",
        "contact_mark_as_paid/"
      ]
    };
    var methods = (opt && opt.methods) || defaultMethods;

    if (methods.public && methods.public.indexOf(method) !== -1) {
      return publicMethod("POST", method, params, callback);
    } else if (methods.private && methods.private.indexOf(method) !== -1) {
      return privateMethod("POST", method, params, callback);
    } else if (methods.get && methods.get.indexOf(method) !== -1) {
      if (params && params.post_url) {
        method = method + params.post_url;
        delete params.post_url;
      }
      return privateMethod("GET", method, params, callback);
    } else if (methods.post && methods.post.indexOf(method) !== -1) {
      method = method + params.post_url;
      return privateMethod("POST", method, params, callback);
    } else {
      throw new Error(method + " is not a valid API method.");
    }
  }

  /**
   * This method makes a public API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  function publicMethod(postMethod, method, params, callback) {
    params = params || {};

    var path = "/" + method;
    var url = config.url + path;

    return rawRequest(postMethod, url, {}, params, callback);
  }

  /**
   * This method makes a private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  function privateMethod(postMethod, method, params, callback) {
    params = params || {};

    var path = "/" + method;
    var url = config.url + path;
    var nonce = new Date().getTime();
    var signature = getMessageSignature(path, params, nonce);

    var headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Apiauth-Key": config.key,
      "Apiauth-Nonce": nonce,
      "Apiauth-Signature": signature
    };
    // console.log(url, headers, params)
    return rawRequest(postMethod, url, headers, params, callback);
  }

  /**
   * This method returns a signature for a request as a Base64-encoded string
   * @param  {String}  path    The relative URL path for the request
   * @param  {Object}  request The POST body
   * @param  {Integer} nonce   A unique, incrementing integer
   * @return {String}          The request signature
   */
  function getMessageSignature(path, params, nonce) {
    var postParameters = querystring.stringify(params);
    var path = "/api" + path + "/";
    var message = nonce + config.key + path + postParameters;
    var auth_hash = crypto
      .createHmac("sha256", config.secret)
      .update(message)
      .digest("hex")
      .toUpperCase();
    return auth_hash;
  }

  /**
   * This method sends the actual HTTP request
   * @param  {String}   url      The URL to make the request
   * @param  {Object}   headers  Request headers
   * @param  {Object}   params   POST body
   * @param  {Function} callback A callback function to call when the request is complete
   * @return {Object}            The request object
   */
  function rawRequest(method, url, headers, params, callback) {
    var options = {
      url: url + "/",
      headers: headers,
      form: params,
      method: method
    };

    var req = request(options, function(error, response, body) {
      if (typeof callback === "function") {
        var data;

        if (error) {
          callback.call(
            self,
            new Error("Error in server response: " + JSON.stringify(error)),
            null
          );
          return;
        }

        try {
          data = JSON.parse(body);
        } catch (e) {
          callback.call(
            self,
            new Error("Could not understand response from server: " + body),
            null
          );
          return;
        }

        if (data.error && data.error.length) {
          callback.call(self, data.error, null);
        } else {
          callback.call(self, null, data);
        }
      }
    });

    return req;
  }

  self.api = api;
  self.publicMethod = publicMethod;
  self.privateMethod = privateMethod;
}

module.exports = LBCClient;
