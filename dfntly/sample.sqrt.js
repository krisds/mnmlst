// # Example - Square Root
//
// The following example is a bit contrived, but it shows a flow which
// actually does something; namely calculate the square root of a number.
// I'm basing this off [this example program](http://www.macs.hw.ac.uk/~pjbk/pathways/cpp1/node124.html);
// check that for more background information.

let requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // We need a context to place our data in. We could use `this`, of course,
  // but as we're not in an object and as we don't want to pollute the global
  // namespace we'll create an empty object for ths purpose instead:
  const the = { }

  // This is the number we'll be calculating the square root for.
  dfntly.define(the, 'number', 100)

  // The approximation needs an initial guess of the square root. I've
  // arbitrarily chosen one third of the initial value to be a good enough
  // guess.
  dfntly.define(the, 'guess', () => {
    const guess = the.number/3

    console.log(
      `[${the.number}] Initial guess: ${guess} (Squared: ${guess*guess})`)

    return guess
  })

  // The approximation of the square root repeatedly keeps improving on the
  // initial guess through a simple calculation.
  dfntly.define(the, 'approximation', () => (the.guess + the.number/the.guess)/2)

  // If the current guess is a close enough approximation of the square root
  // we show the final answer. If not we update the value for the guess with
  // the latest approximation. This will trigger the dataflow engine again
  // for another round of approximating the square root.
  dfntly.define(the, 'iterate', () => {
    const square = the.approximation*the.approximation

    if (Math.abs(the.number - square) < 0.000000001)
      console.log(
        `[${the.number}] Final answer: ${the.approximation} (Math.sqrt: ${Math.sqrt(the.number)})`)
    else {
      console.log(
        `[${the.number}] Current guess: ${the.approximation} (Squared: ${square})`)

      the.guess = the.approximation
    }
  })

  // We can ask for the square root of another number by changing the value of
  // the node. Note that we must schedule this for later, so that the engine
  // has a chance of calculating the root of the first number first.
  setImmediate(() => { the.number = 77 })
})
