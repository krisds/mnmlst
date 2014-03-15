// # Example - Hello World
//
// This is a very simple example which prints some greetings.

var requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // This creates a node holding a name.
  var name = dfntly('world')
  
  // This creates a node which generates the greeting. Note that it references
  // the previous node in its calculation. That is enough for a link to get
  // established between both nodes.
  var greeting = dfntly(function() {
    return 'Hello ' + name() + '.'
  })

  // When defining nodes based on functions the functions will get evaluated
  // immediately. This fact will become obvious when running the code for the
  // following definition. It prints the message. Because it gets evaluated
  // immediately we should see the "Hello world." message on the console.
  var print_it = dfntly(function() {
    console.log(greeting())
  })

  // The following statements update the name twice. Once to "Once-ler", then
  // to "Lorax". These changes will cause the dataflow engine to trigger and to
  // update all other nodes. However, due to the way the engine gets scheduled,
  // the recalculation will only trigger after both statements have executed.
  // This means that the "greeting" and "print_it" nodes will only get
  // recalculated once each, and so we will only see one more message on the
  // console. Namely "Hello Lorax."
  name('Once-ler')
  name('Lorax')
})


