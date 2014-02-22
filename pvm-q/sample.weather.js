// # Example - Weather
//
// This example queries the [OpenWeatherMap API](http://openweathermap.org/API)
// to get temperatures at different locations on Earth. These queries all run
// asynchronously with the help of [Restify](https://github.com/mcavage/node-restify)
// and [Q](https://github.com/kriskowal/q).
var requirejs = require('requirejs')
requirejs(['restify', 'restify-q', 'pvm-q', 'q'], function(restify, rq, pvm, Q) {

  // We start of by setting up a client for querying the OpenWeatherMap API.
  var client = restify.createJsonClient({
    url: 'http://api.openweathermap.org/'
  })

  // We'll be running multiple queries in parallel, but need to know when all
  // of them are done. To that end we count the number of active queries, and
  // provide a promise for completion which will be resolved when all queries
  // are done (see further on).
  var count = 0
  var completion = Q.defer()

  // Now for the actual process definition.
  var weather = new pvm.ProcessDefinition()

  // The initial task will trigger the query. We expect the name of the city to
  // have been provided upon startup of the process.
  weather.task('start', function() {
	// We do some logging, and increment the number of active processes.
    console.log(
      '[' + this.city + '] Fetching weather info from openweathermap.org...')
	count += 1

    // Here we make the request for the weather data. When we get the answer
    // we store the temperature in the process state.
    //
    // Note that we return the promise of this 'calculation' as a return value
    // for this task. We must do this for the PVM to be able to capture this
    // promise and react to its completion as needed. If we don't do this then
    // the PVM will immediately move on to the transition phase, even if the
    // task itself was not yet completed.
    return rq.get(client, '/data/2.5/weather?units=metric&q=' + this.city)
    .then(function(R) {
      this.temperature = R.obj.main.temp
      console.log(
        '[' + this.city + '] Currently a temperature of ' + this.temperature
          + ' degrees Celcius.')
    }.bind(this))
  })
  // The transitioning itself is pretty basic. Depending on the reported
  // temperature we transition to one of three different outcomes.
  .transition(function() {
    if (this.temperature < 0) return 'freezing'
    else if (this.temperature > 25) return 'hot'
    else return 'moderate'
  })

  // This is the outcome for when it's freezing.
  weather.task('freezing', function() {
    console.log('[' + this.city + '] Don\'t forget your scarf !')
    if (--count == 0) completion.resolve()
  })

  // This is what to do when the weather is hot.
  weather.task('hot', function() {
    console.log('[' + this.city + '] Don\'t forget your sunblock !')
    if (--count == 0) completion.resolve()
  })

  // Otherwise there's some generic good advice to follow.
  weather.task('moderate', function() {
    console.log('[' + this.city + '] Don\'t forget your pants !')
    if (--count == 0) completion.resolve()
  })

  // Note that all of the above outcomes decrement the number of active
  // processes. When the count hits zero we resolve the promise of completion.
  // We'll be using that in the full test for a very good reason: closing down
  // the client when all requests have completed.
  //
  // So the overall test looks like this. We trigger three different
  // activations of the process definition, each time for a different city.
  // This is followed by returning the promise for completion.
  Q()
  .then(function() {
    weather.activate({ city: 'London,uk' })
    weather.activate({ city: 'Reykjavik,is' })
    weather.activate({ city: 'Rio de Janeiro,br' })
    return completion.promise
  })
  // Doing that allows us to respond to the completion of all tests with the
  // closing of the client. If we'd skip this step then the program would hang,
  // waiting for the connection to close.
  .fin(function() {
    client.close()
  })
})
