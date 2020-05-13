// # Example - Square Root
//
// The following example is a bit contrived, but it shows a flow which
// actually does something; namely calculate the square root of a number.
// I'm basing this off [this example program](http://www.macs.hw.ac.uk/~pjbk/pathways/cpp1/node124.html);
// check that for more background information.

let requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // This is the number we'll be calculating the square root for.
  let number = dfntly.is(100)

  // The approximation needs an initial guess of the square root. I've
  // arbitrarily chosen one third of the initial value to be a good enough
  // guess.
  let guess = dfntly.is(() => {
    let value = number.value()
    let guess = value/3

    console.log(
      '[' + value + '] Initial guess: ' + guess
      + ' (Squared: ' + (guess*guess) + ')')
        
    return guess
  })

  // The approximation of the square root repeatedly keeps improving on the
  // initial guess through a simple calculation.
  let approximate = dfntly.is(() => (guess.value() + number.value()/guess.value())/2)

  // If the current guess is a close enough approximation of the square root
  // we show the final answer. If not we update the value for the guess with
  // the latest approximation. This will trigger the dataflow engine again
  // for another round of approximating the square root.
  let iterate = dfntly.is(() => {
    let value = approximate.value()
    
    if (Math.abs(number.value() - value*value) < 0.000000001)
      console.log(
        '[' + number.value() + '] Final answer: ' + value
        + ' (Math.sqrt: ' + Math.sqrt(number.value()) + ')')
    else {
      console.log(
        '[' + number.value() + '] Current guess: ' + value
        + ' (Squared: ' + (value*value) + ')')

      guess.becomes(approximate.value())
    }
  })
  
  // We can ask for the square root of another number by changing the value of
  // the node. Note that we must schedule this for later, so that the engine
  // has a chance of calculating the root of the first number first.
  setImmediate(() => { number.becomes(77) })
})
