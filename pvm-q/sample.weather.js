// # Example - Weather
//
var requirejs = require('requirejs')
requirejs(['restify', 'restify-q', 'pvm-q', 'q', 'weather-process'],
  function(restify, rq, pvm, Q, weather) {

  // For each of the following cities...
  [
    'London,uk',
    'Reykjavik,is',
    'Rio%20de%20Janeiro,br'
  ]
  .map(function(city) {
    // we activate the weather process.
    weather.activate({ city: city })
    // While the process is running we log its progress.
    .progress(function(task) {
      console.log('<' + city + '> transitioned to ' + task)
    })
    // Similarly, we log when it's done.
    .fin(function(task) {
      console.log('<' + city + '> completed')
    })
  })
})
