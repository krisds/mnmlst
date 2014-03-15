// # Example - Square Root
//
// The following example is a bit contrived, but it shows a flow which
// actually does something; namely calculate the square root of a number.
// I'm basing this off [this example program](http://www.macs.hw.ac.uk/~pjbk/pathways/cpp1/node124.html);
// check that for more background information.

var requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // This is the number we'll be calculating the square root for.
  var number = dfntly(77)

  // The approximation needs an initial guess of the square root. I've
  // arbitrarily chosen one third of the initial value to be a good enough
  // guess.
  var guess = dfntly(function() {
    var value = number()/3

    console.log(
      '[' + number() + '] Initial guess: ' + value
      + ' (Squared: ' + (value*value) + ')')
        
    return value
  })

  // The approximation of the square root repeatedly keeps improving on the
  // initial guess through a simple calculation.
  var approximate = dfntly(function() {
    return (guess() + number()/guess())/2
  })

  // If the current guess is a close enough approximation of the square root
  // we show the final answer. If not we update the value for the guess with
  // the latest approximation. This will trigger the dataflow engine again
  // for another round of approximating the square root.
  var iterate = dfntly(function() {
    var value = approximate()
    
    if (Math.abs(number() - value*value) < 0.000001)
      console.log(
        '[' + number() + '] Final answer: ' + value
        + ' (Math.sqrt: ' + Math.sqrt(number()) + ')')
    else {
      console.log(
        '[' + number() + '] Current guess: ' + value
        + ' (Squared: ' + (value*value) + ')')

      guess(approximate())
    }
  })
})


