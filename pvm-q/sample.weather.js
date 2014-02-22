var PORT = 8080
var HOST = '127.0.0.1'

var requirejs = require('requirejs')
requirejs(['restify', 'restify-q', 'pvm-q', 'q'], function(restify, rq, pvm, Q) {

  var client = restify.createJsonClient({
    url: 'http://api.openweathermap.org/'
  })

  var count = 0
  var promise_for_completion = Q.defer()

  var tpp = new pvm.ProcessDefinition()

  // There is only a single task, and it prints out that well known message.
  tpp.task('start', function() {
	count += 1
	
    console.log(
      '[' + this.city + '] Fetching weather info from openweathermap.org...')

    return rq.get(client, '/data/2.5/weather?units=metric&q=' + this.city)
    .then(function(R) {
      this.temperature = R.obj.main.temp
      console.log(
        '[' + this.city + '] Currently a temperature of ' + this.temperature
          + ' degrees Celcius.')
    }.bind(this))
  })
  .transition(function() {
    if (this.temperature < 0) return 'freezing'
    else if (this.temperature > 20) return 'hot'
    else return 'moderate'
  })

  tpp.task('freezing', function() {
    console.log('[' + this.city + '] Don\'t forget your scarf !')
    count -= 1
    if (count == 0) promise_for_completion.resolve()
  })

  tpp.task('hot', function() {
    console.log('[' + this.city + '] Don\'t forget your sunblock !')
    count -= 1
    if (count == 0) promise_for_completion.resolve()
  })

  tpp.task('moderate', function() {
    console.log('[' + this.city + '] Don\'t forget your pants !')
    count -= 1
    if (count == 0) promise_for_completion.resolve()
  })


  // --------

  Q()
  .then(function() {
    tpp.activate({ city: 'London,uk' })
    tpp.activate({ city: 'Reykjavik,is' })
    tpp.activate({ city: 'Rio de Janeiro,br' })
    return promise_for_completion.promise
  })
  .fin(function() {
    client.close()
  })
})
