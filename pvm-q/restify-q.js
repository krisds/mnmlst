define(['restify', 'q'], function (restify, Q) {
  var REDIRECT = 302

  function listen(server, port, host) {
    var deferred = Q.defer()
    server.listen(port, host, function(){
      deferred.resolve(server)
    })
    return deferred.promise
  }

  function get(client, url) {
    var deferred = Q.defer()
    client.get(url, function(err, req, res, obj) {
      if (err) deferred.reject({req: req, res: res, err: err})
      else deferred.resolve({req: req, res: res, obj: obj})
    })
    return deferred.promise
  }

  function post(client, url, message) {
    var deferred = Q.defer()
    client.post(url, message, function(err, req, res, obj) {
      if (err)
        deferred.reject({req: req, res: res, err: err})
      else if (res.statusCode == REDIRECT)
        deferred.resolve(get(client, res.headers.location))
      else 
        deferred.resolve({req: req, res: res, obj: obj})
    })
    return deferred.promise
  }

  function del(client, url) {
    var deferred = Q.defer()
    client.del(url, function(err, req, res) {
      if (err) deferred.reject({req: req, res: res, err: err})
      else deferred.resolve({req: req, res: res})
    })
    return deferred.promise
  }

  // ## Public API
  //
  return {
	listen: listen,
    get: get,
    post: post,
    del: del,
  }
})
