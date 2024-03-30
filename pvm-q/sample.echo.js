// # Example - Combining tasks and web services
//

var PORT = 8080
var HOST = '127.0.0.1'

var requirejs = require('requirejs')
requirejs(['restify', 'restify-clients', 'restify-q', 'pvm-q', 'q'], function (restify, rclients, rq, pvm, Q) {

  function echo(req, res, next) {
    console.log("[server|echo] " + req.params.message)
    res.send(req.params.message)
  }

  function random(req, res, next) {
    var r = Math.random()
    console.log("[server|random] " + r)
    res.send({ value: r })
  }

  var server = restify.createServer()
  server.use(restify.plugins.queryParser())
  server.use(restify.plugins.bodyParser({ mapParams: false }))

  server.get({ path: '/echo/:message', version: '0.0.1' }, echo)
  server.get({ path: '/random', version: '0.0.1' }, random)

  var client = rclients.createJsonClient({
    url: 'http://' + HOST + ':' + PORT
  })

  var promise_for_completion = Q.defer()

  var tpp = new pvm.ProcessDefinition()

  // There is only a single task, and it prints out that well known message.
  tpp.task('start', function () {
    console.log('Praise the Helix.')

    return rq.get(client, '/echo/praisethehelix')
      .then(function (r) {
        console.log('[client|reply] ' + r.obj)
      }.bind(this))
  })
    .transition('consult the oracle')

  tpp.task('consult the oracle', function () {
    console.log('Will we know anarchy or democracy ?')
    return rq.get(client, '/random')
      .then(function (r) {
        console.log('The Oracle has spoken !')
        this.choice = r.obj.value
      }.bind(this))
  })
    .transition(function () {
      if (this.choice < 0.5) return 'anarchy'
      else return 'democracy'
    })

  tpp.task('anarchy', function () {
    console.log('start9 ftw')
    promise_for_completion.resolve()
  })

  tpp.task('democracy', function () {
    console.log('downrighta ftw')
    promise_for_completion.resolve()
  })

  // --------

  rq.listen(server, PORT, HOST)
    .then(function () {
      console.log('[server] %s listening at %s', server.name, server.url)
    })
    .then(function () {
      tpp.activate()
      return promise_for_completion.promise
    })
    .fin(function () {
      console.log('*********')
      client.close()
      server.close()
    })

})
