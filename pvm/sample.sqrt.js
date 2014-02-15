// # Example - Square Root
//
// The following example is a bit contrived, but it shows a process which
// actually does something; namely calculate the square root of a number.
// I'm basing this off [this example program](http://www.macs.hw.ac.uk/~pjbk/pathways/cpp1/node124.html);
// check that for more background information.

var requirejs = require('requirejs')
requirejs(['pvm'], function(pvm){

  var sqrt = new pvm.ProcessDefinition()

  // The initial node sets up the value for which we want to calculate the
  // square root.
  sqrt.task('start', function() {
    this.number = 77
    console.log('Approximating the square root of ' + this.number + '.')
  })
  .transition('initial guess')

  // The approximation needs an initial guess of the square root. I've
  // arbitrarily chosen one third of the initial value to be a good enough
  // guess.
  sqrt.task('initial guess', function() {
    this.guess = this.number/3
  })
  .transition('approximate')

  // The approximation of the square root repeatedly keeps improving on the
  // initial guess through a simple calculation.
  sqrt.task('approximate', function() {
    this.guess = (this.guess + this.number/this.guess)/2

    console.log('Current guess: ' + this.guess + ' (Squared: ' + (this.guess*this.guess) + ')')
  })
  .transition(function() {
    // If the current guess is a close enough approximation of the square root
    // we break out of the loop and transition to the end node.
    if (Math.abs(this.number - this.guess*this.guess) < 0.000001)
      return 'end'
  })
  .transition('approximate')

  // We then show the final answer, and we're done.
  sqrt.task('end', function() {
    console.log('Final answer: ' + this.guess + ' (Math.sqrt: ' + Math.sqrt(this.number) + ')')
  })

  sqrt.activate()
})


