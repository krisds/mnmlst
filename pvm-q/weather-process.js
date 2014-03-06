// # A Simple Process for Checking the Weather
//
var requirejs = require('requirejs')
define(['restify', 'restify-q', 'pvm-q', 'q'], function(restify, rq, pvm, Q) {

  // Definition of a process starts by creating an empty ProcessDefinition.
  var weather = new pvm.ProcessDefinition()

  // The initial task uses the [OpenWeatherMap API](http://openweathermap.org/API)
  // to get the temperature at a specified location on Earth. The query runs
  // asynchronously with the help of [Restify](https://github.com/mcavage/node-restify)
  // and [Q](https://github.com/kriskowal/q).
  weather.task('start', function() {
    console.log(
      '[' + this.city + '] Fetching weather info from openweathermap.org...')

    // We start of by setting up a client for querying the OpenWeatherMap API.
    var client = restify.createJsonClient({
      url: 'http://api.openweathermap.org/'
    })

    // We then make the request for the weather data at the specified city. We
    // expect that the user defines this city when starting the process.
    //
    // Note that we return the promise of this 'calculation' as a return value
    // for this task. We must do this for the PVM to be able to capture this
    // promise and react to its completion as needed. If we don't do this then
    // the PVM will immediately move on to the transition phase, even if the
    // task itself was not yet completed.
    return rq.get(client, '/data/2.5/weather?units=metric&q=' + this.city)
    // When we get the answer we store the temperature in the process state,
    // making it available for the transitioning logic.
    .then(function(R) {
      this.temperature = R.obj.main.temp
      console.log(
        '[' + this.city + '] Currently a temperature of ' + this.temperature
          + ' degrees Celcius.')
    }.bind(this))
    // Whatever happens, we should always close the connection at the end.
    // Otherwise the program may hang.
    .fin(function() { client.close() })
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
  })

  // This is what to do when the weather is hot.
  weather.task('hot', function() {
    console.log('[' + this.city + '] Don\'t forget your sunblock !')
  })

  // Otherwise there's some generic good advice to follow.
  weather.task('moderate', function() {
    console.log('[' + this.city + '] Don\'t forget your pants !')
  })

  // Finally, we return the completed process definition as the result of this
  // module.
  return weather
})
